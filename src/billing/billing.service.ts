import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class BillingService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  private generateInvoiceNumber(): string {
    const date = new Date();
    const prefix = 'INV';
    const datePart = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${datePart}-${randomPart}`;
  }

  async create(data: any): Promise<any> {
    const items = data.items || [];
    const subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0);
    const tax = data.tax || 0;
    const discount = data.discount || 0;
    const totalAmount = subtotal + tax - discount;

    const invoice = await this.db.create('invoices', {
      invoiceNumber: this.generateInvoiceNumber(),
      patientId: data.patientId,
      appointmentId: data.appointmentId || null,
      items,
      subtotal,
      tax,
      discount,
      totalAmount,
      amountRemaining: totalAmount,
      notes: data.notes || '',
      isInsuranceClaim: data.isInsuranceClaim || false,
      insuranceProvider: data.insuranceProvider || '',
      insuranceCoverage: data.insuranceCoverage || 0,
    });

    this.gateway.broadcastToAll('invoice:created', invoice);
    if (data.patientUserId) {
      this.gateway.sendNotification(data.patientUserId, {
        title: 'New Invoice',
        message: `A new invoice #${invoice.invoiceNumber} has been created for you. Total: $${totalAmount}`,
        type: 'billing',
      });
    }
    return invoice;
  }

  async findAll(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.patientId) filter.patientId = query.patientId;
    if (query.status) filter.status = query.status;
    if (query.paymentMethod) filter.paymentMethod = query.paymentMethod;
    if (query.date) {
      const start = new Date(query.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(query.date);
      end.setHours(23, 59, 59, 999);
      filter.createdAt = {
        $gte: start.toISOString(),
        $lt: end.toISOString(),
      };
    }

    const invoices = await this.db.find('invoices', filter, {
      sort: { createdAt: -1 },
    });
    await this.db.populate(invoices, {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId', 'patientType'],
      nested: [
        {
          as: 'userId',
          table: 'users',
          ref: 'userId',
          select: ['firstName', 'lastName', 'email', 'phone'],
        },
      ],
    });
    return invoices;
  }

  async findById(id: string): Promise<any> {
    const invoice = await this.db.findById('invoices', id);
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.db.populate([invoice], {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId', 'patientType'],
      nested: [
        {
          as: 'userId',
          table: 'users',
          ref: 'userId',
          select: ['firstName', 'lastName', 'email', 'phone'],
        },
      ],
    });
    await this.db.populate([invoice], {
      as: 'appointmentId',
      table: 'appointments',
      ref: 'appointmentId',
    });
    return invoice;
  }

  async processPayment(id: string, data: { amount: number; paymentMethod: string }): Promise<any> {
    const invoice = await this.db.findById('invoices', id);
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (data.amount <= 0) throw new BadRequestException('Payment amount must be greater than zero');
    if (data.amount > invoice.amountRemaining) {
      throw new BadRequestException('Payment amount exceeds remaining balance');
    }

    const amountPaid = invoice.amountPaid + data.amount;
    const amountRemaining = invoice.totalAmount - amountPaid;
    const status = amountRemaining <= 0 ? 'Paid' : 'Partial';

    const updated = await this.db.update('invoices', id, {
      amountPaid,
      amountRemaining,
      paymentMethod: data.paymentMethod,
      paidAt: new Date().toISOString(),
      status,
    });
    if (!updated) throw new NotFoundException('Invoice not found');

    await this.db.populate([updated], {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId'],
      nested: [
        {
          as: 'userId',
          table: 'users',
          ref: 'userId',
          select: ['firstName', 'lastName', 'email', 'phone'],
        },
      ],
    });

    this.gateway.broadcastToAll('billing:payment-received', {
      invoice: updated,
      payment: { amount: data.amount, method: data.paymentMethod, timestamp: new Date().toISOString() },
    });

    return updated;
  }

  async update(id: string, data: any): Promise<any> {
    const invoice = await this.db.update('invoices', id, data);
    if (!invoice) throw new NotFoundException('Invoice not found');
    this.gateway.broadcastToAll('invoice:updated', invoice);
    return invoice;
  }

  async delete(id: string): Promise<void> {
    const ok = await this.db.delete('invoices', id);
    if (!ok) throw new NotFoundException('Invoice not found');
  }

  async getStats(): Promise<any> {
    const total = await this.db.count('invoices');
    const paid = await this.db.count('invoices', { status: 'Paid' });
    const pending = await this.db.count('invoices', { status: 'Pending' });
    const partial = await this.db.count('invoices', { status: 'Partial' });
    const overdue = await this.db.count('invoices', { status: 'Overdue' });

    const totalRevenue = await this.db.sum('invoices', 'totalAmount', { status: 'Paid' });
    const totalCollected = await this.db.sum('invoices', 'amountPaid');
    const totalOutstanding = await this.db.sum('invoices', 'amountRemaining', {
      status: { $in: ['Pending', 'Partial', 'Overdue'] },
    });

    const today = new Date().toISOString().split('T')[0];
    const todayPayments = await this.db.get<{ total: number }>(
      `SELECT COALESCE(SUM("amountPaid"), 0)::float8 AS total FROM invoices WHERE "paidAt" >= $1 AND "paidAt" < $2`,
      [today, `${today}T23:59:59.999Z`],
    );

    return {
      total,
      paid,
      pending,
      partial,
      overdue,
      totalRevenue,
      totalCollected,
      totalOutstanding,
      todayPayments: todayPayments?.total || 0,
    };
  }
}
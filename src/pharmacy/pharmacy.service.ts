import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class PharmacyService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  // ─────────────────────────────────────────────
  // Medicine CRUD
  // ─────────────────────────────────────────────

  async createMedicine(data: any): Promise<any> {
    const medicine = await this.db.create('medicines', data);
    if (medicine.quantity <= medicine.reorderLevel) {
      this.gateway.broadcastToRole('pharmacist', 'pharmacy:stock-alert', {
        medicine: medicine.name,
        currentStock: medicine.quantity,
        reorderLevel: medicine.reorderLevel,
        message: `Low stock alert: ${medicine.name} has only ${medicine.quantity} units remaining`,
      });
    }
    return medicine;
  }

  async findAllMedicines(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.category) filter.category = query.category;
    if (query.inStock !== undefined) filter.inStock = query.inStock;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search } },
        { genericName: { $regex: query.search } },
        { category: { $regex: query.search } },
      ];
    }
    return this.db.find('medicines', filter, { sort: { name: 1 } });
  }

  async findMedicineById(id: string): Promise<any> {
    const medicine = await this.db.findById('medicines', id);
    if (!medicine) throw new NotFoundException('Medicine not found');
    return medicine;
  }

  async updateMedicine(id: string, data: any): Promise<any> {
    const medicine = await this.db.update('medicines', id, data);
    if (!medicine) throw new NotFoundException('Medicine not found');
    return medicine;
  }

  async deleteMedicine(id: string): Promise<void> {
    const ok = await this.db.delete('medicines', id);
    if (!ok) throw new NotFoundException('Medicine not found');
  }

  async dispenseMedicine(id: string, quantity: number): Promise<any> {
    const medicine = await this.db.findById('medicines', id);
    if (!medicine) throw new NotFoundException('Medicine not found');
    if (medicine.quantity < quantity) throw new BadRequestException('Insufficient stock');

    const newQuantity = medicine.quantity - quantity;
    const updated = await this.db.update('medicines', id, {
      quantity: newQuantity,
      inStock: newQuantity > 0,
    });

    if (updated.quantity <= updated.reorderLevel) {
      this.gateway.broadcastToRole('pharmacist', 'pharmacy:stock-alert', {
        medicine: updated.name,
        currentStock: updated.quantity,
        reorderLevel: updated.reorderLevel,
        message: `Low stock alert: ${updated.name} has only ${updated.quantity} units remaining`,
      });
    }

    return updated;
  }

  // ─────────────────────────────────────────────
  // Prescription CRUD
  // ─────────────────────────────────────────────

  async createPrescription(data: any): Promise<any> {
    const items = data.items || [];
    const totalCost = items.reduce(
      (sum: number, item: any) => sum + (item.price * item.quantity),
      0,
    );
    const prescription = await this.db.create('prescriptions', {
      ...data,
      items,
      totalCost,
    });
    await this.populatePrescription(prescription);
    this.gateway.broadcastToRole('pharmacist', 'prescription:created', prescription);
    this.gateway.broadcastToRole('doctor', 'prescription:created', prescription);
    return prescription;
  }

  async findAllPrescriptions(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.patientId) filter.patientId = query.patientId;
    if (query.doctorId) filter.doctorId = query.doctorId;
    if (query.status) filter.status = query.status;

    const prescriptions = await this.db.find('prescriptions', filter, {
      sort: { createdAt: -1 },
    });
    return this.populatePrescriptions(prescriptions);
  }

  async findPrescriptionById(id: string): Promise<any> {
    const prescription = await this.db.findById('prescriptions', id);
    if (!prescription) throw new NotFoundException('Prescription not found');
    return this.populatePrescription(prescription, true);
  }

  async updatePrescriptionStatus(id: string, status: string): Promise<any> {
    const prescription = await this.db.update('prescriptions', id, { status });
    if (!prescription) throw new NotFoundException('Prescription not found');
    return prescription;
  }

  async getStats(): Promise<any> {
    const totalMedicines = await this.db.count('medicines');
    const lowStock = await this.db.get<{ cnt: number }>(
      'SELECT COUNT(*)::int AS cnt FROM medicines WHERE quantity <= "reorderLevel"',
    );
    const outOfStock = await this.db.count('medicines', { quantity: 0 });
    const totalPrescriptions = await this.db.count('prescriptions');
    const pendingPrescriptions = await this.db.count('prescriptions', { status: 'Pending' });
    const totalInventoryValue = await this.db.get<{ total: number }>(
      'SELECT COALESCE(SUM(price * quantity), 0)::float8 AS total FROM medicines',
    );
    return {
      totalMedicines,
      lowStock: lowStock?.cnt || 0,
      outOfStock,
      totalPrescriptions,
      pendingPrescriptions,
      totalInventoryValue: totalInventoryValue?.total || 0,
    };
  }

  private async populatePrescription(
    prescription: any,
    includePatientDetails = false,
  ): Promise<any> {
    const patientUserSelect = includePatientDetails
      ? ['firstName', 'lastName', 'email', 'phone']
      : ['firstName', 'lastName'];
    await this.db.populate([prescription], {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId'],
      nested: [{ as: 'userId', table: 'users', ref: 'userId', select: patientUserSelect }],
    });
    await this.db.populate([prescription], {
      as: 'doctorId',
      table: 'doctors',
      ref: 'doctorId',
      select: ['userId', 'doctorId', 'specialization'],
      nested: [{ as: 'userId', table: 'users', ref: 'userId', select: ['firstName', 'lastName'] }],
    });
    return prescription;
  }

  private async populatePrescriptions(prescriptions: any[]): Promise<any[]> {
    await this.db.populate(prescriptions, {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId'],
      nested: [
        { as: 'userId', table: 'users', ref: 'userId', select: ['firstName', 'lastName'] },
      ],
    });
    await this.db.populate(prescriptions, {
      as: 'doctorId',
      table: 'doctors',
      ref: 'doctorId',
      select: ['userId', 'doctorId', 'specialization'],
      nested: [
        { as: 'userId', table: 'users', ref: 'userId', select: ['firstName', 'lastName'] },
      ],
    });
    return prescriptions;
  }
}
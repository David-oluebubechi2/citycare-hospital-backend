import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class AppointmentsService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  async create(data: any): Promise<any> {
    const patient = await this.db.findById('patients', data.patientId);
    if (!patient) throw new NotFoundException('Patient not found');

    const doctor = await this.db.findById('doctors', data.doctorId);
    if (!doctor) throw new NotFoundException('Doctor not found');

    const conflict = await this.db.findOne('appointments', {
      doctorId: data.doctorId,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime,
      status: { $nin: ['Cancelled', 'No Show'] },
    });
    if (conflict) {
      throw new BadRequestException('Doctor is not available at this time slot');
    }

    const appointment = await this.db.create('appointments', {
      ...data,
      consultationFee: doctor.consultationFee,
      paymentStatus: 'Pending',
    });

    await this.populateAppointment(appointment);

    this.gateway.broadcastToAll('appointment:created', appointment);

    const doctorUser = await this.db.findById('users', doctor.userId);
    const doctorName = doctorUser
      ? `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim()
      : 'Dr. Staff';
    this.gateway.sendNotification(patient.userId.toString(), {
      title: 'Appointment Scheduled',
      message: `Your appointment with ${doctorName} has been scheduled for ${data.appointmentDate} at ${data.appointmentTime}`,
      type: 'appointment',
    });

    return appointment;
  }

  async findAll(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.patientId) filter.patientId = query.patientId;
    if (query.doctorId) filter.doctorId = query.doctorId;
    if (query.status) filter.status = query.status;
    if (query.department) filter.department = query.department;
    if (query.date) filter.appointmentDate = query.date;

    const appointments = await this.db.find('appointments', filter, {
      sort: { appointmentDate: -1, appointmentTime: -1 },
    });
    return this.populateAppointments(appointments);
  }

  async findById(id: string): Promise<any> {
    const appointment = await this.db.findById('appointments', id);
    if (!appointment) throw new NotFoundException('Appointment not found');
    return this.populateAppointment(appointment, true);
  }

  async update(id: string, data: any): Promise<any> {
    const appointment = await this.db.update('appointments', id, data);
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.populateAppointment(appointment);
    this.gateway.broadcastToAll('appointment:updated', appointment);
    return appointment;
  }

  async cancel(id: string, reason: string): Promise<any> {
    const appointment = await this.db.update('appointments', id, {
      status: 'Cancelled',
      cancelReason: reason,
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    await this.populateAppointment(appointment);
    this.gateway.broadcastToAll('appointment:cancelled', appointment);
    return appointment;
  }

  async delete(id: string): Promise<void> {
    const ok = await this.db.delete('appointments', id);
    if (!ok) throw new NotFoundException('Appointment not found');
  }

  async getStats(): Promise<any> {
    const total = await this.db.count('appointments');
    const today = new Date().toISOString().split('T')[0];
    const todayCount = await this.db.count('appointments', { appointmentDate: today });
    const byStatus = await this.db.groupBy('appointments', 'status');
    const byType = await this.db.groupBy('appointments', 'type');
    const recentAppointments = await this.db.find('appointments', {}, {
      sort: { createdAt: -1 },
      limit: 10,
    });
    await this.populateAppointments(recentAppointments);
    return { total, todayCount, byStatus, byType, recentAppointments };
  }

  private async populateAppointment(
    appointment: any,
    includePatientDetails = false,
  ): Promise<any> {
    const patientSelect = includePatientDetails
      ? ['userId', 'patientId', 'bloodGroup', 'genotype', 'emergencyContactName', 'emergencyContactPhone']
      : ['userId', 'patientId'];
    const patientUserSelect = includePatientDetails
      ? ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth']
      : ['firstName', 'lastName', 'email', 'phone'];
    await this.db.populate([appointment], {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: patientSelect,
      nested: [{ as: 'userId', table: 'users', ref: 'userId', select: patientUserSelect }],
    });
    return this.populateDoctor(appointment);
  }

  private async populateDoctor(appointment: any): Promise<any> {
    await this.db.populate([appointment], {
      as: 'doctorId',
      table: 'doctors',
      ref: 'doctorId',
      select: ['userId', 'doctorId', 'specialization', 'consultationFee'],
      nested: [
        {
          as: 'userId',
          table: 'users',
          ref: 'userId',
          select: ['firstName', 'lastName', 'email', 'phone'],
        },
      ],
    });
    return appointment;
  }

  private async populateAppointments(appointments: any[]): Promise<any[]> {
    await this.db.populate(appointments, {
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
    await this.db.populate(appointments, {
      as: 'doctorId',
      table: 'doctors',
      ref: 'doctorId',
      select: ['userId', 'doctorId', 'specialization', 'consultationFee', 'department'],
      nested: [
        {
          as: 'userId',
          table: 'users',
          ref: 'userId',
          select: ['firstName', 'lastName', 'email', 'phone'],
        },
      ],
    });
    return appointments;
  }
}
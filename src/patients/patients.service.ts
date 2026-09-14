import { Injectable, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PatientsService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  async create(data: any): Promise<any> {
    const patientId = `PAT-${Date.now().toString(36).toUpperCase()}`;

    if (data.email) {
      const existing = await this.db.findOne('users', { email: data.email });
      if (existing) throw new ConflictException('Patient email already exists');

      const hashedPassword = await bcrypt.hash(data.password || 'patient123', 12);
      const user = await this.db.create('users', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || '',
        role: 'patient',
        status: 'active',
        gender: data.gender || 'Male',
        dateOfBirth: data.dateOfBirth || '',
        address: data.address || '',
      });

      const patient = await this.db.create('patients', {
        userId: user._id,
        patientId,
        bloodGroup: data.bloodGroup || '',
        genotype: data.genotype || '',
        allergies: data.allergies || [],
        chronicConditions: data.chronicConditions || [],
        emergencyContactName: data.emergencyContactName || '',
        emergencyContactPhone: data.emergencyContactPhone || '',
        emergencyContactRelation: data.emergencyContactRelation || '',
        insuranceProvider: data.insuranceProvider || '',
        insuranceNumber: data.insuranceNumber || '',
        height: data.height || 0,
        weight: data.weight || 0,
        occupation: data.occupation || '',
        patientType: data.patientType || 'New',
      });

      this.gateway.broadcastToAll('patient:created', patient);
      return patient;
    }

    const placeholderEmail = `${Date.now().toString(36)}@patient.local`;
    const hashedPassword = await bcrypt.hash(data.password || 'patient123', 12);
    const user = await this.db.create('users', {
      firstName: data.firstName || 'Unknown',
      lastName: data.lastName || 'Patient',
      email: placeholderEmail,
      password: hashedPassword,
      phone: data.phone || '',
      role: 'patient',
      status: 'active',
      gender: data.gender || 'Male',
      dateOfBirth: data.dateOfBirth || '',
      address: data.address || '',
    });

    const patient = await this.db.create('patients', {
      userId: user._id,
      patientId,
      bloodGroup: data.bloodGroup || '',
      genotype: data.genotype || '',
      allergies: data.allergies || [],
      chronicConditions: data.chronicConditions || [],
      emergencyContactName: data.emergencyContactName || '',
      emergencyContactPhone: data.emergencyContactPhone || '',
      emergencyContactRelation: data.emergencyContactRelation || '',
      insuranceProvider: data.insuranceProvider || '',
      insuranceNumber: data.insuranceNumber || '',
      height: data.height || 0,
      weight: data.weight || 0,
      occupation: data.occupation || '',
      patientType: data.patientType || 'New',
    });

    this.gateway.broadcastToAll('patient:created', patient);
    return patient;
  }

  async findAll(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.patientType) filter.patientType = query.patientType;
    if (query.bloodGroup) filter.bloodGroup = query.bloodGroup;
    if (query.search) {
      filter.$or = [{ patientId: { $regex: query.search } }];
    }
    const patients = await this.db.find('patients', filter, { sort: { createdAt: -1 } });
    await this.db.populate(patients, {
      as: 'userId',
      table: 'users',
      ref: 'userId',
      select: ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'address', 'avatar'],
    });
    return patients.map(this.flattenUser);
  }

  async findById(id: string): Promise<any> {
    const patient = await this.db.findById('patients', id);
    if (!patient) throw new NotFoundException('Patient not found');
    await this.db.populate([patient], {
      as: 'userId',
      table: 'users',
      ref: 'userId',
      select: ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'address', 'avatar'],
    });
    return this.flattenUser(patient);
  }

  async findByUserId(userId: string): Promise<any> {
    const patient = await this.db.findOne('patients', { userId });
    if (!patient) throw new NotFoundException('Patient profile not found');
    await this.db.populate([patient], {
      as: 'userId',
      table: 'users',
      ref: 'userId',
      select: ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'address', 'avatar'],
    });
    return this.flattenUser(patient);
  }

  async update(id: string, data: any): Promise<any> {
    const patient = await this.db.findById('patients', id);
    if (!patient) throw new NotFoundException('Patient not found');

    const userFields = ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'address', 'status'];
    const userUpdate: any = {};
    const patientUpdate: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (userFields.includes(key)) userUpdate[key] = value ?? '';
      else patientUpdate[key] = value;
    }

    if (Object.keys(userUpdate).length > 0 && patient.userId) {
      await this.db.update('users', patient.userId, userUpdate);
    }

    const updatedPatient = await this.db.update('patients', id, patientUpdate);
    this.gateway.broadcastToAll('patient:updated', updatedPatient);
    return updatedPatient;
  }

  async delete(id: string): Promise<void> {
    const patient = await this.db.findById('patients', id);
    if (!patient) throw new NotFoundException('Patient not found');
    await this.db.delete('patients', id);
    if (patient.userId) {
      await this.db.delete('users', patient.userId);
    }
    this.gateway.broadcastToAll('patient:deleted', { id });
  }

  async getStats(): Promise<any> {
    const total = await this.db.count('patients');
    const byType = await this.db.groupBy('patients', 'patientType');
    const byBloodGroup = await this.db.groupBy('patients', 'bloodGroup', { bloodGroup: { $ne: '' } });
    return { total, byType, byBloodGroup };
  }

  private flattenUser(row: any): any {
    if (!row || !row.userId || typeof row.userId !== 'object') return row;
    const { userId, ...rest } = row;
    Object.assign(rest, userId);
    rest.userId = userId;
    return rest;
  }
}
import { Injectable, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DoctorsService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  async create(data: any): Promise<any> {
    const doctorId = `DR-${Date.now().toString(36).toUpperCase()}`;

    if (data.email) {
      const existing = await this.db.findOne('users', { email: data.email });
      if (existing) throw new ConflictException('Doctor email already exists');

      const hashedPassword = await bcrypt.hash(data.password || 'doctor123', 12);
      const user = await this.db.create('users', {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: hashedPassword,
        phone: data.phone || '',
        role: 'doctor',
        department: data.department || '',
        specialization: data.specialization || '',
        status: 'active',
        gender: data.gender || 'Male',
      });

      const doctor = await this.db.create('doctors', {
        userId: user._id,
        doctorId,
        specialization: data.specialization || '',
        department: data.department || '',
        yearsOfExperience: data.yearsOfExperience ?? data.experienceYears ?? 0,
        education: data.education || data.qualifications || '',
        bio: data.bio || '',
        schedule: data.schedule || [],
        consultationFee: data.consultationFee || 5000,
        isAvailable: true,
        languages: data.languages || ['English'],
        licenseNumber: data.licenseNumber || '',
      });

      this.gateway.broadcastToAll('doctor:created', doctor);
      return doctor;
    }

    const hashedPassword = await bcrypt.hash(data.password || 'doctor123', 12);
    const user = await this.db.create('users', {
      firstName: data.firstName || 'Unknown',
      lastName: data.lastName || 'Staff',
      email: `${Date.now().toString(36)}@doctor.local`,
      password: hashedPassword,
      phone: data.phone || '',
      role: 'doctor',
      department: data.department || '',
      specialization: data.specialization || '',
      status: 'active',
      gender: data.gender || 'Male',
    });

    const doctor = await this.db.create('doctors', {
      userId: user._id,
      doctorId,
      specialization: data.specialization || '',
      department: data.department || '',
      yearsOfExperience: data.yearsOfExperience ?? data.experienceYears ?? 0,
      education: data.education || data.qualifications || '',
      bio: data.bio || '',
      schedule: data.schedule || [],
      consultationFee: data.consultationFee || 5000,
      isAvailable: true,
      languages: data.languages || ['English'],
      licenseNumber: data.licenseNumber || '',
    });

    this.gateway.broadcastToAll('doctor:created', doctor);
    return doctor;
  }

  async findAll(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.specialization) filter.specialization = query.specialization;
    if (query.department) filter.department = query.department;
    if (query.isAvailable !== undefined) filter.isAvailable = query.isAvailable;
    if (query.search) {
      filter.$or = [
        { specialization: { $regex: query.search } },
        { doctorId: { $regex: query.search } },
      ];
    }
    const doctors = await this.db.find('doctors', filter, { sort: { createdAt: -1 } });
    await this.db.populate(doctors, {
      as: 'userId',
      table: 'users',
      ref: 'userId',
      select: ['firstName', 'lastName', 'email', 'phone', 'avatar'],
    });
    return doctors.map(this.flattenUser);
  }

  async findById(id: string): Promise<any> {
    const doctor = await this.db.findById('doctors', id);
    if (!doctor) throw new NotFoundException('Doctor not found');
    await this.db.populate([doctor], {
      as: 'userId',
      table: 'users',
      ref: 'userId',
      select: ['firstName', 'lastName', 'email', 'phone', 'gender', 'avatar'],
    });
    return this.flattenUser(doctor);
  }

  async findByUserId(userId: string): Promise<any> {
    const doctor = await this.db.findOne('doctors', { userId });
    if (!doctor) throw new NotFoundException('Doctor profile not found');
    await this.db.populate([doctor], {
      as: 'userId',
      table: 'users',
      ref: 'userId',
      select: ['firstName', 'lastName', 'email', 'phone', 'gender', 'avatar'],
    });
    return this.flattenUser(doctor);
  }

  async update(id: string, data: any): Promise<any> {
    const doctor = await this.db.findById('doctors', id);
    if (!doctor) throw new NotFoundException('Doctor not found');

    const userFields = ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth', 'address', 'status', 'avatar'];
    const userUpdate: any = {};
    const doctorUpdate: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'qualifications') {
        doctorUpdate.education = value ?? '';
      } else if (key === 'experienceYears') {
        doctorUpdate.yearsOfExperience = value ?? 0;
      } else if (userFields.includes(key)) {
        userUpdate[key] = value ?? '';
      } else {
        doctorUpdate[key] = value;
      }
    }

    if (Object.keys(userUpdate).length > 0 && doctor.userId) {
      await this.db.update('users', doctor.userId, userUpdate);
    }

    const updatedDoctor = await this.db.update('doctors', id, doctorUpdate);
    this.gateway.broadcastToAll('doctor:updated', updatedDoctor);
    return updatedDoctor;
  }

  async delete(id: string): Promise<void> {
    const doctor = await this.db.findById('doctors', id);
    if (!doctor) throw new NotFoundException('Doctor not found');
    await this.db.delete('doctors', id);
    if (doctor.userId) {
      await this.db.delete('users', doctor.userId);
    }
    this.gateway.broadcastToAll('doctor:deleted', { id });
  }

  async getStats(): Promise<any> {
    const total = await this.db.count('doctors');
    const bySpecialization = await this.db.groupBy('doctors', 'specialization');
    const byDepartment = await this.db.groupBy('doctors', 'department', { department: { $ne: '' } });
    const available = await this.db.count('doctors', { isAvailable: true });
    return { total, bySpecialization, byDepartment, available };
  }

  private flattenUser(row: any): any {
    if (!row || !row.userId || typeof row.userId !== 'object') return row;
    const { userId, ...rest } = row;
    Object.assign(rest, userId);
    rest.userId = userId;
    return rest;
  }
}
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class DiagnosesService {
  constructor(private db: DatabaseService) {}

  async listByPatient(patientId: string): Promise<any[]> {
    const diagnoses = await this.db.find(
      'diagnoses',
      { patientId },
      { sort: { createdAt: -1 } },
    );
    await this.db.populate(diagnoses, {
      as: 'doctorId',
      table: 'users',
      ref: 'doctorId',
      select: ['firstName', 'lastName'],
    });
    return diagnoses;
  }

  async create(data: {
    patientId: string;
    doctorId: string;
    diagnosis: string;
    notes?: string;
    date?: string;
  }): Promise<any> {
    return this.db.create('diagnoses', {
      patientId: data.patientId,
      doctorId: data.doctorId,
      diagnosis: data.diagnosis,
      notes: data.notes || '',
      date: data.date || new Date().toISOString(),
      status: 'active',
    });
  }
}
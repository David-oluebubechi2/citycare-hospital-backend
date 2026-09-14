import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class PatientNotesService {
  constructor(private db: DatabaseService) {}

  async listByPatient(patientId: string): Promise<any[]> {
    const notes = await this.db.find(
      'patientnotes',
      { patientId },
      { sort: { createdAt: -1 } },
    );
    await this.db.populate(notes, {
      as: 'doctorId',
      table: 'users',
      ref: 'doctorId',
      select: ['firstName', 'lastName'],
    });
    return notes;
  }

  async create(data: {
    patientId: string;
    doctorId: string;
    note: string;
    date?: string;
    category?: string;
  }): Promise<any> {
    return this.db.create('patientnotes', {
      patientId: data.patientId,
      doctorId: data.doctorId,
      note: data.note,
      date: data.date || new Date().toISOString(),
      category: data.category || 'general',
    });
  }
}
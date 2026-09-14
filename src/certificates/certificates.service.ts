import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CertificatesService {
  constructor(private db: DatabaseService) {}

  async listByDoctor(doctorId: string): Promise<any[]> {
    return this.db.find('certificates', { doctorId }, { sort: { createdAt: -1 } });
  }

  async create(data: {
    doctorId: string;
    name: string;
    type?: string;
    date?: string;
  }): Promise<any> {
    return this.db.create('certificates', {
      doctorId: data.doctorId,
      name: data.name,
      type: data.type || '',
      date: data.date || new Date().toISOString(),
      status: 'active',
    });
  }
}
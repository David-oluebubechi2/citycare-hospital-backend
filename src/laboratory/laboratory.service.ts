import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class LaboratoryService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  // ─────────────────────────────────────────────
  // Lab Test Templates CRUD
  // ─────────────────────────────────────────────

  async createLabTest(data: any): Promise<any> {
    return this.db.create('labtests', data);
  }

  async findAllLabTests(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.category) filter.category = query.category;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search } },
        { category: { $regex: query.search } },
      ];
    }
    return this.db.find('labtests', filter, { sort: { name: 1 } });
  }

  async findLabTestById(id: string): Promise<any> {
    const test = await this.db.findById('labtests', id);
    if (!test) throw new NotFoundException('Lab test not found');
    return test;
  }

  async updateLabTest(id: string, data: any): Promise<any> {
    const test = await this.db.update('labtests', id, data);
    if (!test) throw new NotFoundException('Lab test not found');
    return test;
  }

  async deleteLabTest(id: string): Promise<void> {
    const ok = await this.db.delete('labtests', id);
    if (!ok) throw new NotFoundException('Lab test not found');
  }

  // ─────────────────────────────────────────────
  // Lab Results
  // ─────────────────────────────────────────────

  async requestTest(data: any): Promise<any> {
    const tests = data.tests || [];
    const totalCost = tests.reduce((sum: number, test: any) => sum + test.price, 0);
    const result = await this.db.create('labresults', {
      ...data,
      tests,
      totalCost,
    });
    await this.populateResultLite(result);
    this.gateway.broadcastToRole('laboratory', 'laboratory:new-request', result);
    this.gateway.broadcastToAll('lab:result', result);
    return result;
  }

  async findAllResults(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.patientId) filter.patientId = query.patientId;
    if (query.requestedBy) filter.requestedBy = query.requestedBy;
    if (query.status) filter.status = query.status;

    const results = await this.db.find('labresults', filter, {
      sort: { createdAt: -1 },
    });
    return this.populateResultsLite(results);
  }

  async findResultById(id: string): Promise<any> {
    const result = await this.db.findById('labresults', id);
    if (!result) throw new NotFoundException('Lab result not found');
    await this.db.populate([result], {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId', 'bloodGroup', 'genotype'],
      nested: [
        {
          as: 'userId',
          table: 'users',
          ref: 'userId',
          select: ['firstName', 'lastName', 'email', 'phone', 'gender', 'dateOfBirth'],
        },
      ],
    });
    await this.populateStaff(result);
    return result;
  }

  async updateResult(
    id: string,
    data: { results: any[]; notes?: string; diagnosis?: string; completedBy: string },
  ): Promise<any> {
    const result = await this.db.update('labresults', id, {
      results: data.results,
      notes: data.notes || '',
      diagnosis: data.diagnosis || '',
      status: 'Completed',
      completedBy: data.completedBy,
      completedAt: new Date().toISOString(),
    });
    if (!result) throw new NotFoundException('Lab result not found');

    await this.db.populate([result], {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId'],
      nested: [
        { as: 'userId', table: 'users', ref: 'userId', select: ['firstName', 'lastName'] },
      ],
    });
    await this.populateStaff(result);

    this.gateway.broadcastToAll('laboratory:result-ready', result);
    this.gateway.broadcastToAll('lab:result:updated', result);
    return result;
  }

  async deleteResult(id: string): Promise<void> {
    const ok = await this.db.delete('labresults', id);
    if (!ok) throw new NotFoundException('Lab result not found');
  }

  async getStats(): Promise<any> {
    const totalTests = await this.db.count('labtests');
    const totalResults = await this.db.count('labresults');
    const pendingResults = await this.db.count('labresults', { status: 'Requested' });
    const inProgressResults = await this.db.count('labresults', { status: 'In Progress' });
    const completedResults = await this.db.count('labresults', { status: 'Completed' });
    const totalRevenue = await this.db.sum('labresults', 'totalCost', { status: 'Completed' });
    return {
      totalTests,
      totalResults,
      pendingResults,
      inProgressResults,
      completedResults,
      totalRevenue,
    };
  }

  private async populateResultLite(result: any): Promise<any> {
    await this.db.populate([result], {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId'],
      nested: [{
        as: 'userId',
        table: 'users',
        ref: 'userId',
        select: ['firstName', 'lastName'],
      }],
    });
    await this.populateStaff(result);
    return result;
  }

  private async populateStaff(result: any): Promise<any> {
    await this.db.populate([result], {
      as: 'requestedBy',
      table: 'users',
      ref: 'requestedBy',
      select: ['firstName', 'lastName'],
    });
    await this.db.populate([result], {
      as: 'completedBy',
      table: 'users',
      ref: 'completedBy',
      select: ['firstName', 'lastName'],
    });
    return result;
  }

  private async populateResultsLite(results: any[]): Promise<any[]> {
    await this.db.populate(results, {
      as: 'patientId',
      table: 'patients',
      ref: 'patientId',
      select: ['userId', 'patientId'],
      nested: [
        { as: 'userId', table: 'users', ref: 'userId', select: ['firstName', 'lastName'] },
      ],
    });
    await this.db.populate(results, {
      as: 'requestedBy',
      table: 'users',
      ref: 'requestedBy',
      select: ['firstName', 'lastName'],
    });
    await this.db.populate(results, {
      as: 'completedBy',
      table: 'users',
      ref: 'completedBy',
      select: ['firstName', 'lastName'],
    });
    return results;
  }
}
import { Injectable, NotFoundException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  async create(data: any): Promise<any> {
    const existing = await this.db.findOne('users', { email: data.email });
    if (existing) {
      throw new ConflictException('Email already exists');
    }
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    const user = await this.db.create('users', data);
    this.gateway.broadcastToAll('user:created', user);
    return user;
  }

  async findAll(query: any = {}): Promise<any[]> {
    const filter: any = {};
    if (query.role) filter.role = query.role;
    if (query.department) filter.department = query.department;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { firstName: { $regex: query.search } },
        { lastName: { $regex: query.search } },
        { email: { $regex: query.search } },
      ];
    }
    const users = await this.db.find('users', filter, { sort: { createdAt: -1 } });
    return users.map((u) => this.withoutPassword(u));
  }

  async findById(id: string): Promise<any> {
    const user = await this.db.findById('users', id);
    if (!user) throw new NotFoundException('User not found');
    return this.withoutPassword(user);
  }

  async findByEmail(email: string): Promise<any | null> {
    return this.db.findOne('users', { email });
  }

  async update(id: string, data: any): Promise<any> {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 12);
    }
    const user = await this.db.update('users', id, data);
    if (!user) throw new NotFoundException('User not found');
    const clean = this.withoutPassword(user);
    this.gateway.broadcastToAll('user:updated', clean);
    return clean;
  }

  async delete(id: string): Promise<void> {
    const ok = await this.db.delete('users', id);
    if (!ok) throw new NotFoundException('User not found');
    this.gateway.broadcastToAll('user:deleted', { id });
  }

  async getStats(): Promise<any> {
    const total = await this.db.count('users');
    const byRole = await this.db.groupBy('users', 'role');
    const byDepartment = await this.db.groupBy('users', 'department', { department: { $ne: '' } });
    const byStatus = await this.db.groupBy('users', 'status');
    return { total, byRole, byDepartment, byStatus };
  }

  private withoutPassword(user: any): any {
    if (!user) return user;
    const { password, ...rest } = user;
    return rest;
  }
}
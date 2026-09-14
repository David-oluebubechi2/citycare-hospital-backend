import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class NotificationsService {
  constructor(private db: DatabaseService) {}

  async listByUser(userId: string): Promise<any[]> {
    return this.db.find('notifications', { userId }, { sort: { createdAt: -1 }, limit: 50 });
  }

  async markRead(id: string): Promise<any | null> {
    return this.db.update('notifications', id, { read: true });
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    await this.db.delete('notifications', id);
    return { deleted: true };
  }

  async create(data: {
    userId: string;
    title: string;
    message: string;
    type?: string;
    link?: string;
    category?: string;
  }): Promise<any> {
    return this.db.create('notifications', {
      userId: data.userId,
      title: data.title,
      message: data.message,
      type: data.type || 'info',
      link: data.link || '',
      category: data.category || '',
    });
  }
}
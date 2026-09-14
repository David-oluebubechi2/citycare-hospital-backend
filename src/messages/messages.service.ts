import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EventsGateway } from '../gateway/events.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private db: DatabaseService,
    @Inject(forwardRef(() => EventsGateway)) private gateway: EventsGateway,
  ) {}

  async send(data: {
    senderId: string;
    recipientId: string;
    content: string;
    type?: string;
    attachments?: string[];
  }): Promise<any> {
    const message = await this.db.create('messages', {
      senderId: data.senderId,
      recipientId: data.recipientId,
      content: data.content,
      type: data.type || 'text',
      attachments: data.attachments || [],
    });

    await this.populateUserFromTo(message);

    this.gateway.broadcastToUser(data.recipientId, 'message:received', message);
    this.gateway.broadcastToUser(data.senderId, 'message:sent', message);

    return message;
  }

  async sendGroupMessage(data: {
    senderId: string;
    participants: string[];
    content: string;
    roomId: string;
    groupName?: string;
    type?: string;
  }): Promise<any> {
    const participants = data.participants || [];
    const message = await this.db.create('messages', {
      senderId: data.senderId,
      recipientId: participants[0],
      content: data.content,
      type: data.type || 'text',
      participants,
      roomId: data.roomId,
      isGroupMessage: true,
      groupName: data.groupName || '',
    });

    await this.db.populate([message], {
      as: 'senderId',
      table: 'users',
      ref: 'senderId',
      select: ['firstName', 'lastName', 'avatar'],
    });

    participants.forEach((participantId) => {
      this.gateway.broadcastToUser(participantId, 'message:received', message);
    });

    return message;
  }

  async getConversation(userId1: string, userId2: string, query: any = {}): Promise<any[]> {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await this.db.find(
      'messages',
      {
        $or: [
          { senderId: userId1, recipientId: userId2 },
          { senderId: userId2, recipientId: userId1 },
        ],
      },
      { sort: { createdAt: -1 }, limit, offset: skip },
    );
    return this.populateSenderRecipient(messages);
  }

  async getConversations(userId: string): Promise<any[]> {
    const messages = await this.db.find(
      'messages',
      {
        $or: [{ senderId: userId }, { recipientId: userId }],
      },
      { sort: { createdAt: -1 } },
    );

    const grouped = new Map<string, { last: any; unread: number }>();
    for (const msg of messages) {
      const other = String(msg.senderId) === String(userId) ? msg.recipientId : msg.senderId;
      const key = String(other);
      if (!grouped.has(key)) {
        grouped.set(key, { last: msg, unread: 0 });
      }
      if (String(msg.recipientId) === String(userId) && !msg.read) {
        grouped.get(key)!.unread += 1;
      }
    }

    const otherUserIds = Array.from(grouped.keys());
    let users: any[] = [];
    if (otherUserIds.length) {
      const placeholders = otherUserIds.map((_, i) => `$${i + 1}`);
      users = await this.db.query(
        `SELECT "_id", "firstName", "lastName", "avatar", "role", "email" FROM users WHERE "_id" IN (${placeholders.join(', ')})`,
        otherUserIds,
      );
    }
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const result: any[] = [];
    for (const [key, val] of grouped.entries()) {
      result.push({
        _id: key,
        lastMessage: val.last,
        unreadCount: val.unread,
        otherUser: userById.get(key) || null,
      });
    }
    result.sort((a, b) => {
      const ta = a.lastMessage.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const tb = b.lastMessage.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return tb - ta;
    });
    return result;
  }

  async getRoomMessages(roomId: string, query: any = {}): Promise<any[]> {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await this.db.find(
      'messages',
      { roomId },
      { sort: { createdAt: -1 }, limit, offset: skip },
    );
    await this.db.populate(messages, {
      as: 'senderId',
      table: 'users',
      ref: 'senderId',
      select: ['firstName', 'lastName', 'avatar'],
    });
    return messages;
  }

  async markAsRead(messageId: string): Promise<any> {
    const message = await this.db.update('messages', messageId, {
      read: true,
      readAt: new Date().toISOString(),
    });
    if (!message) throw new NotFoundException('Message not found');
    return message;
  }

  async markConversationAsRead(userId: string, otherUserId: string): Promise<void> {
    await this.db.updateWhere(
      'messages',
      { senderId: otherUserId, recipientId: userId, read: false },
      { read: true, readAt: new Date().toISOString() },
    );
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.db.count('messages', { recipientId: userId, read: false });
  }

  async deleteMessage(messageId: string): Promise<void> {
    const ok = await this.db.delete('messages', messageId);
    if (!ok) throw new NotFoundException('Message not found');
  }

  private async populateUserFromTo(message: any): Promise<any> {
    await this.db.populate([message], {
      as: 'senderId',
      table: 'users',
      ref: 'senderId',
      select: ['firstName', 'lastName', 'avatar'],
    });
    await this.db.populate([message], {
      as: 'recipientId',
      table: 'users',
      ref: 'recipientId',
      select: ['firstName', 'lastName', 'avatar'],
    });
    return message;
  }

  private async populateSenderRecipient(messages: any[]): Promise<any[]> {
    await this.db.populate(messages, {
      as: 'senderId',
      table: 'users',
      ref: 'senderId',
      select: ['firstName', 'lastName', 'avatar'],
    });
    await this.db.populate(messages, {
      as: 'recipientId',
      table: 'users',
      ref: 'recipientId',
      select: ['firstName', 'lastName', 'avatar'],
    });
    return messages;
  }
}
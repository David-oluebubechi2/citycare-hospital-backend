import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.db.findOne('users', { email: dto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.db.create('users', {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email,
      phone: (dto as any).phone || '',
      role: dto.role,
      department: (dto as any).department || '',
      specialization: (dto as any).specialization || '',
      gender: (dto as any).gender || 'Male',
      dateOfBirth: (dto as any).dateOfBirth || '',
      address: (dto as any).address || '',
      password: hashedPassword,
      status: 'active',
    });

    if (dto.role === 'patient') {
      const patientId = `PAT-${Date.now().toString(36).toUpperCase()}`;
      await this.db.create('patients', {
        userId: user._id,
        patientId,
        bloodGroup: (dto as any).bloodGroup || '',
        genotype: (dto as any).genotype || '',
        allergies: (dto as any).allergies || [],
        chronicConditions: (dto as any).chronicConditions || [],
        emergencyContactName: (dto as any).emergencyContactName || '',
        emergencyContactPhone: (dto as any).emergencyContactPhone || '',
        emergencyContactRelation: (dto as any).emergencyContactRelation || '',
        insuranceProvider: (dto as any).insuranceProvider || '',
        insuranceNumber: (dto as any).insuranceNumber || '',
        patientType: (dto as any).patientType || 'New',
      });
    }

    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.db.findOne('users', { email: dto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is not active');
    }

    const token = this.generateToken(user);
    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.db.findById('users', userId);
    if (!user) throw new UnauthorizedException('User not found');
    return this.sanitizeUser(user);
  }

  async updateProfile(
    userId: string,
    data: { firstName?: string; lastName?: string; email?: string; phone?: string; gender?: string; dateOfBirth?: string; address?: string },
  ) {
    const user = await this.db.update('users', userId, data);
    if (!user) throw new UnauthorizedException('User not found');
    return this.sanitizeUser(user);
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.db.findById('users', userId);
    if (!user) throw new UnauthorizedException('User not found');
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const hashed = await bcrypt.hash(newPassword, 12);
    await this.db.update('users', userId, { password: hashed });
    return { message: 'Password updated successfully' };
  }

  private generateToken(user: any): string {
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  private sanitizeUser(user: any) {
    if (!user) return user;
    const { password, ...obj } = user;
    return obj;
  }
}
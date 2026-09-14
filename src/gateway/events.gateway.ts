import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { PatientsService } from '../patients/patients.service';
import { DoctorsService } from '../doctors/doctors.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { PharmacyService } from '../pharmacy/pharmacy.service';
import { LaboratoryService } from '../laboratory/laboratory.service';
import { BillingService } from '../billing/billing.service';
import { MessagesService } from '../messages/messages.service';
import { AiService } from '../ai/ai.service';
import { DiagnosesService } from '../diagnoses/diagnoses.service';
import { PatientNotesService } from '../patient-notes/patient-notes.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CertificatesService } from '../certificates/certificates.service';
import { DatabaseService } from '../database/database.service';
import { getAllowedOrigins } from '../common/origins';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userName?: string;
  authenticated?: boolean;
}

@WebSocketGateway({
  cors: {
    origin: getAllowedOrigins(),
    credentials: true,
  },
  namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private connectedUsers = new Map<string, AuthenticatedSocket>();

  constructor(
    private jwtService: JwtService,
    private db: DatabaseService,
    private authService: AuthService,
    @Inject(forwardRef(() => UsersService)) private usersService: UsersService,
    @Inject(forwardRef(() => PatientsService)) private patientsService: PatientsService,
    @Inject(forwardRef(() => DoctorsService)) private doctorsService: DoctorsService,
    @Inject(forwardRef(() => AppointmentsService)) private appointmentsService: AppointmentsService,
    @Inject(forwardRef(() => PharmacyService)) private pharmacyService: PharmacyService,
    @Inject(forwardRef(() => LaboratoryService)) private laboratoryService: LaboratoryService,
    @Inject(forwardRef(() => BillingService)) private billingService: BillingService,
    @Inject(forwardRef(() => MessagesService)) private messagesService: MessagesService,
    private aiService: AiService,
    private diagnosesService: DiagnosesService,
    private patientNotesService: PatientNotesService,
    private notificationsService: NotificationsService,
    private certificatesService: CertificatesService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.authenticated = false;
        this.logger.log('Client connected without token (anonymous - login/register allowed)');
        return;
      }

      try {
        const payload = this.jwtService.verify(token);
        const user = await this.db.findById('users', payload.sub);

        if (!user) {
          client.authenticated = false;
          client.disconnect(true);
          return;
        }

        client.userId = user._id.toString();
        client.userRole = user.role;
        client.userName = `${user.firstName} ${user.lastName}`;
        client.authenticated = true;

        this.connectedUsers.set(client.id, client);

        client.join(`user:${client.userId}`);
        client.join(`role:${client.userRole}`);
        client.join('broadcast');

        this.logger.log(
          `User connected: ${client.userName} (${client.userRole}) [${client.userId}]`,
        );

        client.emit('connected', {
          userId: client.userId,
          role: client.userRole,
          name: client.userName,
        });
      } catch {
        client.authenticated = false;
        client.disconnect(true);
      }
    } catch (error) {
      client.authenticated = false;
      this.logger.error('Connection error:', error.message);
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedUsers.delete(client.id);
    if (client.userId) {
      this.logger.log(`User disconnected: ${client.userName}`);
    }
  }

  private requireAuth(client: AuthenticatedSocket): boolean {
    if (!client.authenticated) return false;
    return true;
  }

  // ─────────────────────────────────────────────
  // AUTH EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('auth:login')
  async handleLogin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { email: string; password: string; role?: string },
  ) {
    try {
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
      const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

      if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
        return { error: 'Admin credentials not configured on the server.' };
      }

      const isAdminEmail = data.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase();

      if (isAdminEmail) {
        const adminStaffRoles = ['doctor', 'nurse', 'receptionist', 'pharmacist', 'laboratory', 'accountant'];
        const selectedRole = (data.role || 'administrator').toLowerCase();

        if (data.role && data.role.toLowerCase() === 'patient') {
          return {
            error: 'The administrator account cannot sign in to the patient dashboard. Please register and sign in with a patient account.',
          };
        }
        if (!['administrator', ...adminStaffRoles].includes(selectedRole)) {
          return { error: 'Invalid role selected for this account.' };
        }
        if (data.password !== ADMIN_PASSWORD) {
          return { error: 'Invalid admin credentials.' };
        }
        const adminUser = await this.db.findOne('users', { email: ADMIN_EMAIL });
        if (!adminUser) {
          return { error: 'Admin account not found. Please contact support.' };
        }
        const token = this.jwtService.sign({
          sub: adminUser._id.toString(),
          email: adminUser.email,
          role: selectedRole,
        });
        client.userId = adminUser._id.toString();
        client.userRole = selectedRole;
        client.userName = `${adminUser.firstName} ${adminUser.lastName}`;
        client.authenticated = true;
        this.connectedUsers.set(client.id, client);
        client.join(`user:${client.userId}`);
        client.join(`role:${selectedRole}`);
        client.join('broadcast');
        const safeAdminUser = { ...adminUser };
        delete safeAdminUser.password;
        return { user: { ...safeAdminUser, role: selectedRole }, token };
      }

      const result = await this.authService.login(data);

      if (data.role && data.role !== result.user.role) {
        return {
          error: `The selected role does not match this account. ${result.user.firstName} ${result.user.lastName} is registered as ${result.user.role.charAt(0).toUpperCase() + result.user.role.slice(1)}.`,
        };
      }

      if (result.user.role === 'administrator') {
        return { error: 'Administrator access is restricted. Only the super admin can sign in.' };
      }

      client.userId = (result.user as any)._id?.toString() || (result.user as any).id;
      client.userRole = result.user.role;
      client.userName = `${result.user.firstName} ${result.user.lastName}`;
      client.authenticated = true;

      this.connectedUsers.set(client.id, client);
      client.join(`user:${client.userId}`);
      client.join(`role:${client.userRole}`);
      client.join('broadcast');

      return { user: result.user, token: result.token };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('auth:register')
  async handleRegister(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phone?: string;
      role: string;
      department?: string;
      specialization?: string;
    },
  ) {
    try {
      if (data.role === 'administrator') {
        return { error: 'Administrator accounts cannot be created through registration. Contact the super admin.' };
      }
      const result = await this.authService.register(data);
      client.userId = (result.user as any)._id?.toString() || (result.user as any).id;
      client.userRole = result.user.role;
      client.userName = `${result.user.firstName} ${result.user.lastName}`;
      client.authenticated = true;

      this.connectedUsers.set(client.id, client);
      client.join(`user:${client.userId}`);
      client.join(`role:${client.userRole}`);
      client.join('broadcast');

      return { user: result.user, token: result.token };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // USERS EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('users:list')
  async handleUsersList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const users = await this.usersService.findAll(query);
      return users;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('users:stats')
  async handleUsersStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.usersService.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('users:create')
  async handleUserCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const user = await this.usersService.create(data);
      return user;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('users:update')
  async handleUserUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const user = await this.usersService.update(id, updateData);
      return user;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('users:delete')
  async handleUserDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.usersService.delete(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // PATIENTS EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('patients:list')
  async handlePatientsList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const patients = await this.patientsService.findAll(query);
      return patients;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('patients:stats')
  async handlePatientsStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.patientsService.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('patients:create')
  async handlePatientCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const patient = await this.patientsService.create(data);
      return patient;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('patients:update')
  async handlePatientUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const patient = await this.patientsService.update(id, updateData);
      return patient;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('patients:delete')
  async handlePatientDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.patientsService.delete(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // DOCTORS EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('doctors:list')
  async handleDoctorsList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const doctors = await this.doctorsService.findAll(query);
      return doctors;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('doctors:stats')
  async handleDoctorsStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.doctorsService.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('doctors:create')
  async handleDoctorCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const doctor = await this.doctorsService.create(data);
      return doctor;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('doctors:update')
  async handleDoctorUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const doctor = await this.doctorsService.update(id, updateData);
      return doctor;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('doctors:delete')
  async handleDoctorDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.doctorsService.delete(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // APPOINTMENTS EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('appointments:list')
  async handleAppointmentsList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const appointments = await this.appointmentsService.findAll(query);
      return appointments;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('appointments:stats')
  async handleAppointmentsStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.appointmentsService.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('appointments:create')
  async handleAppointmentCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const appointment = await this.appointmentsService.create(data);
      return appointment;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('appointments:update')
  async handleAppointmentUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const appointment = await this.appointmentsService.update(id, updateData);
      return appointment;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('appointments:cancel')
  async handleAppointmentCancel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string; reason: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const appointment = await this.appointmentsService.cancel(data.id, data.reason);
      return appointment;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('appointments:delete')
  async handleAppointmentDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.appointmentsService.delete(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // PHARMACY - MEDICINES EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('pharmacy:medicines:list')
  async handleMedicinesList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const medicines = await this.pharmacyService.findAllMedicines(query);
      return medicines;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('pharmacy:medicines:stats')
  async handlePharmacyStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.pharmacyService.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('pharmacy:medicines:create')
  async handleMedicineCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const medicine = await this.pharmacyService.createMedicine(data);
      return medicine;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('pharmacy:medicines:update')
  async handleMedicineUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const medicine = await this.pharmacyService.updateMedicine(id, updateData);
      return medicine;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('pharmacy:medicines:delete')
  async handleMedicineDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.pharmacyService.deleteMedicine(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('pharmacy:medicines:dispense')
  async handleMedicineDispense(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string; quantity: number },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const medicine = await this.pharmacyService.dispenseMedicine(
        data.id,
        data.quantity,
      );
      return medicine;
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // PHARMACY - PRESCRIPTIONS EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('pharmacy:prescriptions:list')
  async handlePrescriptionsList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const prescriptions = await this.pharmacyService.findAllPrescriptions(query);
      return prescriptions;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('pharmacy:prescriptions:create')
  async handlePrescriptionCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const prescription = await this.pharmacyService.createPrescription(data);
      return prescription;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('pharmacy:prescriptions:update-status')
  async handlePrescriptionUpdateStatus(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string; status: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const prescription = await this.pharmacyService.updatePrescriptionStatus(
        data.id,
        data.status,
      );
      return prescription;
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // LABORATORY - TESTS EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('laboratory:tests:list')
  async handleLabTestsList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const tests = await this.laboratoryService.findAllLabTests(query);
      return tests;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('laboratory:tests:create')
  async handleLabTestCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const test = await this.laboratoryService.createLabTest(data);
      return test;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('laboratory:tests:update')
  async handleLabTestUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const test = await this.laboratoryService.updateLabTest(id, updateData);
      return test;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('laboratory:tests:delete')
  async handleLabTestDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.laboratoryService.deleteLabTest(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // LABORATORY - RESULTS EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('laboratory:results:list')
  async handleLabResultsList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const results = await this.laboratoryService.findAllResults(query);
      return results;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('laboratory:results:stats')
  async handleLabResultsStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.laboratoryService.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('laboratory:results:create')
  async handleLabResultCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const result = await this.laboratoryService.requestTest(data);
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('laboratory:results:update')
  async handleLabResultUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const result = await this.laboratoryService.updateResult(id, updateData);
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('laboratory:results:delete')
  async handleLabResultDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.laboratoryService.deleteResult(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // BILLING EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('billing:invoices:list')
  async handleInvoicesList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const invoices = await this.billingService.findAll(query);
      return invoices;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('billing:invoices:stats')
  async handleBillingStats(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.billingService.getStats();
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('billing:invoices:create')
  async handleInvoiceCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const invoice = await this.billingService.create(data);
      return invoice;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('billing:invoices:update')
  async handleInvoiceUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string } & any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const { id, ...updateData } = data;
      const invoice = await this.billingService.update(id, updateData);
      return invoice;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('billing:invoices:process-payment')
  async handleProcessPayment(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string; amount: number; paymentMethod: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const invoice = await this.billingService.processPayment(data.id, {
        amount: data.amount,
        paymentMethod: data.paymentMethod,
      });
      return invoice;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('billing:invoices:delete')
  async handleInvoiceDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.billingService.delete(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // MESSAGES EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('messages:list')
  async handleMessagesList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() query: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const messages = await this.messagesService.getConversations(
        client.userId,
      );
      return messages;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('messages:send')
  async handleMessageSend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: { recipientId: string; content: string; type?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const message = await this.messagesService.send({
        senderId: client.userId,
        recipientId: data.recipientId,
        content: data.content,
        type: data.type || 'text',
      });
      return message;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('messages:read')
  async handleMessageRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const message = await this.messagesService.markAsRead(data.id);
      return message;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('messages:delete')
  async handleMessageDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      await this.messagesService.deleteMessage(data.id);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // AI EVENTS
  // ─────────────────────────────────────────────

  @SubscribeMessage('ai:symptom-checker')
  async handleSymptomChecker(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      symptoms: string;
      age?: string;
      gender?: string;
      medicalHistory?: string[];
    },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const result = await this.aiService.symptomChecker(
        data.symptoms,
        data.age,
        data.gender,
        data.medicalHistory,
      );
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('ai:medical-summary')
  async handleMedicalSummary(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: any,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const result = await this.aiService.medicalSummary(data);
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('ai:drug-interactions')
  async handleDrugInteractions(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { medications: string[] },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const result = await this.aiService.drugInteractionChecker(
        data.medications,
      );
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('ai:health-tips')
  async handleHealthTips(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { topic?: string; age?: string; gender?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const result = await this.aiService.healthTips(
        data.topic,
        data.age,
        data.gender,
      );
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('ai:chat')
  async handleAiChat(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { message: string; context?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const result = await this.aiService.chat(data.message, data.context);
      return result;
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // ROOM MANAGEMENT
  // ─────────────────────────────────────────────

  @SubscribeMessage('join:room')
  handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    client.join(data.room);
    return { event: 'room:joined', data: { room: data.room } };
  }

  @SubscribeMessage('leave:room')
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ) {
    client.leave(data.room);
    return { event: 'room:left', data: { room: data.room } };
  }

  // ─────────────────────────────────────────────
  // DIAGNOSES
  // ─────────────────────────────────────────────

  @SubscribeMessage('patients:diagnoses:list')
  async handleDiagnosesList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { patient: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.diagnosesService.listByPatient(data.patient);
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('patients:diagnoses:create')
  async handleDiagnosesCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { patient: string; diagnosis: string; notes?: string; date?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.diagnosesService.create({
        patientId: data.patient,
        doctorId: client.userId,
        diagnosis: data.diagnosis,
        notes: data.notes,
        date: data.date,
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // PATIENT NOTES
  // ─────────────────────────────────────────────

  @SubscribeMessage('patients:notes:list')
  async handleNotesList(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { patient: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.patientNotesService.listByPatient(data.patient);
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('patients:notes:create')
  async handleNotesCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { patient: string; note: string; date?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.patientNotesService.create({
        patientId: data.patient,
        doctorId: client.userId,
        note: data.note,
        date: data.date,
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // NOTIFICATIONS
  // ─────────────────────────────────────────────

  @SubscribeMessage('notifications:list')
  async handleNotificationsList(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.notificationsService.listByUser(client.userId);
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('notifications:read')
  async handleNotificationRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.notificationsService.markRead(data.id);
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('notifications:delete')
  async handleNotificationDelete(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.notificationsService.delete(data.id);
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // DOCTOR PROFILE
  // ─────────────────────────────────────────────

  @SubscribeMessage('doctors:profile:get')
  async handleDoctorProfileGet(
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const profile = await this.doctorsService.findByUserId(client.userId);
      return profile || { error: 'Doctor profile not found' };
    } catch (error) {
      return { error: error.message };
    }
  }

  @SubscribeMessage('doctors:profile:update')
  async handleDoctorProfileUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { firstName?: string; lastName?: string; email?: string; phone?: string; specialization?: string; bio?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      if (data.firstName || data.lastName || data.email || data.phone) {
        await this.authService.updateProfile(client.userId, {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
        });
      }
      const profile = await this.doctorsService.findByUserId(client.userId);
      if (profile && (data.specialization || data.bio)) {
        await this.doctorsService.update((profile as any)._id.toString(), {
          ...(data.specialization && { specialization: data.specialization }),
          ...(data.bio && { bio: data.bio }),
        });
      }
      return await this.doctorsService.findByUserId(client.userId);
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // DOCTOR CERTIFICATES
  // ─────────────────────────────────────────────

  @SubscribeMessage('doctors:certificates:create')
  async handleCertificateCreate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { name: string; type?: string; date?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.certificatesService.create({
        doctorId: client.userId,
        name: data.name,
        type: data.type,
        date: data.date,
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // AUTH PASSWORD UPDATE
  // ─────────────────────────────────────────────

  @SubscribeMessage('auth:password:update')
  async handlePasswordUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { currentPassword: string; newPassword: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.authService.updatePassword(client.userId, data.currentPassword, data.newPassword);
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // AUTH PROFILE UPDATE (administrator.tsx sends update data here)
  // ─────────────────────────────────────────────

  @SubscribeMessage('auth:profile')
  async handleAuthProfile(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data?: { firstName?: string; lastName?: string; email?: string; phone?: string; gender?: string; dateOfBirth?: string; address?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      if (data && Object.keys(data).length > 0) {
        return await this.authService.updateProfile(client.userId, data);
      }
      return await this.authService.getProfile(client.userId);
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // BILLING PAY (patient.tsx sends billing:invoices:pay)
  // ─────────────────────────────────────────────

  @SubscribeMessage('billing:invoices:pay')
  async handleInvoicePay(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string; amount?: number; paymentMethod?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      const invoice = await this.billingService.findById(data.id);
      const amount = data.amount || (invoice as any).amountRemaining || (invoice as any).totalAmount || 0;
      return await this.billingService.processPayment(data.id, {
        amount,
        paymentMethod: data.paymentMethod || 'cash',
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // LABORATORY TEST BOOK (patient.tsx sends laboratory:tests:book)
  // ─────────────────────────────────────────────

  @SubscribeMessage('laboratory:tests:book')
  async handleLabTestBook(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { testName: string; date: string; session?: string },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      let patientId: string = client.userId;
      try {
        const patient = await this.patientsService.findByUserId(client.userId);
        patientId = (patient as any)._id.toString();
      } catch {
        // no Patient record yet — fall back to user id
      }
      return await this.laboratoryService.requestTest({
        patientId,
        requestedBy: null,
        tests: [{ name: data.testName, category: 'general', price: 0 }],
        status: 'Requested',
        notes: `Session: ${data.session || 'Morning'}, Date: ${data.date}`,
      });
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // MESSAGES UPDATE (alias for messages:read — doctors.tsx uses this)
  // ─────────────────────────────────────────────

  @SubscribeMessage('messages:update')
  async handleMessageUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { id: string; read?: boolean },
  ) {
    if (!this.requireAuth(client)) return { error: 'Unauthorized' };
    try {
      return await this.messagesService.markAsRead(data.id);
    } catch (error) {
      return { error: error.message };
    }
  }

  // ─────────────────────────────────────────────
  // HELPER / BROADCAST METHODS
  // ─────────────────────────────────────────────

  broadcastToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  broadcastToRole(role: string, event: string, data: any) {
    this.server.to(`role:${role}`).emit(event, data);
  }

  broadcastToAll(event: string, data: any) {
    this.server.to('broadcast').emit(event, data);
  }

  broadcastToRoom(room: string, event: string, data: any) {
    this.server.to(room).emit(event, data);
  }

  sendNotification(
    userId: string,
    notification: { title: string; message: string; type: string },
  ) {
    this.broadcastToUser(userId, 'notification:new', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
    this.notificationsService.create({ ...notification, userId }).catch(() => {
      // ignore persistence failures (e.g. invalid userId)
    });
  }

  getConnectedUsers(): string[] {
    return Array.from(this.connectedUsers.values())
      .filter((c) => c.userId)
      .map((c) => c.userId);
  }

  isUserOnline(userId: string): boolean {
    return Array.from(this.connectedUsers.values()).some(
      (c) => c.userId === userId,
    );
  }
}

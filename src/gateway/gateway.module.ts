import { Module, forwardRef } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { PatientsModule } from '../patients/patients.module';
import { DoctorsModule } from '../doctors/doctors.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { LaboratoryModule } from '../laboratory/laboratory.module';
import { BillingModule } from '../billing/billing.module';
import { MessagesModule } from '../messages/messages.module';
import { DiagnosesModule } from '../diagnoses/diagnoses.module';
import { PatientNotesModule } from '../patient-notes/patient-notes.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    AiModule,
    forwardRef(() => UsersModule),
    forwardRef(() => PatientsModule),
    forwardRef(() => DoctorsModule),
    forwardRef(() => AppointmentsModule),
    forwardRef(() => PharmacyModule),
    forwardRef(() => LaboratoryModule),
    forwardRef(() => BillingModule),
    forwardRef(() => MessagesModule),
    DiagnosesModule,
    PatientNotesModule,
    NotificationsModule,
    CertificatesModule,
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class GatewayModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { DoctorsModule } from './doctors/doctors.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { LaboratoryModule } from './laboratory/laboratory.module';
import { BillingModule } from './billing/billing.module';
import { MessagesModule } from './messages/messages.module';
import { AiModule } from './ai/ai.module';
import { DiagnosesModule } from './diagnoses/diagnoses.module';
import { PatientNotesModule } from './patient-notes/patient-notes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { CertificatesModule } from './certificates/certificates.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    GatewayModule,
    AuthModule,
    UsersModule,
    PatientsModule,
    DoctorsModule,
    AppointmentsModule,
    PharmacyModule,
    LaboratoryModule,
    BillingModule,
    MessagesModule,
    AiModule,
    DiagnosesModule,
    PatientNotesModule,
    NotificationsModule,
    CertificatesModule,
  ],
})
export class AppModule {}
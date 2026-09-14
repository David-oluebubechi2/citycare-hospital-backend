import { Module } from '@nestjs/common';
import { PatientNotesService } from './patient-notes.service';

@Module({
  providers: [PatientNotesService],
  exports: [PatientNotesService],
})
export class PatientNotesModule {}

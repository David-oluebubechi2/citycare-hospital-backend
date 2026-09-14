import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Pharmacy')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  // Medicine endpoints
  @Post('medicines')
  @ApiOperation({ summary: 'Add a new medicine' })
  createMedicine(@Body() body: any) {
    return this.pharmacyService.createMedicine(body);
  }

  @Get('medicines')
  @ApiOperation({ summary: 'Get all medicines' })
  findAllMedicines(@Query() query: any) {
    return this.pharmacyService.findAllMedicines(query);
  }

  @Get('medicines/stats')
  @ApiOperation({ summary: 'Get pharmacy statistics' })
  getStats() {
    return this.pharmacyService.getStats();
  }

  @Get('medicines/:id')
  @ApiOperation({ summary: 'Get medicine by ID' })
  findMedicineById(@Param('id') id: string) {
    return this.pharmacyService.findMedicineById(id);
  }

  @Put('medicines/:id')
  @ApiOperation({ summary: 'Update medicine' })
  updateMedicine(@Param('id') id: string, @Body() body: any) {
    return this.pharmacyService.updateMedicine(id, body);
  }

  @Put('medicines/:id/dispense')
  @ApiOperation({ summary: 'Dispense medicine' })
  dispenseMedicine(@Param('id') id: string, @Body() body: { quantity: number }) {
    return this.pharmacyService.dispenseMedicine(id, body.quantity);
  }

  @Delete('medicines/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete medicine' })
  deleteMedicine(@Param('id') id: string) {
    return this.pharmacyService.deleteMedicine(id);
  }

  // Prescription endpoints
  @Post('prescriptions')
  @ApiOperation({ summary: 'Create a prescription' })
  createPrescription(@Body() body: any) {
    return this.pharmacyService.createPrescription(body);
  }

  @Get('prescriptions')
  @ApiOperation({ summary: 'Get all prescriptions' })
  findAllPrescriptions(@Query() query: any) {
    return this.pharmacyService.findAllPrescriptions(query);
  }

  @Get('prescriptions/:id')
  @ApiOperation({ summary: 'Get prescription by ID' })
  findPrescriptionById(@Param('id') id: string) {
    return this.pharmacyService.findPrescriptionById(id);
  }

  @Put('prescriptions/:id/status')
  @ApiOperation({ summary: 'Update prescription status' })
  updatePrescriptionStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.pharmacyService.updatePrescriptionStatus(id, body.status);
  }
}

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
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Patients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new patient' })
  create(@Body() body: any) {
    return this.patientsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all patients' })
  findAll(@Query() query: any) {
    return this.patientsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get patient statistics' })
  getStats() {
    return this.patientsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient by ID' })
  findOne(@Param('id') id: string) {
    return this.patientsService.findById(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get patient by user ID' })
  findByUserId(@Param('userId') userId: string) {
    return this.patientsService.findByUserId(userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update patient' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.patientsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete patient' })
  remove(@Param('id') id: string) {
    return this.patientsService.delete(id);
  }
}

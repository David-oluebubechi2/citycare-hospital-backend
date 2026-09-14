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
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new appointment' })
  create(@Body() body: any) {
    return this.appointmentsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all appointments' })
  findAll(@Query() query: any) {
    return this.appointmentsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get appointment statistics' })
  getStats() {
    return this.appointmentsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get appointment by ID' })
  findOne(@Param('id') id: string) {
    return this.appointmentsService.findById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update appointment' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.appointmentsService.update(id, body);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel appointment' })
  cancel(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.appointmentsService.cancel(id, body.reason);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete appointment' })
  remove(@Param('id') id: string) {
    return this.appointmentsService.delete(id);
  }
}

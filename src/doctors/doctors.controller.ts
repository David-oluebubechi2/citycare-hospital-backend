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
import { DoctorsService } from './doctors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Doctors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('doctors')
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new doctor' })
  create(@Body() body: any) {
    return this.doctorsService.create(body);
  }

  @Get()
  @ApiOperation({ summary: 'Get all doctors' })
  findAll(@Query() query: any) {
    return this.doctorsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get doctor statistics' })
  getStats() {
    return this.doctorsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get doctor by ID' })
  findOne(@Param('id') id: string) {
    return this.doctorsService.findById(id);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get doctor by user ID' })
  findByUserId(@Param('userId') userId: string) {
    return this.doctorsService.findByUserId(userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update doctor profile' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.doctorsService.update(id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete doctor' })
  remove(@Param('id') id: string) {
    return this.doctorsService.delete(id);
  }
}

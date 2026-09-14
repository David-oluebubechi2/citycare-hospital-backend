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
import { LaboratoryService } from './laboratory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Laboratory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('laboratory')
export class LaboratoryController {
  constructor(private readonly laboratoryService: LaboratoryService) {}

  // Lab Test Templates
  @Post('tests')
  @ApiOperation({ summary: 'Create a lab test template' })
  createLabTest(@Body() body: any) {
    return this.laboratoryService.createLabTest(body);
  }

  @Get('tests')
  @ApiOperation({ summary: 'Get all lab test templates' })
  findAllLabTests(@Query() query: any) {
    return this.laboratoryService.findAllLabTests(query);
  }

  @Get('tests/:id')
  @ApiOperation({ summary: 'Get lab test by ID' })
  findLabTestById(@Param('id') id: string) {
    return this.laboratoryService.findLabTestById(id);
  }

  @Put('tests/:id')
  @ApiOperation({ summary: 'Update lab test' })
  updateLabTest(@Param('id') id: string, @Body() body: any) {
    return this.laboratoryService.updateLabTest(id, body);
  }

  @Delete('tests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete lab test' })
  deleteLabTest(@Param('id') id: string) {
    return this.laboratoryService.deleteLabTest(id);
  }

  // Lab Results
  @Post('results')
  @ApiOperation({ summary: 'Request lab tests' })
  requestTest(@Body() body: any) {
    return this.laboratoryService.requestTest(body);
  }

  @Get('results')
  @ApiOperation({ summary: 'Get all lab results' })
  findAllResults(@Query() query: any) {
    return this.laboratoryService.findAllResults(query);
  }

  @Get('results/stats')
  @ApiOperation({ summary: 'Get laboratory statistics' })
  getStats() {
    return this.laboratoryService.getStats();
  }

  @Get('results/:id')
  @ApiOperation({ summary: 'Get lab result by ID' })
  findResultById(@Param('id') id: string) {
    return this.laboratoryService.findResultById(id);
  }

  @Put('results/:id')
  @ApiOperation({ summary: 'Update lab results with test values' })
  updateResult(@Param('id') id: string, @Body() body: any) {
    return this.laboratoryService.updateResult(id, body);
  }

  @Delete('results/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete lab result' })
  deleteResult(@Param('id') id: string) {
    return this.laboratoryService.deleteResult(id);
  }
}

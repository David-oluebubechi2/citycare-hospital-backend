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
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  @ApiOperation({ summary: 'Create a new invoice' })
  create(@Body() body: any) {
    return this.billingService.create(body);
  }

  @Get('invoices')
  @ApiOperation({ summary: 'Get all invoices' })
  findAll(@Query() query: any) {
    return this.billingService.findAll(query);
  }

  @Get('invoices/stats')
  @ApiOperation({ summary: 'Get billing statistics' })
  getStats() {
    return this.billingService.getStats();
  }

  @Get('invoices/:id')
  @ApiOperation({ summary: 'Get invoice by ID' })
  findOne(@Param('id') id: string) {
    return this.billingService.findById(id);
  }

  @Put('invoices/:id/payment')
  @ApiOperation({ summary: 'Process payment for an invoice' })
  processPayment(@Param('id') id: string, @Body() body: { amount: number; paymentMethod: string }) {
    return this.billingService.processPayment(id, body);
  }

  @Put('invoices/:id')
  @ApiOperation({ summary: 'Update invoice' })
  update(@Param('id') id: string, @Body() body: any) {
    return this.billingService.update(id, body);
  }

  @Delete('invoices/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete invoice' })
  remove(@Param('id') id: string) {
    return this.billingService.delete(id);
  }
}

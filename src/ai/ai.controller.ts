import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { SymptomCheckerDto, MedicalSummaryDto, DrugInteractionDto, HealthTipsDto, AiChatDto } from './dto/ai.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('AI Services')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('symptom-checker')
  @ApiOperation({ summary: 'AI-powered symptom analysis' })
  symptomChecker(@Body() dto: SymptomCheckerDto) {
    return this.aiService.symptomChecker(dto.symptoms, dto.age, dto.gender, dto.medicalHistory);
  }

  @Post('medical-summary')
  @ApiOperation({ summary: 'Generate AI medical record summary' })
  medicalSummary(@Body() dto: MedicalSummaryDto) {
    return this.aiService.medicalSummary(dto);
  }

  @Post('drug-interaction')
  @ApiOperation({ summary: 'Check drug interactions' })
  drugInteraction(@Body() dto: DrugInteractionDto) {
    return this.aiService.drugInteractionChecker(dto.medications);
  }

  @Post('health-tips')
  @ApiOperation({ summary: 'Get personalized health tips' })
  healthTips(@Body() dto: HealthTipsDto) {
    return this.aiService.healthTips(dto.topic, dto.age, dto.gender);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Chat with AI medical assistant' })
  chat(@Body() dto: AiChatDto) {
    return this.aiService.chat(dto.message, dto.context);
  }
}

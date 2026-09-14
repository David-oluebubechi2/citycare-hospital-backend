import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class AiService {
  private openai: OpenAI | null = null;
  private readonly logger = new Logger(AiService.name);
  private hasApiKey: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (apiKey && apiKey !== 'sk-placeholder-replace-with-real-key') {
      this.openai = new OpenAI({ apiKey });
      this.hasApiKey = true;
      this.logger.log('OpenAI API initialized successfully');
    } else {
      this.hasApiKey = false;
      this.logger.warn('OpenAI API key not set - using fallback responses');
    }
  }

  async symptomChecker(symptoms: string, age?: string, gender?: string, medicalHistory?: string[]): Promise<any> {
    const historyText = medicalHistory?.length ? '\nMedical History: ' + medicalHistory.join(', ') : '';
    const patientInfo = [age ? 'Age: ' + age : '', gender ? 'Gender: ' + gender : ''].filter(Boolean).join(', ');

    if (this.hasApiKey && this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant at CityCare Hospital in Nigeria. Analyze the patient symptoms and provide:\n1. Possible conditions (with likelihood)\n2. Recommended actions\n3. When to seek emergency care\n4. Specialist recommendations\n\nAlways include a disclaimer. Use Nigerian Naira for costs. Recommend consulting healthcare professionals.',
            },
            {
              role: 'user',
              content: 'Patient Info: ' + patientInfo + '\nSymptoms: ' + symptoms + historyText,
            },
          ],
          max_tokens: 1500,
          temperature: 0.3,
        });
        return {
          analysis: response.choices[0].message.content,
          disclaimer: 'This AI analysis is for informational purposes only and is not a substitute for professional medical advice.',
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        this.logger.error('OpenAI API error:', error.message);
      }
    }
    return this.fallbackSymptomChecker(symptoms, age, gender, medicalHistory);
  }

  async medicalSummary(patientData: any): Promise<any> {
    if (this.hasApiKey && this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a medical AI assistant at CityCare Hospital. Generate a medical summary including: Patient Overview, Medical History, Current Conditions, Medications, Allergies, Risk Factors, and Recommendations. Use Nigerian Naira for costs.',
            },
            {
              role: 'user',
              content: 'Generate a medical summary for: ' + JSON.stringify(patientData),
            },
          ],
          max_tokens: 2000,
          temperature: 0.2,
        });
        return { summary: response.choices[0].message.content, generatedAt: new Date().toISOString() };
      } catch (error) {
        this.logger.error('OpenAI API error:', error.message);
      }
    }
    return this.fallbackMedicalSummary(patientData);
  }

  async drugInteractionChecker(medications: string[]): Promise<any> {
    if (this.hasApiKey && this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a pharmaceutical AI assistant at CityCare Hospital. Check for drug interactions. For each: Severity, Description, Side Effects, Recommendations, Alternatives. Use Nigerian Naira.',
            },
            {
              role: 'user',
              content: 'Check interactions between: ' + medications.join(', '),
            },
          ],
          max_tokens: 1500,
          temperature: 0.2,
        });
        return { interactions: response.choices[0].message.content, medications, checkedAt: new Date().toISOString() };
      } catch (error) {
        this.logger.error('OpenAI API error:', error.message);
      }
    }
    return this.fallbackDrugInteractionChecker(medications);
  }

  async healthTips(topic?: string, age?: string, gender?: string): Promise<any> {
    const patientContext = [age ? 'Age: ' + age : '', gender ? 'Gender: ' + gender : ''].filter(Boolean).join(', ');
    const topicLine = topic ? '\nFocus on: ' + topic : '';

    if (this.hasApiKey && this.openai) {
      try {
        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a health wellness AI assistant at CityCare Hospital. Provide personalized tips on: Diet, Exercise, Sleep, Stress Management, Preventive Care, Mental Health. Be culturally relevant for Nigerian patients.',
            },
            {
              role: 'user',
              content: 'Patient: ' + patientContext + topicLine,
            },
          ],
          max_tokens: 1500,
          temperature: 0.7,
        });
        return { tips: response.choices[0].message.content, generatedAt: new Date().toISOString() };
      } catch (error) {
        this.logger.error('OpenAI API error:', error.message);
      }
    }
    return this.fallbackHealthTips(topic, age, gender);
  }

  async chat(message: string, context?: string): Promise<any> {
    if (this.hasApiKey && this.openai) {
      try {
        const messages: any[] = [
          { role: 'system', content: 'You are CityCare AI, a medical assistant at CityCare Hospital in Nigeria. Help with health info, symptoms, medications, hospital services, and appointments. Use Naira. Be professional.' },
        ];
        if (context) messages.push({ role: 'user', content: 'Context: ' + context });
        messages.push({ role: 'user', content: message });

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4',
          messages,
          max_tokens: 1000,
          temperature: 0.7,
        });
        return { response: response.choices[0].message.content, timestamp: new Date().toISOString() };
      } catch (error) {
        this.logger.error('OpenAI API error:', error.message);
      }
    }
    return this.fallbackChat(message, context);
  }

  private fallbackSymptomChecker(symptoms: string, age?: string, gender?: string, medicalHistory?: string[]) {
    const s = symptoms.toLowerCase();
    const conditions: any[] = [];
    if (s.includes('headache') || s.includes('fever')) {
      conditions.push({ condition: 'Viral Infection', likelihood: 'High', urgency: 'Low' }, { condition: 'Malaria', likelihood: 'Medium', urgency: 'Medium' });
    }
    if (s.includes('chest')) {
      conditions.push({ condition: 'Musculoskeletal Pain', likelihood: 'Medium', urgency: 'Medium' }, { condition: 'Cardiac Issue', likelihood: 'Low', urgency: 'HIGH' });
    }
    if (s.includes('cough') || s.includes('breath')) {
      conditions.push({ condition: 'Upper Respiratory Infection', likelihood: 'High', urgency: 'Low' }, { condition: 'Pneumonia', likelihood: 'Low', urgency: 'Medium-High' });
    }
    if (conditions.length === 0) {
      conditions.push({ condition: 'General Malaise', likelihood: 'Medium', urgency: 'Low' });
    }
    const analysis = 'Possible Conditions:\n' + conditions.map((c, i) => (i + 1) + '. ' + c.condition + ' (Likelihood: ' + c.likelihood + ', Urgency: ' + c.urgency + ')').join('\n') + '\n\nRecommendations:\n- Rest and stay hydrated\n- Monitor symptoms for 24-48 hours\n- Visit CityCare Hospital if symptoms persist\n- Consultation fee: N5,000 - N15,000';
    return { analysis, disclaimer: 'This is for informational purposes only. Consult a healthcare provider.', timestamp: new Date().toISOString() };
  }

  private fallbackMedicalSummary(patientData: any) {
    return {
      summary: 'Medical Summary Report\n========================\nPatient: ' + (patientData.name || 'N/A') + '\nAge: ' + (patientData.age || 'N/A') + '\n\nThis is a generated summary based on available records. Please consult your physician for a detailed review.\n\nEstimated costs:\n- Consultation: N5,000 - N15,000\n- Basic Lab Tests: N5,000 - N20,000',
      generatedAt: new Date().toISOString(),
    };
  }

  private fallbackDrugInteractionChecker(medications: string[]) {
    const knownInteractions: Record<string, string> = {
      'Warfarin-Aspirin': 'SEVERE: Increased bleeding risk',
      'Metformin-Alcohol': 'MODERATE: Risk of lactic acidosis',
      'Lisinopril-Potassium': 'MODERATE: Risk of hyperkalemia',
      'Ibuprofen-Aspirin': 'MODERATE: Increased GI bleeding risk',
    };
    const found: any[] = [];
    for (let i = 0; i < medications.length; i++) {
      for (let j = i + 1; j < medications.length; j++) {
        const key1 = medications[i] + '-' + medications[j];
        const key2 = medications[j] + '-' + medications[i];
        const interaction = knownInteractions[key1] || knownInteractions[key2];
        if (interaction) {
          found.push({ drugs: medications[i] + ' + ' + medications[j], severity: interaction.split(':')[0], description: interaction.split(': ')[1] });
        }
      }
    }
    return {
      interactions: found.length > 0 ? found : [{ message: 'No known severe interactions found between the listed medications.' }],
      medications,
      checkedAt: new Date().toISOString(),
    };
  }

  private fallbackHealthTips(topic?: string, age?: string, gender?: string) {
    return {
      tips: 'Personalized Health Tips:\n\n1. Diet: Eat a balanced diet rich in vegetables, fruits, lean proteins, and whole grains. Limit salt and sugar intake.\n2. Exercise: Aim for 30 minutes of moderate exercise 5 days a week.\n3. Sleep: Get 7-9 hours of quality sleep nightly.\n4. Hydration: Drink at least 2 liters of water daily.\n5. Mental Health: Practice stress management through meditation or deep breathing.\n6. Preventive Care: Schedule regular checkups at CityCare Hospital.\n\nConsultation: N5,000 | Basic Health Screening: N15,000 - N25,000',
      generatedAt: new Date().toISOString(),
    };
  }

  private fallbackChat(message: string, context?: string) {
    return {
      response: 'Thank you for your question. I am CityCare AI assistant. While I can provide general health information, I recommend consulting with our medical professionals at CityCare Hospital for personalized advice.\n\nOur services:\n- General Consultation: N5,000\n- Specialist Consultation: N10,000 - N25,000\n- Emergency Services: Available 24/7\n\nPlease call +234 704 605 9865 for appointments.',
      timestamp: new Date().toISOString(),
    };
  }
}

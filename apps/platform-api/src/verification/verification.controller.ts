import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../crypto/jwt-auth.guard';
import { VerificationService } from './verification.service';

@Controller('rounds')
@UseGuards(JwtAuthGuard)
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get(':id/verify')
  async verify(@Param('id') id: string) {
    const data = await this.verificationService.getVerificationData(id);
    if (!data) {
      throw new NotFoundException('Round or seed data not found');
    }
    return data;
  }
}

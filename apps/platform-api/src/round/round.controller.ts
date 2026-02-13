import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoundService } from './round.service';

@Controller('api/rounds')
@UseGuards(JwtAuthGuard)
export class RoundController {
  constructor(private readonly roundService: RoundService) {}

  @Get('current')
  async getCurrentRound(@Req() req: any) {
    const { operatorId } = req.user;
    const round = await this.roundService.getCurrentRound(operatorId);
    if (!round) {
      throw new NotFoundException('No active round');
    }
    return round;
  }

  @Get(':id')
  async getRound(@Param('id') id: string) {
    const round = await this.roundService.getRoundById(id);
    if (!round) {
      throw new NotFoundException('Round not found');
    }
    return round;
  }
}

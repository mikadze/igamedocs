import {
  Controller,
  Get,
  Inject,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { REDIS_CLIENT } from '../redis/redis.module';
import { PlayerService } from './player.service';

@Controller('api/player')
@UseGuards(JwtAuthGuard)
export class PlayerController {
  constructor(
    private readonly playerService: PlayerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  @Get('balance')
  async getBalance(@Req() req: any) {
    const { sub: playerId, operatorId } = req.user;

    // Retrieve operator token from session
    const operatorToken = await this.findOperatorToken(operatorId, playerId);
    if (!operatorToken) {
      throw new UnauthorizedException('Session expired or not found');
    }

    return this.playerService.getBalance(operatorId, operatorToken, playerId);
  }

  private async findOperatorToken(
    operatorId: string,
    playerId: string,
  ): Promise<string | null> {
    // Look up the session token from Redis using player's session key
    const tokenKey = `session:token:${operatorId}:${playerId}`;
    return this.redis.get(tokenKey);
  }
}

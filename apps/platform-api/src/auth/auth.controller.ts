import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { HistoryService } from '../history/history.service';
import { SignatureGuard } from './guards/signature.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from '../crypto/token.service';
import { GameLaunchDto } from './dto/game-launch.dto';

@ApiTags('auth')
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly historyService: HistoryService,
  ) {}

  /**
   * Game API: Called by aggregators/operators to launch a game session.
   * Verifies RSA signature, creates player + session, returns game URL.
   * Route is outside /api prefix: POST /game/url
   */
  @Post('/game/url')
  @UseGuards(SignatureGuard)
  @ApiOperation({ summary: 'Launch game session (aggregator/operator call)' })
  async gameLaunch(
    @Body() body: GameLaunchDto,
    @Req() req: any,
  ) {
    const operator = req.operator;
    if (!operator) {
      throw new UnauthorizedException('Operator not resolved');
    }

    return this.authService.handleGameLaunch(body, {
      id: operator.id,
      code: operator.code,
    });
  }

  /**
   * Exchange operator token for internal JWT.
   * Called by the game client after loading in the iFrame.
   */
  @Post('auth/token')
  @ApiOperation({ summary: 'Exchange operator token for internal JWT' })
  async exchangeToken(@Body() body: { token: string }) {
    if (!body.token) {
      throw new BadRequestException('Token is required');
    }

    const result = await this.authService.exchangeToken(body.token);
    if (!result) {
      throw new UnauthorizedException('Invalid or expired session token');
    }

    return result;
  }

  /**
   * Refresh an expired access token.
   */
  @Post('auth/refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(@Body() body: { refreshToken: string }) {
    if (!body.refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const result = this.authService.refreshAccessToken(body.refreshToken);
    if (!result) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    return result;
  }

  /**
   * Get current session info for authenticated player.
   */
  @Get('auth/session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current session info' })
  async getSession(@Req() req: any) {
    const payload: JwtPayload = req.user;
    return this.authService.getSession(payload);
  }

  /**
   * Game API: Called by aggregators for round audit / dispute resolution.
   * Returns full round data: bets, cashouts, seeds, timestamps.
   */
  @Post('/game/round')
  @UseGuards(SignatureGuard)
  @ApiOperation({ summary: 'Get round audit data (aggregator/operator call)' })
  async gameRound(@Body() body: { round_id: string }) {
    if (!body.round_id) {
      throw new BadRequestException('round_id is required');
    }

    const audit = await this.historyService.getRoundAuditData(body.round_id);
    if (!audit) {
      throw new NotFoundException('Round not found');
    }

    return audit;
  }
}

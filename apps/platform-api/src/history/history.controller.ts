import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../crypto/jwt-auth.guard';
import { HistoryService } from './history.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('rounds/history')
  async getRoundHistory(
    @Req() req: any,
    @Query('cursor_ts') cursorTs?: string,
    @Query('cursor_id') cursorId?: string,
    @Query('limit') limit?: string,
  ) {
    const { operatorId } = req.user;
    const cursor =
      cursorTs && cursorId ? { ts: cursorTs, id: cursorId } : undefined;

    return this.historyService.getRoundHistory(
      operatorId,
      cursor,
      limit ? Math.min(parseInt(limit, 10), 50) : undefined,
    );
  }

  @Get('player/bets')
  async getPlayerBets(
    @Req() req: any,
    @Query('cursor_ts') cursorTs?: string,
    @Query('cursor_id') cursorId?: string,
    @Query('limit') limit?: string,
  ) {
    const { operatorPlayerId } = req.user;
    const cursor =
      cursorTs && cursorId ? { ts: cursorTs, id: cursorId } : undefined;

    return this.historyService.getPlayerBetHistory(
      operatorPlayerId,
      cursor,
      limit ? Math.min(parseInt(limit, 10), 50) : undefined,
    );
  }
}

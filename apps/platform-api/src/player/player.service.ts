import { Injectable } from '@nestjs/common';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class PlayerService {
  constructor(private readonly walletService: WalletService) {}

  async getBalance(
    operatorId: string,
    operatorToken: string,
    playerId: string,
  ) {
    return this.walletService.getBalance(operatorId, operatorToken, playerId);
  }
}

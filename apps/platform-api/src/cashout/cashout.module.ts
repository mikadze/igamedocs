import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { CashoutService } from './cashout.service';

@Module({
  imports: [WalletModule],
  providers: [CashoutService],
  exports: [CashoutService],
})
export class CashoutModule {}

import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { WalletService } from './wallet.service';
import { AdapterFactory } from './adapters/adapter.factory';

@Module({
  imports: [CryptoModule],
  providers: [WalletService, AdapterFactory],
  exports: [WalletService, AdapterFactory],
})
export class WalletModule {}

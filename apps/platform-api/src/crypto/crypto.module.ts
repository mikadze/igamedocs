import { Module, Global } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { TokenService } from './token.service';

@Global()
@Module({
  providers: [SignatureService, TokenService],
  exports: [SignatureService, TokenService],
})
export class CryptoModule {}

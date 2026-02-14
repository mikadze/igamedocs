import { Module, Global } from '@nestjs/common';
import { SignatureService } from './signature.service';
import { TokenService } from './token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  providers: [SignatureService, TokenService, JwtAuthGuard],
  exports: [SignatureService, TokenService, JwtAuthGuard],
})
export class CryptoModule {}

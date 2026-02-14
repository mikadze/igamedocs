import { Module } from '@nestjs/common';
import { HistoryModule } from '../history/history.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SignatureGuard } from './guards/signature.guard';

@Module({
  imports: [HistoryModule],
  controllers: [AuthController],
  providers: [AuthService, SignatureGuard],
  exports: [AuthService, SignatureGuard],
})
export class AuthModule {}

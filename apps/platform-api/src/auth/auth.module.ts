import { Module } from '@nestjs/common';
import { HistoryModule } from '../history/history.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SignatureGuard } from './guards/signature.guard';

@Module({
  imports: [HistoryModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SignatureGuard],
  exports: [AuthService, JwtAuthGuard, SignatureGuard],
})
export class AuthModule {}

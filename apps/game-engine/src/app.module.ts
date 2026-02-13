import { Module } from '@nestjs/common';
import { GameConfigModule } from './config/config.module';

@Module({
  imports: [GameConfigModule],
})
export class AppModule {}

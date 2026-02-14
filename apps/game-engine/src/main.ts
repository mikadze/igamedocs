import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();

  console.log(
    `[GameEngine] Engine started for operator: ${process.env.OPERATOR_ID}`,
  );

  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[GameEngine] Received ${signal}, shutting down...`);

    await app.close();
    console.log('[GameEngine] Shutdown complete');
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[GameEngine] Fatal bootstrap error:', err);
  process.exit(1);
});

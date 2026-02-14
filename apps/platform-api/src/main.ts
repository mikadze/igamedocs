import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = (await NestFactory.create(
    AppModule,
    new FastifyAdapter({ logger: false, trustProxy: true }),
    { bufferLogs: true },
  )) as any as NestFastifyApplication;

  app.useLogger(app.get(Logger));
  app.enableCors();

  // Store raw body for RSA signature verification on Game API routes.
  // Fastify: override the JSON content type parser to also store rawBody.
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.removeContentTypeParser('application/json');
  fastifyInstance.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req: any, body: string, done: (err: Error | null, result?: unknown) => void) => {
      try {
        (_req as any).rawBody = body;
        done(null, JSON.parse(body));
      } catch (err) {
        done(err as Error);
      }
    },
  );

  app.setGlobalPrefix('api', {
    exclude: ['/game/url', '/game/round'],
  });
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Aviatrix Platform API')
    .setDescription('Aviatrix.bet crash gaming platform API')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app as any, swaggerConfig);
  SwaggerModule.setup('api/docs', app as any, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Platform API running on http://localhost:${port}`);
  logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();

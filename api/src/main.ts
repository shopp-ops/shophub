import './telemetry';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { MetricsService } from './observability/metrics.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3001',
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });
  app.useLogger(app.get(Logger));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Record HTTP metrics at the Fastify onResponse hook — fires after the last byte
  // is sent, so it captures the full server lifecycle (guards, pipes, serialization,
  // send), unlike a Nest interceptor which only wraps the controller handler.
  const metrics = app.get(MetricsService);
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onResponse', (req, reply, done) => {
    const route: string = req.routeOptions?.url ?? 'unmatched';
    if (!route.startsWith('/metrics')) {
      metrics.record(
        req.method,
        route,
        reply.statusCode,
        reply.elapsedTime / 1000,
        Number(reply.getHeader('content-length') ?? 0),
      );
    }
    done();
  });

  await app.listen(process.env.PORT ?? 3000, '0.0.0.0');
}
void bootstrap();

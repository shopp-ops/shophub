import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { KubernetesModule } from './kubernetes/kubernetes.module';
import { ShopsModule } from './shops/shop.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { ObservabilityModule } from './observability/observability.module';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // Default pino-http req serializer logs all headers, which would leak the
        // bearer JWT into every access-log line.
        redact: ['req.headers.authorization'],
        transport: undefined,
        serializers: {
          req(req) {
            return {
              method: req.method,
              url: req.url,
              userAgent: req.headers['user-agent'],
              ip: req.headers['x-forwarded-for'] ?? req.ip,
            };
          },
        },
      },
    }),
    AuthModule,
    KubernetesModule,
    ShopsModule,
    PrometheusModule.register({
      path: '/metrics',
    }),
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

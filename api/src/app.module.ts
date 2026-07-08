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
        synchronize: config.get('NODE_ENV') !== 'production',
      }),
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: 'info',
        transport: undefined,
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

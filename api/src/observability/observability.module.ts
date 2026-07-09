import { Global, Module } from '@nestjs/common';
import { metricsProviders } from "./metrics.provider";
import { MetricsService } from "./metrics.service";
import { MetricsInterceptor } from './metrics.interceptor';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Global()
@Module({
    imports: [PrometheusModule],
    providers: [MetricsService,
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
        },
         ...metricsProviders],
    exports: [MetricsService],
})
export class ObservabilityModule {}
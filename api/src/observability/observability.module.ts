import { Global, Module } from '@nestjs/common';
import { metricsProviders } from "./metrics.provider";
import { MetricsService } from "./metrics.service";
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Global()
@Module({
    imports: [PrometheusModule],
    providers: [MetricsService, ...metricsProviders],
    exports: [MetricsService],
})
export class ObservabilityModule {}
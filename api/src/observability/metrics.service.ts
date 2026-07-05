import { Injectable, Inject } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requests: Counter<string>,

    @InjectMetric('http_request_duration_seconds')
    private readonly duration: Histogram<string>,

    @InjectMetric('http_response_size_bytes')
    private readonly responseSize: Counter<string>,
  ) {}

  record(method: string, route: string, status: number, durationSeconds: number, responseSize: number) {
    const labels = { method, route, status: status.toString() };
    console.log('INC LABELS', labels);
    this.requests.inc(labels);
    this.duration.observe(labels, durationSeconds);
    this.responseSize.inc({ route }, responseSize);
  }
}
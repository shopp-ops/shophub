import { Injectable } from '@nestjs/common';
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

    @InjectMetric('shop_created_total')
    public shopCreated: Counter<string>,

    @InjectMetric('shop_deleted_total')
    public shopDeleted: Counter<string>,

    @InjectMetric('shop_fetched_total')
    public shopFetched: Counter<string>,

    @InjectMetric('shop_operation_duration_seconds')
    public shopDuration: Histogram<string>,

    @InjectMetric('user_created_total')
    public userCreated: Counter<string>,

    @InjectMetric('user_operation_duration_seconds')
    public userDuration: Histogram<string>,
  ) {}

  record(method: string, route: string, status: number, durationSeconds: number, responseSize: number) {
    const labels = { method, route, status: status.toString() };
    this.requests.inc(labels);
    this.duration.observe(labels, durationSeconds);
    this.responseSize.inc({ route }, responseSize);
  }
}
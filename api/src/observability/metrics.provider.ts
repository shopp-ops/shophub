import { makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';

export const metricsProviders = [
  makeCounterProvider({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
  }),

  makeHistogramProvider({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  }),

  makeCounterProvider({
    name: 'http_response_size_bytes',
    help: 'Response size in bytes',
    labelNames: ['route'],
  }),

  makeCounterProvider({
    name: 'shop_created_total',
    help: 'Total number of shops created',
  }),

  makeCounterProvider({
    name: 'shop_deleted_total',
    help: 'Total number of shops deleted',
  }),

  makeCounterProvider({
    name: 'shop_fetched_total',
    help: 'Total number of shop fetch operations',
  }),

  makeCounterProvider({
    name: 'user_created_total',
    help: 'Total users created',
  }),
];
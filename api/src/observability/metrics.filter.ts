import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { MetricsService } from './metrics.service';

@Catch()
export class MetricsExceptionFilter implements ExceptionFilter {
  constructor(private readonly metrics: MetricsService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();
    const res = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : 500;

    const duration = 0;

    this.metrics.record(req.method, req.route?.path ?? req.url, status, duration, 0);

    //throw exception;
  }
}
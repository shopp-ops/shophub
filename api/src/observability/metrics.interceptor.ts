import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { catchError, tap } from "rxjs";
import { throwError } from 'rxjs';
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    console.log('pogodio interceptor');
    const start = process.hrtime();

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap(() => {
        const [sec, nano] = process.hrtime(start);
        const duration = sec + nano / 1e9;

        const route = req.route?.path ?? req.url;

        if (route === '/metrics') return;

        const status = res.statusCode;

        const size = Number(res.getHeader?.('content-length') ?? 0);

        console.log('METRIC INPUT', {
                            method: req.method,
                            route,
                            status: res.statusCode,
                            });
        this.metrics.record(req.method, route, status, duration, size);
      }),

      /*catchError((err) => {
        const [sec, nano] = process.hrtime(start);
        const duration = sec + nano / 1_000_000_000;
        const route = req.route?.path ?? req.url;

        const status = err?.status || err?.statusCode || 500;

        this.metrics.record(req.method, route, status, duration, 0);

        return throwError(() => err);
     }),*/
    );
  }
}
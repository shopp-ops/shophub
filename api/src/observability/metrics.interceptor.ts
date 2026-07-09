import { Injectable, NestInterceptor, ExecutionContext, CallHandler, HttpException } from "@nestjs/common";
import { catchError, tap, throwError } from "rxjs";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const start = process.hrtime();

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    // The Prometheus endpoint is served by the adapter, not a Nest route — skip it.
    if ((req.url ?? '').startsWith('/metrics')) return next.handle();

    // Matched route pattern only — never the raw URL, which carries IDs and would
    // explode Prometheus label cardinality (especially on 404s).
    const route: string =
      req.routeOptions?.url ?? req.routerPath ?? req.route?.path ?? 'unmatched';

    const elapsed = () => {
      const [sec, nano] = process.hrtime(start);
      return sec + nano / 1e9;
    };

    return next.handle().pipe(
      tap(() => {
        const size = Number(res.getHeader?.('content-length') ?? 0);
        this.metrics.record(req.method, route, res.statusCode, elapsed(), size);
      }),
      // Record failures too, then rethrow so Nest's default filter builds the response.
      catchError((err) => {
        const status =
          err instanceof HttpException ? err.getStatus() : (err?.status ?? err?.statusCode ?? 500);
        this.metrics.record(req.method, route, status, elapsed(), 0);
        return throwError(() => err);
      }),
    );
  }
}
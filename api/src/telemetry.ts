import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// OTEL_EXPORTER_OTLP_ENDPOINT (injected via the shophub chart) is the bare
// collector origin, e.g. "http://alloy.observability.svc:4318" — the OTLP
// HTTP spec requires the signal-specific path appended (/v1/traces), which
// the exporter's `url` option does NOT add automatically once you pass one
// explicitly. Passing the endpoint straight through silently 404s every
// export — the /v1/traces suffix here only ever applied to the fallback
// default, not the env-provided value actually used in every real deploy.
const otlpEndpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://alloy.observability.svc:4318').replace(/\/$/, '');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SemanticResourceAttributes.SERVICE_NAME]: 'shophub-api',
  }),

  traceExporter: new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  }),

  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
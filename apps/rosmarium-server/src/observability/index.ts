import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { config } from '../config.js';

export const prometheusExporter = new PrometheusExporter({ port: 9464 });

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: config.OTEL_SERVICE_NAME || "rosmarium-server",
  }),
  // @ts-ignore
  traceExporter: config.OTEL_EXPORTER_OTLP_ENDPOINT
    ? new OTLPTraceExporter({ url: config.OTEL_EXPORTER_OTLP_ENDPOINT + "/v1/traces" })
    : undefined,
  metricReader: prometheusExporter,
  instrumentations: [getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-fs': { enabled: false },
  })],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown()
    .then(() => console.log('Tracing terminated'))
    .catch((error) => console.log('Error terminating tracing', error))
    .finally(() => process.exit(0));
});

export { sdk };

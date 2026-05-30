import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('rosmarium-server');

export const httpRequestsTotal = meter.createCounter('rosmarium_http_requests_total', {
  description: 'Total number of HTTP requests',
});

export const httpRequestDuration = meter.createHistogram('rosmarium_http_request_duration_seconds', {
  description: 'Duration of HTTP requests in seconds',
  unit: 's',
});

export const contentEntriesTotal = meter.createUpDownCounter('rosmarium_content_entries_total', {
  description: 'Total number of content entries per type',
});

export const embeddingQueueDepth = meter.createObservableGauge('rosmarium_embedding_queue_depth', {
  description: 'Number of jobs in the embedding queue',
});

export const intelligenceQueueDepth = meter.createObservableGauge('rosmarium_intelligence_queue_depth', {
  description: 'Number of jobs in the intelligence queue',
});

export const webhookDeliverySuccessTotal = meter.createCounter('rosmarium_webhook_delivery_success_total', {
  description: 'Total successful webhook deliveries',
});

export const webhookDeliveryFailureTotal = meter.createCounter('rosmarium_webhook_delivery_failure_total', {
  description: 'Total failed webhook deliveries',
});

export const activeTenants = meter.createObservableGauge('rosmarium_active_tenants', {
  description: 'Number of active tenants',
});

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { httpRequestsTotal, httpRequestDuration } from './metrics.js';

export const observabilityPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request, reply) => {
    (request as any).startTime = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions.url || 'unknown';
    const method = request.method;
    const statusCode = reply.statusCode.toString();

    const labels = { method, route, status_code: statusCode };

    httpRequestsTotal.add(1, labels);

    const startTime = (request as any).startTime;
    if (startTime) {
      const durationNanos = Number(process.hrtime.bigint() - startTime);
      httpRequestDuration.record(durationNanos / 1e9, labels);
    }
  });

  // Expose /metrics endpoint for Prometheus
  fastify.get('/metrics', async (request, reply) => {
    // Note: The @opentelemetry/exporter-prometheus handles the actual /metrics 
    // endpoint on the port we defined (9464) in observability/index.ts
    // This is just a redirect or info if they hit the app directly.
    return { status: 'Metrics are exported on port 9464' };
  });
});

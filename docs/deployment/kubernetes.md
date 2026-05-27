# Rosmarium CMS: Kubernetes Deployment

Rosmarium CMS is designed to be cloud-native and deployable on Kubernetes via Helm.

## Architecture

The Helm chart (`deploy/helm/rosmarium`) provisions:
- **Rosmarium Server**: The primary Fastify API and GraphQL endpoint (`rosmarium-server`).
- **Rosmarium AI Worker**: The asynchronous background worker for ML/AI tasks (`rosmarium-ai-worker`).

It expects external dependencies (PostgreSQL, Redis) to be provided via managed services (e.g., RDS, ElastiCache) or separate stateful deployments.

## Prerequisites

1. Kubernetes 1.25+
2. Helm 3.0+
3. PostgreSQL 15+ (with `pgvector` extension)
4. Redis 7.0+

## Installation

1. Create a `values-prod.yaml` overriding your sensitive environment variables (or rely on External Secrets).
2. Install the chart:

```bash
helm install rosmarium ./deploy/helm/rosmarium -f values-prod.yaml -n rosmarium-cms --create-namespace
```

## Scaling

Both the server and worker come with HorizontalPodAutoscalers (HPA).
- Server scales based on HTTP traffic and generic CPU/Memory utilization.
- AI Worker should scale based on BullMQ queue depth (Custom Metrics API), though the default chart uses standard CPU/Mem metrics.

## Ingress

Enable the ingress in your `values.yaml` to expose the CMS:

```yaml
ingress:
  enabled: true
  className: nginx
  hosts:
    - host: cms.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
```

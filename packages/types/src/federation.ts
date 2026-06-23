export interface RemoteSource {
  id: string;
  name: string;
  type: 'graphql' | 'rest' | 'openapi';
  endpoint: string;
  auth: RemoteSourceAuth;
  schema?: {
    introspectionUrl?: string;
    openApiSpec?: string;
  };
  cacheConfig: {
    ttl: number;
    staleWhileRevalidate: boolean;
    invalidationWebhook?: string;
  };
  fieldMappings?: FieldMapping[];
  rateLimiting: {
    maxRequestsPerMinute: number;
    burstSize: number;
  };
  status: 'active' | 'paused' | 'error';
  healthCheckUrl?: string;
}

export type RemoteSourceAuth =
  | { type: 'apiKey'; header: string; key: string }
  | { type: 'bearer'; token: string }
  | { type: 'oauth2'; clientId: string; clientSecret: string; tokenUrl: string }
  | { type: 'none' };

export interface FieldMapping {
  remoteField: string;
  localField: string;
  type?: string;
}

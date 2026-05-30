export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  contentTypes: string[];
  isActive: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
  responseCode: number | null;
  responseBody: string | null;
  durationMs: number | null;
  success: boolean;
  attempt: number;
  createdAt: string;
}

export async function listWebhooks(): Promise<Webhook[]> {
  const res = await fetch('/api/webhooks');
  if (!res.ok) throw new Error('Failed to fetch webhooks');
  const json = await res.json() as { data: Webhook[] };
  return json.data || [];
}

export interface CreateWebhookInput {
  name: string;
  url: string;
  secret?: string;
  events: string[];
  contentTypes: string[];
}

export async function createWebhook(input: CreateWebhookInput): Promise<Webhook> {
  const res = await fetch('/api/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create webhook');
  const json = await res.json() as { data: Webhook };
  return json.data;
}

export async function updateWebhook(id: string, patch: Partial<Webhook>): Promise<Webhook> {
  const res = await fetch(`/api/webhooks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update webhook');
  const json = await res.json() as { data: Webhook };
  return json.data;
}

export async function deleteWebhook(id: string): Promise<void> {
  const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete webhook');
}

export async function getDeliveries(webhookId: string): Promise<WebhookDelivery[]> {
  const res = await fetch(`/api/webhooks/${webhookId}/deliveries?limit=20`);
  if (!res.ok) throw new Error('Failed to fetch deliveries');
  const json = await res.json() as { data: WebhookDelivery[] };
  return json.data || [];
}

export async function replayDelivery(webhookId: string, deliveryId: string): Promise<void> {
  const res = await fetch(`/api/webhooks/${webhookId}/deliveries/${deliveryId}/replay`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to replay delivery');
}

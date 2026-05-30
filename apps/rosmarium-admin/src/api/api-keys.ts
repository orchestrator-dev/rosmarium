export interface ApiKey {
  id: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopes: string[];
  expiresAt?: string;
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey;
  rawKey: string;
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await fetch('/api/auth/api-keys');
  if (!res.ok) throw new Error('Failed to fetch API keys');
  const json = await res.json() as { data: ApiKey[] };
  return json.data || [];
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreateApiKeyResponse> {
  const res = await fetch('/api/auth/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create API key');
  const json = await res.json() as { data: CreateApiKeyResponse };
  return json.data;
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(`/api/auth/api-keys/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to revoke API key');
}

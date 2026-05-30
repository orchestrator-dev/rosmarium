import { ContentType, ContentTypeInput } from '../components/content-type-builder/types';

export async function listContentTypes(): Promise<ContentType[]> {
  const res = await fetch('/api/content-types');
  if (!res.ok) throw new Error('Failed to fetch content types');
  const json = await res.json() as { data: ContentType[] };
  return json.data || [];
}

export async function createContentType(input: ContentTypeInput): Promise<ContentType> {
  const res = await fetch('/api/content-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to create content type');
  const json = await res.json() as { data: ContentType };
  return json.data;
}

export async function updateContentType(name: string, patch: Partial<ContentTypeInput>): Promise<ContentType> {
  const res = await fetch(`/api/content-types/${name}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update content type');
  const json = await res.json() as { data: ContentType };
  return json.data;
}

export async function archiveContentType(name: string): Promise<void> {
  const res = await fetch(`/api/content-types/${name}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to archive content type');
}

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface InviteUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
}

export async function listUsers(): Promise<User[]> {
  const res = await fetch('/api/users');
  if (!res.ok) throw new Error('Failed to fetch users');
  const json = await res.json() as { data: User[] };
  return json.data || [];
}

export async function updateUser(id: string, patch: { role?: string; isActive?: boolean }): Promise<User> {
  const res = await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to update user');
  const json = await res.json() as { data: User };
  return json.data;
}

export async function inviteUser(input: InviteUserInput): Promise<User> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json() as { error?: { message?: string } };
    throw new Error(err.error?.message || 'Failed to invite user');
  }
  const json = await res.json() as { data: User };
  return json.data;
}

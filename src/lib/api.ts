const TOKEN_KEY = 'bb_auth_token';
const ROLE_KEY = 'bb_auth_role';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRole(): 'player' | 'admin' | null {
  return localStorage.getItem(ROLE_KEY) as 'player' | 'admin' | null;
}

export function setAuth(token: string, role: 'player' | 'admin') {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.dispatchEvent(new CustomEvent('auth:expired'));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export async function login(password: string, role: 'player' | 'admin') {
  const data = await api<{ token: string; role: 'player' | 'admin' }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ password, role }),
  });
  setAuth(data.token, data.role);
  return data;
}

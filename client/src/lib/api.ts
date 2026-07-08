const API_BASE = '/api';

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });

  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export async function uploadJar(file: File): Promise<void> {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('jar', file);
  const res = await fetch(`${API_BASE}/client/upload-jar`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Upload failed');
}

export async function downloadJar(): Promise<Blob> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/client/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    localStorage.clear();
    window.location.href = '/login';
  }
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || 'Download failed');
  }
  return res.blob();
}

export async function getJarInfo(): Promise<{ exists: boolean; size?: number }> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/client/jar-info`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return res.json();
}

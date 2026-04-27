const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}: ${response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export async function postJson<TResponse, TBody = unknown>(path: string, body?: TBody): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function patchJson<TResponse, TBody = unknown>(path: string, body?: TBody): Promise<TResponse> {
  return requestJson<TResponse>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

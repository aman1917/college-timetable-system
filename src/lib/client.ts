'use client';

/** Thin fetch wrapper that surfaces the API's error message instead of a status code. */
export async function api<T = unknown>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const fields = body?.fields as { path: string; message: string }[] | undefined;
    const detail = fields?.length
      ? fields.map((f) => `${f.path}: ${f.message}`).join('\n')
      : body?.error;
    throw new Error(detail || `Request failed (${response.status}).`);
  }
  return body as T;
}

export const get = <T,>(url: string) => api<T>(url);
export const post = <T,>(url: string, data: unknown) =>
  api<T>(url, { method: 'POST', body: JSON.stringify(data) });
export const put = <T,>(url: string, data: unknown) =>
  api<T>(url, { method: 'PUT', body: JSON.stringify(data) });
export const del = <T,>(url: string) => api<T>(url, { method: 'DELETE' });

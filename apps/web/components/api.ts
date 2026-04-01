const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function getApiBase(): string {
  return API_BASE;
}


export class NetError extends Error {}

export interface ApiResult { ok: boolean; status: number; data: any } // eslint-disable-line @typescript-eslint/no-explicit-any

export async function api(path: string, init: { method?: string; body?: unknown } = {}): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method || "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new NetError("Tidak ada koneksi");
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

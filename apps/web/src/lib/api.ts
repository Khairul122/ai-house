export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  // Header khusus wajib untuk permintaan yang mengubah data; situs lain tidak bisa mengirimnya (penangkal CSRF).
  const headers = method === "GET" ? init?.headers : { ...init?.headers, "X-House": "1" };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      // NestJS mengirim { message } untuk galat yang sengaja dilempar
      const body = JSON.parse(text) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {
      // bukan JSON, pakai teks mentah
    }
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

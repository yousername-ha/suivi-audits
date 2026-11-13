/* Client de l'API : session par cookie, jeton CSRF sur toute requête modifiante, erreurs en français. */

let csrf: string | null = null;
export const setCsrf = (t: string | null) => {
  csrf = t;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly data: Record<string, unknown> | null,
  ) {
    super(message);
  }
}

interface Opts {
  body?: unknown;
  raw?: Blob | ArrayBuffer;
  headers?: Record<string, string>;
  ifMatch?: number | string;
}

export async function api<T = unknown>(method: string, url: string, o: Opts = {}): Promise<T> {
  const h: Record<string, string> = { Accept: 'application/json', ...(o.headers ?? {}) };
  if (csrf && method !== 'GET' && method !== 'HEAD') h['X-CSRF-Token'] = csrf;
  if (o.ifMatch !== undefined) h['If-Match'] = typeof o.ifMatch === 'number' ? `"${o.ifMatch}"` : o.ifMatch;
  let body: BodyInit | undefined;
  if (o.raw !== undefined) {
    body = o.raw;
    h['Content-Type'] = 'application/octet-stream';
  } else if (o.body !== undefined) {
    body = JSON.stringify(o.body);
    h['Content-Type'] = 'application/json';
  } else if (method !== 'GET' && method !== 'HEAD' && method !== 'DELETE') {
    body = '{}';
    h['Content-Type'] = 'application/json';
  }
  let r: Response;
  try {
    r = await fetch(url, { method, headers: h, body, credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifiez la connexion réseau.', null);
  }
  if (r.status === 204) return undefined as T;
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await r.json().catch(() => null) : null;
  if (!r.ok) {
    const msg = (data && typeof data.error === 'string' && data.error) || `Erreur ${r.status}`;
    throw new ApiError(r.status, msg, data);
  }
  return (data ?? (await r.text().catch(() => ''))) as T;
}

export const get = <T>(url: string) => api<T>('GET', url);
export const post = <T>(url: string, body?: unknown) => api<T>('POST', url, { body });
export const del = <T>(url: string) => api<T>('DELETE', url);

/** Téléchargement d'un fichier servi par l'API (pièce jointe). */
export function download(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Enregistre un contenu produit côté navigateur (rapport d'import…). */
export function saveBlob(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

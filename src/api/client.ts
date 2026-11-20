let memoryCsrfToken = '';

export function setCsrfToken(token: string) {
  memoryCsrfToken = token;
}

function getCsrfFromCookie(): string {
  if (typeof document === 'undefined') return memoryCsrfToken;
  const match = document.cookie.match(/(?:^|;\s*)dcms_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : memoryCsrfToken;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = getCsrfFromCookie();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

const secretPattern = /(password|secret|token|authorization|api[_-]?key|database[_-]?url)\s*[:=]\s*[^\s,;]+/gi;

export function reportClientError(source: string, error: unknown): void {
  const rawMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const message = rawMessage.replace(secretPattern, '$1=[redacted]').replace(/[\r\n\t]+/g, ' ').slice(0, 500);
  const route = typeof window === 'undefined' ? '' : window.location.pathname.slice(0, 200);
  if (typeof window === 'undefined' || typeof fetch !== 'function') return;

  void fetch('/api/client-errors', {
    method: 'POST',
    credentials: 'same-origin',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, message, route }),
  }).catch(() => {
    // Error reporting must never make the menu unusable.
  });
}

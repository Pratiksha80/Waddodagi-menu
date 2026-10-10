import { createHash } from 'node:crypto';

export interface ErrorAlert {
  source: string;
  summary: string;
  route?: string;
  code?: string;
}

export interface ErrorAlertConfig {
  apiKey?: string;
  from?: string;
  to?: string;
}

const COOLDOWN_MS = 15 * 60 * 1000;
const HOURLY_EMAIL_LIMIT = 10;
const REQUEST_TIMEOUT_MS = 5000;

function safeText(value: string | undefined, maxLength: number): string {
  return (value || 'Not provided')
    .replace(/(password|secret|token|authorization|api[_-]?key|database[_-]?url)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[\r\n\t]+/g, ' ')
    .slice(0, maxLength);
}

export class ResendErrorAlerts {
  private readonly recentlySent = new Map<string, number>();
  private hourlyWindowStartedAt = Date.now();
  private emailsSentThisHour = 0;

  constructor(private readonly config: ErrorAlertConfig, private readonly request: typeof fetch = fetch) {}

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.from && this.config.to);
  }

  async notify(alert: ErrorAlert): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const safeAlert = {
      source: safeText(alert.source, 80),
      summary: safeText(alert.summary, 500),
      route: safeText(alert.route, 200),
      code: safeText(alert.code, 80),
    };
    const now = Date.now();
    for (const [signature, sentAt] of this.recentlySent) {
      if (now - sentAt >= COOLDOWN_MS) this.recentlySent.delete(signature);
    }
    if (now - this.hourlyWindowStartedAt >= 60 * 60 * 1000) {
      this.hourlyWindowStartedAt = now;
      this.emailsSentThisHour = 0;
    }
    const signature = createHash('sha256').update(JSON.stringify(safeAlert)).digest('hex');
    if (this.recentlySent.has(signature) || this.emailsSentThisHour >= HOURLY_EMAIL_LIMIT) return false;

    // Reserve the cooldown before sending so simultaneous copies of one error do not fan out.
    this.recentlySent.set(signature, now);
    this.emailsSentThisHour += 1;
    const text = [
      'Waddodagi Digital Menu reported an application error.',
      '',
      `Source: ${safeAlert.source}`,
      `Route: ${safeAlert.route}`,
      `Code: ${safeAlert.code}`,
      `Summary: ${safeAlert.summary}`,
      `Time (UTC): ${new Date(now).toISOString()}`,
      '',
      'Sensitive values and stack traces are intentionally excluded.',
    ].join('\n');

    try {
      const response = await this.request('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.config.from,
          to: [this.config.to],
          subject: `[Waddodagi] ${safeAlert.source} error${safeAlert.code === 'Not provided' ? '' : ` (${safeAlert.code})`}`,
          text,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        console.error('Error alert email delivery failed.', { status: response.status });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error alert email delivery failed.', { name: error instanceof Error ? error.name : 'UnknownError' });
      return false;
    }
  }
}

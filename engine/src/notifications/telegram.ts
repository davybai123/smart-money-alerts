import { createLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';

const log = createLogger('notifications/telegram');

// ─── Types ─────────────────────────────────────────────────────────────────

export interface DailyReport {
  date: string;
  videosProduced: number;
  videosUploaded: number;
  totalViews: number;
  estimatedRevenue: number;
  bestPerformer: { title: string; ctr: number } | null;
  topOpportunity: string;
}

// ─── Core send ──────────────────────────────────────────────────────────────

export async function sendMessage(text: string): Promise<void> {
  const botToken = process.env.BOT_TOKEN;
  const chatId = process.env.CHAT_ID;

  if (!botToken || !chatId) {
    log.warn('BOT_TOKEN or CHAT_ID not set — skipping Telegram notification');
    return;
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  await withRetry(
    async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Telegram API error ${response.status}: ${body}`
        );
      }

      const json = await response.json() as { ok: boolean; description?: string };
      if (!json.ok) {
        throw new Error(`Telegram API returned ok=false: ${json.description ?? 'unknown error'}`);
      }
    },
    {
      maxAttempts: 3,
      delayMs: 2000,
      backoff: true,
      label: 'telegram.sendMessage',
    }
  );

  log.debug('Telegram message sent', { length: text.length });
}

// ─── Daily report ────────────────────────────────────────────────────────────

export async function sendDailyReport(report: DailyReport): Promise<void> {
  const revenueFormatted = report.estimatedRevenue.toFixed(2);
  const bestPerformerLine = report.bestPerformer
    ? `📈 Best performer: <b>${escapeHtml(report.bestPerformer.title)}</b> (${report.bestPerformer.ctr.toFixed(1)}% CTR)`
    : '📈 Best performer: N/A';

  const message = [
    '🎬 <b>FacelessYT Daily Report</b>',
    `📅 ${escapeHtml(report.date)}`,
    '',
    `✅ Videos produced: <b>${report.videosProduced}</b>`,
    `📤 Videos uploaded: <b>${report.videosUploaded}</b>`,
    `👀 Total views today: <b>${report.totalViews.toLocaleString()}</b>`,
    `💰 Est. revenue: <b>$${revenueFormatted}</b>`,
    bestPerformerLine,
    '',
    `⚡ Top opportunity tomorrow: <b>${escapeHtml(report.topOpportunity)}</b>`,
  ].join('\n');

  log.info('Sending daily report to Telegram', { date: report.date });
  await sendMessage(message);
}

// ─── Alert ────────────────────────────────────────────────────────────────────

export async function sendAlert(
  level: 'info' | 'warning' | 'error',
  message: string
): Promise<void> {
  const icons: Record<typeof level, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '🚨',
  };

  const levelLabels: Record<typeof level, string> = {
    info: 'INFO',
    warning: 'WARNING',
    error: 'ERROR',
  };

  const text = `${icons[level]} <b>[${levelLabels[level]}]</b> ${escapeHtml(message)}`;

  log.info('Sending Telegram alert', { level, message });
  await sendMessage(text);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

import { createLogger } from './logger';

const log = createLogger('lib/retry');

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoff: boolean;
  label: string;
}

/**
 * Retry a function up to maxAttempts times with optional exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, delayMs, backoff, label } = options;

  let lastError: Error = new Error(`${label}: no attempts made`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      log.debug(`${label}: attempt ${attempt}/${maxAttempts}`);
      const result = await fn();
      if (attempt > 1) {
        log.info(`${label}: succeeded on attempt ${attempt}`);
      }
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      const isLastAttempt = attempt === maxAttempts;
      if (isLastAttempt) {
        log.error(`${label}: all ${maxAttempts} attempts failed`, {
          error: lastError.message,
        });
        break;
      }

      const wait = backoff
        ? delayMs * Math.pow(2, attempt - 1)
        : delayMs;

      log.warn(`${label}: attempt ${attempt} failed — retrying in ${wait}ms`, {
        error: lastError.message,
      });

      await sleep(wait);
    }
  }

  throw new Error(
    `${label}: failed after ${maxAttempts} attempts. Last error: ${lastError.message}`
  );
}

/**
 * Wrap a promise in a hard timeout. Throws if it doesn't resolve in time.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  } finally {
    if (timer !== null) {
      clearTimeout(timer);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

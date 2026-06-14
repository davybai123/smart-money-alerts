import Anthropic from '@anthropic-ai/sdk';
import { createLogger } from './logger';
import { withRetry } from './retry';

const log = createLogger('lib/claude');

const DEFAULT_MODEL = 'claude-sonnet-4-6';
const DEFAULT_MAX_TOKENS = 8192;

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface GenerateOptions {
  maxTokens?: number;
  model?: string;
}

/**
 * Generate text content from a prompt.
 */
export async function generateContent(
  prompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const model = options.model ?? DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;

  return withRetry(
    async () => {
      const client = getClient();

      log.debug('Calling Claude API', { model, promptLength: prompt.length });

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      });

      log.info('Claude API response received', {
        model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      return textBlock.text;
    },
    {
      maxAttempts: 3,
      delayMs: 2000,
      backoff: true,
      label: 'claude.generateContent',
    }
  );
}

/**
 * Generate JSON-structured output from a prompt.
 * Appends schema instructions and parses the result automatically.
 */
export async function generateJSON<T>(
  prompt: string,
  schema: string,
  options: GenerateOptions = {}
): Promise<T> {
  const augmentedPrompt = `${prompt}

Return ONLY valid JSON matching this schema:
${schema}

Do not include any explanation, markdown code fences, or extra text outside the JSON.`;

  const raw = await generateContent(augmentedPrompt, options);

  // Strip markdown code fences if model wrapped the output
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    log.error('Failed to parse JSON from Claude response', {
      raw: raw.slice(0, 500),
      error: err instanceof Error ? err.message : String(err),
    });
    throw new Error(
      `Claude returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

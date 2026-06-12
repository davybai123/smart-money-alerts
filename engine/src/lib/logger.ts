import winston from 'winston';

const { combine, timestamp, colorize, printf, json, errors } = winston.format;

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const IS_DEV = process.env.NODE_ENV !== 'production';

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, module: mod, stack, ...meta }) => {
    const moduleTag = mod ? ` [${mod}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    const stackStr = stack ? `\n${stack}` : '';
    return `${ts} ${level}${moduleTag}: ${message}${metaStr}${stackStr}`;
  })
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: IS_DEV ? devFormat : prodFormat,
  transports: [
    new winston.transports.Console(),
  ],
  exitOnError: false,
});

/**
 * Create a child logger scoped to a specific module.
 * Usage: const log = createLogger('discovery/trends');
 */
export function createLogger(module: string): winston.Logger {
  return logger.child({ module });
}

export default logger;

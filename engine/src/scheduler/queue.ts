import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import IORedis from 'ioredis';
import { createLogger } from '../lib/logger';

const log = createLogger('scheduler/queue');

// ─── Job type definitions ────────────────────────────────────────────────────

export type JobTypes = {
  'discover-trends': { queries: string[]; limit: number };
  'produce-script': { opportunityId: string };
  'produce-video': { scriptId: string };
  'upload-video': { videoId: string };
  'collect-analytics': Record<string, never>;
  'run-feedback': Record<string, never>;
  'send-report': Record<string, never>;
};

// ─── Default job options ─────────────────────────────────────────────────────

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  removeOnComplete: 100,
  removeOnFail: 50,
};

// ─── Redis connection ────────────────────────────────────────────────────────

function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const redis = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,   // required by BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  redis.on('connect', () => log.info('Redis connected', { url: redisUrl }));
  redis.on('error', (err) => log.error('Redis error', { error: err.message }));
  redis.on('reconnecting', () => log.warn('Redis reconnecting...'));

  return redis;
}

export const connection: IORedis = createRedisConnection();

// ─── Queue factory ───────────────────────────────────────────────────────────

const _queues = new Map<string, Queue>();

export function createQueue<T extends keyof JobTypes>(name: T): Queue<JobTypes[T]> {
  if (_queues.has(name)) {
    return _queues.get(name) as Queue<JobTypes[T]>;
  }

  const queue = new Queue<JobTypes[T]>(name, {
    connection: connection as unknown as ConnectionOptions,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  queue.on('error', (err) => {
    log.error(`Queue error on "${name}"`, { error: err.message });
  });

  _queues.set(name, queue);
  log.debug(`Queue "${name}" created`);
  return queue;
}

// ─── Worker factory ──────────────────────────────────────────────────────────

export function createWorker<T extends keyof JobTypes>(
  name: T,
  processor: (job: Job<JobTypes[T]>) => Promise<void>
): Worker<JobTypes[T]> {
  const worker = new Worker<JobTypes[T]>(
    name,
    async (job) => {
      log.info(`Processing job "${name}"`, { jobId: job.id, data: job.data });
      const start = Date.now();
      try {
        await processor(job);
        log.info(`Job "${name}" completed`, {
          jobId: job.id,
          durationMs: Date.now() - start,
        });
      } catch (err) {
        log.error(`Job "${name}" failed`, {
          jobId: job.id,
          durationMs: Date.now() - start,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
    {
      connection: connection as unknown as ConnectionOptions,
      concurrency: 1,
    }
  );

  worker.on('failed', (job, err) => {
    log.error(`Worker "${name}" job failed permanently`, {
      jobId: job?.id,
      error: err.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    log.error(`Worker "${name}" error`, { error: err.message });
  });

  log.debug(`Worker "${name}" started`);
  return worker;
}

// ─── Pre-built queues ─────────────────────────────────────────────────────────

export const contentQueue = createQueue('discover-trends');
export const analyticsQueue = createQueue('collect-analytics');

import 'dotenv/config';
import express, { Request, Response } from 'express';
import { startAutonomousScheduler, runPhaseNow } from './scheduler/autonomous';
import { createLogger } from './lib/logger';

const logger = createLogger('main');

// ─── Health check HTTP server ─────────────────────────────────────────────────

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(express.json());

app.get('/health', (_: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'faceless-yt-engine',
  });
});

/**
 * POST /api/trigger/:phase
 * Manually trigger any scheduler phase by name.
 *
 * Example: POST /api/trigger/analytics-phase
 *
 * Available phases:
 *   discover-and-score, research-phase, script-phase, asset-phase,
 *   upload-phase, analytics-phase, feedback-phase, report-phase
 */
app.post('/api/trigger/:phase', async (req: Request, res: Response) => {
  const { phase } = req.params;

  logger.info(`Manual trigger received for phase: ${phase}`);

  // Fire and forget — respond immediately so the client doesn't time out
  res.json({
    status: 'triggered',
    phase,
    timestamp: new Date().toISOString(),
  });

  try {
    await runPhaseNow(phase);
    logger.info(`Manual phase "${phase}" completed`);
  } catch (err) {
    logger.error(`Manual phase "${phase}" failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get('/api/phases', (_: Request, res: Response) => {
  res.json({
    phases: [
      'discover-and-score',
      'research-phase',
      'script-phase',
      'asset-phase',
      'upload-phase',
      'analytics-phase',
      'feedback-phase',
      'report-phase',
    ],
  });
});

app.listen(PORT, () => {
  logger.info(`Engine health server running on port ${PORT}`);
});

// ─── Start autonomous scheduler ───────────────────────────────────────────────

startAutonomousScheduler();
logger.info('FacelessYT autonomous engine started');

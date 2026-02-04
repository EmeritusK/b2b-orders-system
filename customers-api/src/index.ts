import app from './server';
import { logger } from './lib/logger';

const PORT = Number(process.env.PORT) || 3001;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server listening on http://localhost:${PORT}`);
});

server.on('error', (err: NodeJS.ErrnoException) => {
  logger.error({ err, port: PORT }, 'Server error');
  process.exit(1);
});

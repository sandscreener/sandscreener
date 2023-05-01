import logger from './logger';
import app from './app';
import * as dotenv from 'dotenv';
dotenv.config();
const port = app.get('port');
const server = app.listen(port);

process.on('unhandledRejection', (reason, p) =>
  logger.error('Unhandled Rejection at: Promise ', p, reason)
);

server.on('listening', () => {
  logger.info('Feathers application started on http://%s:%d', app.get('host'), port);
  logger.info('DB connections string is: %s', app.get('postgres'));
  logger.info('NODE_ENV is: %s', process.env.NODE_ENV);
});

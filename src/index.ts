import app from './app';

export default app;

// If run directly via node/tsx, delegate to server.ts
if (require.main === module) {
  require('./server');
}
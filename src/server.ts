import { createServer } from 'http';
import app from './app';
import { env } from './config/environment';
import { initializeWebSocket } from './websocket';
import { initializeScheduler } from './jobs';

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

const PORT = env.PORT || 5000;
const server = createServer(app);

let wsServer: any = null;
let scheduler: any = null;

// Only initialize WebSockets and Schedulers if not running in Vercel serverless environment
if (!process.env.VERCEL) {
  try {
    wsServer = initializeWebSocket(server);
    console.log('✅ WebSocket initialized');
  } catch (error) {
    console.error('❌ WebSocket initialization failed:', error);
  }

  try {
    scheduler = initializeScheduler();
    if (scheduler && scheduler.start) {
      scheduler.start();
      console.log('✅ Job scheduler initialized');
    }
  } catch (error) {
    console.error('❌ Scheduler initialization failed:', error);
  }
}

server.listen(PORT, () => {
  console.log(`🚀 Rekaz Petroleum API server running on port ${PORT}`);
  console.log(`📚 Environment: ${env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
});

// Graceful shutdown
const handleShutdown = (signal: string) => {
  console.log(`🛑 ${signal} received, shutting down...`);
  if (wsServer && wsServer.close) wsServer.close();
  if (scheduler && scheduler.stop) scheduler.stop();
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

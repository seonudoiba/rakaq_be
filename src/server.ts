import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { createServer } from 'http';
import { initializeWebSocket } from './websocket';
import { initializeScheduler } from './jobs';
import { env } from './config/environment';
import { logger } from './config/logger';
import { limiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import usersRoutes from './modules/users/users.routes';
import stationsRoutes from './modules/stations/stations.routes';
import salesRoutes from './modules/sales/sales.routes';
import purchasesRoutes from './modules/purchases/purchases.routes';
import pumpsRoutes from './modules/pumps/pumps.routes';
import expensesRoutes from './modules/expenses/expenses.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import logisticsRoutes from './modules/logistics/logistics.routes';
import employeesRoutes from './modules/employees/employees.routes';
import reportsRoutes from './modules/reports/reports.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import settingsRoutes from './modules/settings/settings.routes';
import supportRoutes from './modules/support/support.routes';
import regionsRoutes from './modules/regions/regions.routes';


// Global error handlers - catch everything
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🚀 Starting server...');

try {
  console.log('📦 Creating Express app...');
  const app = express();

  console.log('🔧 Setting up middleware...');
  
  // Setup middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
  }));

  app.use(cors({
    origin: env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  }));

  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());
  app.use(limiter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
      uptime: process.uptime(),
    });
  });

  // API status
  app.get('/api/v1/status', (req, res) => {
    res.json({
      success: true,
      message: 'Rekaz Petroleum API is running',
      version: '1.0.0',
    });
  });

  console.log('🗺️ Setting up routes...');
  
  // Routes
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/users', usersRoutes);
  app.use('/api/v1/stations', stationsRoutes);
  app.use('/api/v1/sales', salesRoutes);
  app.use('/api/v1/purchases', purchasesRoutes);
  app.use('/api/v1/pumps', pumpsRoutes);
  app.use('/api/v1/expenses', expensesRoutes);
  app.use('/api/v1/inventory', inventoryRoutes);
  app.use('/api/v1/logistics', logisticsRoutes);
  app.use('/api/v1/employees', employeesRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/analytics', analyticsRoutes);
  app.use('/api/v1/settings', settingsRoutes);
  app.use('/api/v1/support', supportRoutes);
  app.use('/api/v1/regions', regionsRoutes);

  // Error handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  console.log('🌐 Creating HTTP server...');
  
  // Start server
  const PORT = env.PORT || 5000;
  const server = createServer(app);

  console.log('🔌 Initializing WebSocket...');
  
  // Initialize WebSocket
  let wsServer = null;
  try {
    wsServer = initializeWebSocket(server);
    console.log('✅ WebSocket initialized');
  } catch (error) {
    console.error('❌ WebSocket initialization failed:', error);
    // Continue without WebSocket
  }

  console.log('⏰ Initializing Job Scheduler...');
  
  // Initialize Job Scheduler
  let scheduler = null;
  try {
    scheduler = initializeScheduler();
    if (scheduler && scheduler.start) {
      scheduler.start();
      console.log('✅ Job scheduler initialized');
    }
  } catch (error) {
    console.error('❌ Scheduler initialization failed:', error);
    // Continue without scheduler
  }

  server.listen(PORT, () => {
    console.log(`🚀 Rekaz Petroleum API server running on port ${PORT}`);
    console.log(`📚 Environment: ${env.NODE_ENV || 'development'}`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down...');
    if (wsServer && wsServer.close) wsServer.close();
    if (scheduler && scheduler.stop) scheduler.stop();
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down...');
    if (wsServer && wsServer.close) wsServer.close();
    if (scheduler && scheduler.stop) scheduler.stop();
    server.close(() => process.exit(0));
  });

  console.log('✅ Server setup complete!');

} catch (error) {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
}
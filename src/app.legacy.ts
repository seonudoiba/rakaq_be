import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { createServer, Server } from 'http';
import { initializeWebSocket } from './websocket';
import { initializeScheduler } from './jobs';
import { env } from './config/environment';
import { logger } from './config/logger';
import { limiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

// Import routes
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


export class App {
  private app: express.Application;
  private server: Server | null = null;
  private wsServer: any = null;
  private scheduler: any = null;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // Security
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
        },
      },
    }));

    // CORS
    this.app.use(cors({
      origin: env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    }));

    // Compression
    this.app.use(compression());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Cookie parsing
    this.app.use(cookieParser());

    // Rate limiting
    this.app.use(limiter);

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
      });
      next();
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
        uptime: process.uptime(),
      });
    });

    // API status
    this.app.get('/api/v1/status', (req, res) => {
      res.json({
        success: true,
        message: 'Rekaz Petroleum API is running',
        version: '1.0.0',
        modules: [
          'auth', 'users', 'stations', 'sales', 'purchases', 'pumps',
          'expenses', 'inventory', 'logistics', 'employees', 'reports',
          'analytics', 'settings', 'support'
        ],
      });
    });
  }

  private setupRoutes(): void {
    // Public routes
    this.app.use('/api/v1/auth', authRoutes);

    this.app.use('/api/v1/users', usersRoutes);
    this.app.use('/api/v1/stations', stationsRoutes);
    this.app.use('/api/v1/sales', salesRoutes);
    this.app.use('/api/v1/purchases', purchasesRoutes);
    this.app.use('/api/v1/pumps', pumpsRoutes);
    this.app.use('/api/v1/expenses', expensesRoutes);
    this.app.use('/api/v1/inventory', inventoryRoutes);
    this.app.use('/api/v1/logistics', logisticsRoutes);
    this.app.use('/api/v1/employees', employeesRoutes);
    this.app.use('/api/v1/reports', reportsRoutes);
    this.app.use('/api/v1/analytics', analyticsRoutes);
    this.app.use('/api/v1/settings', settingsRoutes);
    this.app.use('/api/v1/support', supportRoutes);
    this.app.use('/api/v1/regions', regionsRoutes);
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);
  }

  public start(): void {
    const PORT = env.PORT || 5000;

    // Create HTTP server
    this.server = this.app.listen(PORT, () => {
      logger.info(`🚀 Rekaz Petroleum API server running on port ${PORT}`);
      logger.info(`📚 Environment: ${env.NODE_ENV || 'development'}`);
      logger.info(`🔗 API URL: http://localhost:${PORT}/api/v1`);
    });

    // Initialize WebSocket
    if (this.server) {
      this.wsServer = initializeWebSocket(this.server);
      logger.info('📡 WebSocket server initialized');
    }

    // Initialize Job Scheduler
    this.scheduler = initializeScheduler();
    if (this.scheduler && this.scheduler.start) {
      this.scheduler.start();
      logger.info('⏰ Job scheduler initialized');
    }

    // Setup graceful shutdown
    this.setupGracefulShutdown();
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);

      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      if (this.scheduler && this.scheduler.stop) {
        this.scheduler.stop();
        logger.info('Scheduler stopped');
      }

      if (this.wsServer && this.wsServer.close) {
        this.wsServer.close(() => {
          logger.info('WebSocket server closed');
        });
      }

      const timeout = setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);

      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGQUIT', () => shutdown('SIGQUIT'));

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled Rejection:', reason);
      shutdown('unhandledRejection');
    });
  }

  public stop(): void {
    logger.info('Stopping application...');
    
    if (this.server) {
      this.server.close(() => {
        logger.info('Server closed');
      });
    }

    if (this.scheduler && this.scheduler.stop) {
      this.scheduler.stop();
    }

    if (this.wsServer && this.wsServer.close) {
      this.wsServer.close();
    }
  }
}

// Export the class directly (not an instance)
export default App;
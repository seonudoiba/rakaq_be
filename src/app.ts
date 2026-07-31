import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { env } from './config/environment';
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

const app = express();

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
      },
    },
  })
);

// Flexible CORS setup
// app.use(
//   cors({
//     origin: (origin, callback) => {
//       const allowedOrigin = env.FRONTEND_URL;
//       if (!origin || allowedOrigin === '*' || !allowedOrigin) {
//         return callback(null, true);
//       }
//       const origins = allowedOrigin.split(',').map((o) => o.trim());
//       if (origins.includes(origin)) {
//         return callback(null, true);
//       }
//       return callback(null, true);
//     },
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow all origins for testing
      // This will work with your HTTPS frontend
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Authorization']
  })
);

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(limiter);

// Root route for quick verification
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Rekaz Petroleum API is running',
    version: '1.0.0',
    documentation: '/api/v1/status',
  });
});

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

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

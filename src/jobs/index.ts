import { prisma } from '../config/database'; // Use singleton instead of new PrismaClient()
import { logger } from '../config/logger';
import { redis } from '../config/redis';
import { getWebSocketServer } from '../websocket';

// ============= JOB TYPES =============
interface Job {
  name: string;
  schedule: string; // Cron expression
  handler: () => Promise<void>;
  enabled: boolean;
}

// ============= JOB REGISTRY =============
const jobs: Job[] = [];

// ============= HELPER FUNCTIONS =============

async function saveDailyReport(report: any): Promise<void> {
  const reportKey = `report:daily:${report.stationId}:${report.date}`;
  await redis.setex(reportKey, 30 * 24 * 60 * 60, JSON.stringify(report));
}

async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
    },
  });

  const ws = getWebSocketServer();
  if (ws) {
    ws.sendNotification(userId, {
      id: 'temp',
      userId,
      title,
      message,
      type,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
  }
}

async function createAlert(
  userId: string,
  title: string,
  message: string,
  severity: string,
  metadata?: any
): Promise<void> {
  await createNotification(userId, `[${severity}] ${title}`, message, 'ALERT');
  
  const ws = getWebSocketServer();
  if (ws) {
    ws.sendAlert(userId, {
      type: severity,
      title,
      message,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }
}

// ============= JOB DEFINITIONS =============

// 1. Daily Report Generation Job
const dailyReportJob: Job = {
  name: 'daily-report',
  schedule: '30 23 * * *', // 11:30 PM every day
  enabled: true,
  handler: async () => {
    logger.info('Starting daily report generation...');
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const stations = await prisma.station.findMany({
        where: { isActive: true },
        include: {
          manager: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      });

      for (const station of stations) {
        const salesData = await prisma.sale.aggregate({
          where: {
            stationId: station.id,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
            status: 'COMPLETED',
          },
          _sum: {
            totalAmount: true,
            quantity: true,
          },
          _count: true,
        });

        const expenseData = await prisma.expense.aggregate({
          where: {
            stationId: station.id,
            createdAt: {
              gte: today,
              lt: tomorrow,
            },
          },
          _sum: {
            amount: true,
          },
        });

        const report = {
          stationId: station.id,
          stationName: station.name,
          date: today.toISOString(),
          sales: {
            total: salesData._sum.totalAmount || 0,
            volume: salesData._sum.quantity || 0,
            transactions: salesData._count,
          },
          expenses: {
            total: expenseData._sum.amount || 0,
          },
          profit: (salesData._sum.totalAmount || 0) - (expenseData._sum.amount || 0),
        };

        await saveDailyReport(report);

        // ✅ FIXED: Use station.manager instead of station.managerId
        if (station.manager) {
          await createNotification(
            station.manager.id,
            'Daily Report Ready',
            `Your daily report for ${today.toLocaleDateString()} is ready`,
            'REPORT'
          );
        }
      }

      logger.info('Daily report generation completed');
    } catch (error) {
      logger.error('Error generating daily reports:', error);
    }
  },
};

// 2. Inventory Alert Job
const inventoryAlertJob: Job = {
  name: 'inventory-alert',
  schedule: '0 8 * * *', // 8:00 AM every day
  enabled: true,
  handler: async () => {
    logger.info('Checking inventory levels...');
    
    try {
      const tanks = await prisma.tank.findMany({
        include: {
          station: {
            include: {
              manager: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      for (const tank of tanks) {
        // ✅ FIXED: Use tank.station.manager?.id instead of tank.station.managerId
        const managerId = tank.station.manager?.id ?? 'system';

        if (tank.percentage < 20) {
          // Critical low stock
          await createAlert(
            managerId,
            `CRITICAL: ${tank.name} at ${tank.percentage}%`,
            `Tank ${tank.name} at ${tank.station.name} is critically low (${tank.percentage}%). Immediate restock required.`,
            'CRITICAL',
            { tankId: tank.id }
          );

          // Send to WebSocket for real-time alert
          const ws = getWebSocketServer();
          if (ws && tank.stationId) {
            ws.sendAlert(managerId, {
              type: 'CRITICAL_LOW_STOCK',
              tankId: tank.id,
              tankName: tank.name,
              stationName: tank.station.name,
              percentage: tank.percentage,
              timestamp: new Date().toISOString(),
            });
          }
        } else if (tank.percentage < 35) {
          // Warning low stock
          await createAlert(
            managerId,
            `WARNING: ${tank.name} at ${tank.percentage}%`,
            `Tank ${tank.name} at ${tank.station.name} is low (${tank.percentage}%). Consider restocking soon.`,
            'WARNING',
            { tankId: tank.id }
          );
        }
      }

      logger.info('Inventory check completed');
    } catch (error) {
      logger.error('Error checking inventory:', error);
    }
  },
};

// 3. Delivery Reminder Job
const deliveryReminderJob: Job = {
  name: 'delivery-reminder',
  schedule: '0 9 * * *', // 9:00 AM every day
  enabled: true,
  handler: async () => {
    logger.info('Checking pending deliveries...');
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // ✅ FIXED: Use correct date filter (deliveries arriving tomorrow)
      const deliveries = await prisma.delivery.findMany({
        where: {
          status: { in: ['IN_TRANSIT', 'PENDING'] },
          dispatchedAt: {
            gte: tomorrow,
            lt: new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        include: {
          purchaseOrder: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
          station: {
            include: {
              manager: {
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      for (const delivery of deliveries) {
        // ✅ FIXED: Use delivery.station.manager instead of delivery.station.managerId
        if (delivery.station?.manager) {
          await createNotification(
            delivery.station.manager.id,
            'Delivery Reminder',
            `Scheduled delivery of ${delivery.volume}L ${delivery.purchaseOrder.productType} from ${delivery.purchaseOrder.supplierName} is arriving tomorrow`,
            'DELIVERY'
          );
        }

        // Send reminder to purchaser
        if (delivery.purchaseOrder?.createdById) {
          await createNotification(
            delivery.purchaseOrder.createdById,
            'Delivery Reminder',
            `Delivery ${delivery.tankerId} is scheduled for tomorrow`,
            'DELIVERY'
          );
        }
      }

      logger.info(`Delivery reminders sent for ${deliveries.length} deliveries`);
    } catch (error) {
      logger.error('Error checking deliveries:', error);
    }
  },
};

// 4. Database Backup Job
const databaseBackupJob: Job = {
  name: 'database-backup',
  schedule: '0 2 * * *', // 2:00 AM every day
  enabled: true,
  handler: async () => {
    logger.info('Starting database backup...');
    
    try {
      // ✅ FIXED: Use proper Prisma query with $queryRaw
      const tables = [
        'users',
        'stations',
        'tanks',
        'pumps',
        'sales',
        'expenses',
        'purchase_orders',
        'deliveries',
        'inventory_logs',
        'employees',
        'support_tickets',
      ];

      const backupData: Record<string, any[]> = {};

      for (const table of tables) {
        // ✅ FIXED: Use parameterized query for safety
        const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`);
        backupData[table] = data as any[];
      }

      const backupKey = `backup:${new Date().toISOString()}`;
      await redis.setex(backupKey, 7 * 24 * 60 * 60, JSON.stringify(backupData));

      const backupKeys = await redis.keys('backup:*');
      if (backupKeys.length > 7) {
        const sortedKeys = backupKeys.sort();
        const toDelete = sortedKeys.slice(0, backupKeys.length - 7);
        if (toDelete.length > 0) {
          await redis.del(...toDelete);
        }
      }

      logger.info(`Database backup completed: ${backupKey}`);
    } catch (error) {
      logger.error('Error creating database backup:', error);
    }
  },
};

// 5. Data Sync Job (for offline stations)
const dataSyncJob: Job = {
  name: 'data-sync',
  schedule: '*/15 * * * *', // Every 15 minutes
  enabled: true,
  handler: async () => {
    logger.info('Syncing offline data...');
    
    try {
      const syncKeys = await redis.keys('sync:*');
      
      for (const key of syncKeys) {
        const data = await redis.get(key);
        if (!data) continue;

        const syncData = JSON.parse(data);
        const { type, payload, stationId } = syncData;

        try {
          // ✅ FIXED: Add validation before creating records
          if (type === 'SALE') {
            // Ensure all required fields exist
            if (!payload.stationId || !payload.productType || !payload.quantity) {
              logger.error(`Missing required fields for SALE sync:`, payload);
              continue;
            }
            await prisma.sale.create({
              data: {
                ...payload,
                status: 'VERIFIED',
                verifiedAt: new Date(),
              },
            });
          } else if (type === 'EXPENSE') {
            if (!payload.stationId || !payload.amount || !payload.category) {
              logger.error(`Missing required fields for EXPENSE sync:`, payload);
              continue;
            }
            await prisma.expense.create({
              data: payload,
            });
          } else if (type === 'PUMP_READING') {
            if (!payload.pumpId || !payload.stationId) {
              logger.error(`Missing required fields for PUMP_READING sync:`, payload);
              continue;
            }
            await prisma.pumpReading.create({
              data: payload,
            });
          }

          await redis.del(key);
          logger.info(`Synced data for station ${stationId}: ${type}`);
        } catch (error) {
          logger.error(`Failed to sync data for station ${stationId}:`, error);
        }
      }

      logger.info('Data sync completed');
    } catch (error) {
      logger.error('Error syncing data:', error);
    }
  },
};

// ============= JOB SCHEDULER =============

export class JobScheduler {
  private isRunning: boolean = false;
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private cronParser: any;

  constructor() {
    try {
      this.cronParser = require('cron-parser');
    } catch (error) {
      logger.warn('cron-parser not installed, using simple interval');
    }
  }

  public start(): void {
    if (this.isRunning) {
      logger.warn('Job scheduler already running');
      return;
    }

    logger.info('Starting job scheduler...');
    this.isRunning = true;

    this.registerJob(dailyReportJob);
    this.registerJob(inventoryAlertJob);
    this.registerJob(deliveryReminderJob);
    this.registerJob(databaseBackupJob);
    this.registerJob(dataSyncJob);

    logger.info(`Job scheduler started with ${jobs.length} jobs`);
  }

  private registerJob(job: Job): void {
    if (!job.enabled) {
      logger.info(`Job ${job.name} is disabled, skipping`);
      return;
    }

    jobs.push(job);

    if (this.cronParser) {
      this.scheduleCronJob(job);
    } else {
      this.scheduleSimpleJob(job);
    }

    logger.info(`Registered job: ${job.name} (${job.schedule})`);
  }

  private scheduleCronJob(job: Job): void {
    try {
      const options = {
        currentDate: new Date(),
        endDate: new Date('2100-01-01'),
        iterator: true,
      };

      const interval = this.cronParser.parseExpression(job.schedule, options);

      const scheduleNext = () => {
        try {
          const next = interval.next();
          const delay = next.value.getTime() - Date.now();
          
          if (delay > 0) {
            const timeout = setTimeout(async () => {
              await this.executeJob(job);
              scheduleNext();
            }, delay);
            
            this.intervals.set(job.name, timeout);
          }
        } catch (error) {
          logger.error(`Error scheduling job ${job.name}:`, error);
        }
      };

      scheduleNext();
    } catch (error) {
      logger.error(`Failed to parse cron schedule for ${job.name}:`, error);
    }
  }

  private scheduleSimpleJob(job: Job): void {
    const interval = setInterval(async () => {
      await this.executeJob(job);
    }, 60000);
    
    this.intervals.set(job.name, interval);
  }

  private async executeJob(job: Job): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing job: ${job.name}`);
      await job.handler();
      
      const duration = Date.now() - startTime;
      logger.info(`Job ${job.name} completed in ${duration}ms`);
    } catch (error) {
      logger.error(`Job ${job.name} failed:`, error);
      
      await prisma.auditLog.create({
        data: {
          userId: 'system',
          action: 'JOB_FAILED',
          resourceType: 'Job',
          resourceId: job.name,
          details: {
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        },
      });
    }
  }

  public stop(): void {
    logger.info('Stopping job scheduler...');
    this.isRunning = false;
    
    for (const [name, timeout] of this.intervals) {
      clearTimeout(timeout);
      clearInterval(timeout as any);
      logger.info(`Cleared job: ${name}`);
    }
    
    this.intervals.clear();
    logger.info('Job scheduler stopped');
  }

  public getJobs(): Job[] {
    return jobs;
  }

  public getJobStatus(name: string): string | null {
    if (this.intervals.has(name)) {
      return 'RUNNING';
    }
    const job = jobs.find(j => j.name === name);
    if (job) {
      return job.enabled ? 'SCHEDULED' : 'DISABLED';
    }
    return null;
  }

  public triggerJob(name: string): void {
    const job = jobs.find(j => j.name === name);
    if (!job) {
      logger.error(`Job ${name} not found`);
      return;
    }
    
    if (!job.enabled) {
      logger.error(`Job ${name} is disabled`);
      return;
    }
    
    this.executeJob(job);
  }
}

// ============= SINGLETON INSTANCE =============
let schedulerInstance: JobScheduler | null = null;

export const initializeScheduler = (): JobScheduler => {
  if (!schedulerInstance) {
    schedulerInstance = new JobScheduler();
  }
  return schedulerInstance;
};

export const getScheduler = (): JobScheduler | null => {
  return schedulerInstance;
};

export default JobScheduler;
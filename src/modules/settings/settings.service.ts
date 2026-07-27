import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../config/logger';

export class SettingsService {
  private readonly cacheTTL = 600;

  async getSettings(userId: string) {
    const cacheKey = `settings:user:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let settings = await prisma.settings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.settings.create({
        data: {
          userId,
          theme: 'light',
          language: 'en',
          notifications: {
            email: true,
            sms: false,
            push: true,
            lowStock: true,
            deliveryReminders: true,
            paymentConfirmations: true,
          },
          preferences: {
            timezone: 'Africa/Lagos',
            dateFormat: 'DD/MM/YYYY',
            currency: 'NGN',
            timeFormat: '24h',
          },
        },
      });
    }

    await redis.setex(cacheKey, this.cacheTTL, JSON.stringify(settings));
    return settings;
  }

  async updateSettings(userId: string, data: any) {
    const settings = await prisma.settings.update({
      where: { userId },
      data: {
        theme: data.theme,
        language: data.language,
        notifications: data.notifications,
        preferences: data.preferences,
      },
    });

    await this.invalidateCache(userId);
    return settings;
  }

  async getSystemSettings() {
    const cacheKey = 'settings:system';
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Default system settings
    const systemSettings = {
      stationDefaults: {
        openingTime: '08:00',
        closingTime: '18:00',
        defaultProductType: 'PMS',
      },
      pricing: {
        pmsPrice: 225,
        agoPrice: 185,
        lpgPrice: 320,
        dpkPrice: 150,
      },
      notifications: {
        lowStockThreshold: 30,
        criticalStockThreshold: 15,
        deliveryReminderHours: 24,
        autoApproveExpenseLimit: 50000,
      },
      security: {
        maxLoginAttempts: 5,
        sessionTimeoutMinutes: 60,
        requireTwoFactor: false,
        passwordExpiryDays: 90,
      },
      integration: {
        enableEmail: true,
        enableSMS: false,
        enablePushNotifications: true,
      },
    };

    // In production, this would come from a database table
    await redis.setex(cacheKey, 3600, JSON.stringify(systemSettings));
    return systemSettings;
  }

  async updateSystemSettings(data: any) {
    // In production, this would update a database table
    // For now, just return the updated data
    await redis.del('settings:system');
    return data;
  }

  async getUserTheme(userId: string) {
    const settings = await this.getSettings(userId);
    return settings.theme || 'light';
  }

  async getUserLanguage(userId: string) {
    const settings = await this.getSettings(userId);
    return settings.language || 'en';
  }

  async updateTheme(userId: string, theme: string) {
    if (!['light', 'dark'].includes(theme)) {
      throw new AppError('Invalid theme. Must be "light" or "dark"', 400);
    }
    return this.updateSettings(userId, { theme });
  }

  async updateLanguage(userId: string, language: string) {
    const validLanguages = ['en', 'ha', 'yo', 'ig'];
    if (!validLanguages.includes(language)) {
      throw new AppError('Invalid language', 400);
    }
    return this.updateSettings(userId, { language });
  }

  private async invalidateCache(userId?: string) {
    if (userId) {
      await redis.del(`settings:user:${userId}`);
    }
    const keys = await redis.keys('settings:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
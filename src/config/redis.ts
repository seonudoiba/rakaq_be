import Redis from 'ioredis';
import { env } from './environment';

class RedisClient {
  private static instance: Redis;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      const redisUrl = env.REDIS_URL;

      if (redisUrl && redisUrl.startsWith('redis')) {
        RedisClient.instance = new Redis(redisUrl, {
          password: env.REDIS_PASSWORD || undefined,
          retryStrategy: (times: number) => Math.min(times * 100, 3000),
          maxRetriesPerRequest: 3,
          enableOfflineQueue: false,
          lazyConnect: true,
        });
      } else {
        RedisClient.instance = new Redis({
          lazyConnect: true,
          enableOfflineQueue: false,
          maxRetriesPerRequest: 1,
        });
      }

      RedisClient.instance.on('error', (error) => {
        console.warn('⚠️ Redis issue:', error.message || error);
      });
    }
    return RedisClient.instance;
  }
}

export const redis = RedisClient.getInstance();
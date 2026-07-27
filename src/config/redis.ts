import Redis from 'ioredis';
import { env } from './environment';

class RedisClient {
  private static instance: Redis;

  static getInstance(): Redis {
    if (!RedisClient.instance) {
      RedisClient.instance = new Redis({
        host: env.REDIS_URL.split('://')[1]?.split(':')[0] || 'localhost',
        port: parseInt(env.REDIS_URL.split(':')[2]?.split('/')[0] || '6379'),
        password: env.REDIS_PASSWORD || undefined,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      RedisClient.instance.on('error', (error) => {
        console.error('Redis connection error:', error);
      });

      RedisClient.instance.on('connect', () => {
        console.log('Redis connected successfully');
      });
    }
    return RedisClient.instance;
  }
}

export const redis = RedisClient.getInstance();
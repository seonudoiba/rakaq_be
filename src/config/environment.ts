import dotenv from 'dotenv';
import { cleanEnv, str, port, num, url } from 'envalid';

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 5000 }),
  DATABASE_URL: str({ default: '' }),
  REDIS_URL: str({ default: '' }),
  REDIS_PASSWORD: str({ default: '' }),
  JWT_SECRET: str({ default: 'super-secret-jwt-key' }),
  JWT_REFRESH_SECRET: str({ default: 'super-secret-refresh-key' }),
  JWT_EXPIRY: str({ default: '7d' }),
  JWT_REFRESH_EXPIRY: str({ default: '30d' }),
  FRONTEND_URL: str({ default: '*' }),
  LOG_LEVEL: str({ choices: ['error', 'warn', 'info', 'debug'], default: 'info' }),
  RATE_LIMIT_WINDOW: num({ default: 900000 }),
  RATE_LIMIT_MAX: num({ default: 100 }),
});
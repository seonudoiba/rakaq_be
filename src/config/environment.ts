import dotenv from 'dotenv';
import { cleanEnv, str, port, num, url } from 'envalid';

dotenv.config();

export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
  PORT: port({ default: 5000 }),
  DATABASE_URL: url(),
  REDIS_URL: url(),
  REDIS_PASSWORD: str({ default: '' }),
  JWT_SECRET: str({ desc: 'JWT secret key' }),
  JWT_REFRESH_SECRET: str({ desc: 'JWT refresh secret key' }),
  JWT_EXPIRY: str({ default: '7d' }),
  JWT_REFRESH_EXPIRY: str({ default: '30d' }),
  FRONTEND_URL: url({ default: 'http://localhost:3000' }),
  LOG_LEVEL: str({ choices: ['error', 'warn', 'info', 'debug'], default: 'info' }),
  RATE_LIMIT_WINDOW: num({ default: 900000 }),
  RATE_LIMIT_MAX: num({ default: 100 }),
});
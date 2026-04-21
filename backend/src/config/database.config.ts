import { registerAs } from '@nestjs/config';

export interface DatabaseConfiguration {
  databaseUrl: string;
  redisUrl: string;
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpires: string;
  jwtRefreshExpires: string;
}

export const databaseConfiguration = registerAs(
  'database',
  (): DatabaseConfiguration => ({
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
  }),
);
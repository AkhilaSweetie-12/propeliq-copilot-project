import { registerAs } from '@nestjs/config';

export interface AppConfiguration {
  port: number;
  nodeEnv: string;
  corsOrigin: string[];
  isProduction: boolean;
}

export const appConfiguration = registerAs(
  'app',
  (): AppConfiguration => ({
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
    isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
  }),
);
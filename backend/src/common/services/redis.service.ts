import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;

  constructor(private readonly configService: ConfigService) {}

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    const value = await client.get(key);
    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    await client.del(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', '100');
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  private async getClient(): Promise<Redis | null> {
    if (this.client) {
      return this.client;
    }

    const redisUrl = this.configService.get<string>('database.redisUrl');
    if (!redisUrl) {
      return null;
    }

    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    this.client.on('error', (error) => {
      this.logger.warn(`Redis unavailable: ${error.message}`);
    });

    try {
      await this.client.connect();
    } catch (error) {
      this.logger.warn(
        error instanceof Error ? `Redis connection failed: ${error.message}` : 'Redis connection failed.',
      );
      return null;
    }

    return this.client;
  }
}
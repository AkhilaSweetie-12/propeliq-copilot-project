"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RedisService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
let RedisService = RedisService_1 = class RedisService {
    configService;
    logger = new common_1.Logger(RedisService_1.name);
    client = null;
    constructor(configService) {
        this.configService = configService;
    }
    async get(key) {
        const client = await this.getClient();
        if (!client) {
            return null;
        }
        const value = await client.get(key);
        if (!value) {
            return null;
        }
        return JSON.parse(value);
    }
    async set(key, value, ttlSeconds) {
        const client = await this.getClient();
        if (!client) {
            return;
        }
        await client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    }
    async del(key) {
        const client = await this.getClient();
        if (!client) {
            return;
        }
        await client.del(key);
    }
    async delByPrefix(prefix) {
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
    async onModuleDestroy() {
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
    }
    async getClient() {
        if (this.client) {
            return this.client;
        }
        const redisUrl = this.configService.get('database.redisUrl');
        if (!redisUrl) {
            return null;
        }
        this.client = new ioredis_1.default(redisUrl, {
            maxRetriesPerRequest: 1,
            lazyConnect: true,
        });
        this.client.on('error', (error) => {
            this.logger.warn(`Redis unavailable: ${error.message}`);
        });
        try {
            await this.client.connect();
        }
        catch (error) {
            this.logger.warn(error instanceof Error ? `Redis connection failed: ${error.message}` : 'Redis connection failed.');
            return null;
        }
        return this.client;
    }
};
exports.RedisService = RedisService;
exports.RedisService = RedisService = RedisService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RedisService);
//# sourceMappingURL=redis.service.js.map
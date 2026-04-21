"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseConfiguration = void 0;
const config_1 = require("@nestjs/config");
exports.databaseConfiguration = (0, config_1.registerAs)('database', () => ({
    databaseUrl: process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? '',
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES ?? '7d',
}));
//# sourceMappingURL=database.config.js.map
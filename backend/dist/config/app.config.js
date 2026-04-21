"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appConfiguration = void 0;
const config_1 = require("@nestjs/config");
exports.appConfiguration = (0, config_1.registerAs)('app', () => ({
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',
    corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:4200')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    isProduction: (process.env.NODE_ENV ?? 'development') === 'production',
}));
//# sourceMappingURL=app.config.js.map
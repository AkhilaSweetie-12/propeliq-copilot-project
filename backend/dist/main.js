"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const http_exception_filter_1 = require("./common/filters/http-exception.filter");
const response_envelope_interceptor_1 = require("./common/interceptors/response-envelope.interceptor");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const logger = new common_1.Logger('Bootstrap');
    const app = await core_1.NestFactory.create(app_module_1.AppModule, {
        bufferLogs: true,
    });
    const configService = app.get(config_1.ConfigService);
    const appConfig = configService.getOrThrow('app');
    app.setGlobalPrefix('api/v1');
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: 'same-site' },
    }));
    app.use((0, cookie_parser_1.default)());
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
    }));
    app.useGlobalFilters(new http_exception_filter_1.HttpExceptionFilter());
    app.useGlobalInterceptors(new response_envelope_interceptor_1.ResponseEnvelopeInterceptor());
    app.enableCors({
        origin: appConfig.corsOrigin,
        credentials: true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    });
    if (appConfig.isProduction) {
        app.getHttpAdapter().getInstance().set('trust proxy', 1);
    }
    await app.listen(appConfig.port);
    logger.log(`API listening on port ${appConfig.port}`);
}
bootstrap().catch((error) => {
    const logger = new common_1.Logger('Bootstrap');
    const message = error instanceof Error ? error.stack ?? error.message : 'Unknown bootstrap failure';
    logger.error(message);
    process.exit(1);
});
//# sourceMappingURL=main.js.map
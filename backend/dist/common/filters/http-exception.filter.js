"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var HttpExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const node_crypto_1 = require("node:crypto");
let HttpExceptionFilter = HttpExceptionFilter_1 = class HttpExceptionFilter {
    logger = new common_1.Logger(HttpExceptionFilter_1.name);
    catch(exception, host) {
        const context = host.switchToHttp();
        const response = context.getResponse();
        const request = context.getRequest();
        const traceId = request.headers['x-request-id']?.toString() ?? (0, node_crypto_1.randomUUID)();
        const errorPayload = this.buildErrorResponse(exception, traceId);
        if (!(exception instanceof common_1.HttpException)) {
            this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : 'Unexpected error');
        }
        response.status(errorPayload.statusCode).json(errorPayload.body);
    }
    buildErrorResponse(exception, traceId) {
        const timestamp = new Date().toISOString();
        if (exception instanceof client_1.Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
            return {
                statusCode: common_1.HttpStatus.CONFLICT,
                body: {
                    success: false,
                    error: {
                        code: 'CONFLICT',
                        message: 'A unique constraint was violated.',
                        traceId,
                        timestamp,
                    },
                },
            };
        }
        if (exception instanceof common_1.HttpException) {
            const statusCode = exception.getStatus();
            const response = exception.getResponse();
            const details = this.extractDetails(response);
            return {
                statusCode,
                body: {
                    success: false,
                    error: {
                        code: this.resolveErrorCode(statusCode),
                        message: this.extractMessage(response),
                        details,
                        traceId,
                        timestamp,
                    },
                },
            };
        }
        return {
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            body: {
                success: false,
                error: {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'An unexpected error occurred.',
                    traceId,
                    timestamp,
                },
            },
        };
    }
    extractMessage(response) {
        if (typeof response === 'string') {
            return response;
        }
        if ('message' in response) {
            const message = response.message;
            if (Array.isArray(message)) {
                return 'Validation failed.';
            }
            if (typeof message === 'string') {
                return message;
            }
        }
        return 'Request failed.';
    }
    extractDetails(response) {
        if (typeof response === 'string' || !('message' in response)) {
            return undefined;
        }
        const message = response.message;
        if (!Array.isArray(message)) {
            return undefined;
        }
        return message.map((item) => ({ message: item }));
    }
    resolveErrorCode(statusCode) {
        switch (statusCode) {
            case common_1.HttpStatus.BAD_REQUEST:
                return 'VALIDATION_ERROR';
            case common_1.HttpStatus.UNAUTHORIZED:
                return 'UNAUTHORIZED';
            case common_1.HttpStatus.FORBIDDEN:
                return 'FORBIDDEN';
            case common_1.HttpStatus.NOT_FOUND:
                return 'NOT_FOUND';
            case common_1.HttpStatus.CONFLICT:
                return 'CONFLICT';
            default:
                return 'REQUEST_FAILED';
        }
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = HttpExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
//# sourceMappingURL=http-exception.filter.js.map
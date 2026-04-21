import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import type { ApiErrorDetail, ApiErrorResponse } from '../types/api-response.type';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const traceId = request.headers['x-request-id']?.toString() ?? randomUUID();

    const errorPayload = this.buildErrorResponse(exception, traceId);
    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : 'Unexpected error',
      );
    }

    response.status(errorPayload.statusCode).json(errorPayload.body);
  }

  private buildErrorResponse(
    exception: unknown,
    traceId: string,
  ): { statusCode: number; body: ApiErrorResponse } {
    const timestamp = new Date().toISOString();

    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      return {
        statusCode: HttpStatus.CONFLICT,
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

    if (exception instanceof HttpException) {
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
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
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

  private extractMessage(response: string | object): string {
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

  private extractDetails(response: string | object): ApiErrorDetail[] | undefined {
    if (typeof response === 'string' || !('message' in response)) {
      return undefined;
    }

    const message = response.message;
    if (!Array.isArray(message)) {
      return undefined;
    }

    return message.map((item) => ({ message: item }));
  }

  private resolveErrorCode(statusCode: number): string {
    switch (statusCode) {
      case HttpStatus.BAD_REQUEST:
        return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'REQUEST_FAILED';
    }
  }
}
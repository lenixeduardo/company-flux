import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '@flux/shared';

interface PrismaError {
  code?: string;
  meta?: { target?: string[] };
}

function isPrismaError(error: unknown): error is PrismaError & Error {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P')
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string;
    let errorCode: string | undefined;

    if (isPrismaError(exception)) {
      const prismaResult = this.handlePrismaError(exception);
      statusCode = prismaResult.statusCode;
      message = prismaResult.message;
      errorCode = prismaResult.errorCode;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const msgField = (exceptionResponse as { message: unknown }).message;
        message = Array.isArray(msgField) ? msgField.join('; ') : String(msgField);
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error: ${exception.message}`, exception.stack);
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    } else {
      this.logger.error('Unknown exception thrown', String(exception));
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    response.status(statusCode).json({
      statusCode,
      message,
      errorCode,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  private handlePrismaError(error: PrismaError & Error): {
    statusCode: number;
    message: string;
    errorCode: string;
  } {
    switch (error.code) {
      case 'P2002': {
        const target = error.meta?.target?.join(', ') ?? 'field';
        return {
          statusCode: HttpStatus.CONFLICT,
          message: `Unique constraint violation on: ${target}`,
          errorCode: ErrorCode.VALIDATION_ERROR,
        };
      }
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Resource not found',
          errorCode: ErrorCode.NOT_FOUND,
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint violation',
          errorCode: ErrorCode.VALIDATION_ERROR,
        };
      case 'P2014':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Relation violation: required relation missing',
          errorCode: ErrorCode.VALIDATION_ERROR,
        };
      default:
        this.logger.error(`Unhandled Prisma error [${error.code}]: ${error.message}`);
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          errorCode: ErrorCode.VALIDATION_ERROR,
        };
    }
  }
}

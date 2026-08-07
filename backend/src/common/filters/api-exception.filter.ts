import {
  ArgumentsHost,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ValidationError } from 'class-validator';

interface ErrorDetail {
  field: string;
  message: string;
}

interface ErrorEnvelope {
  statusCode: number;
  code: string;
  message: string;
  details: ErrorDetail[];
}

const errorCodeForStatus = (status: number) => {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.INTERNAL_SERVER_ERROR:
      return 'INTERNAL_SERVER_ERROR';
    default:
      return status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR';
  }
};

const messageForStatus = (status: number) => {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'Request validation failed';
    case HttpStatus.UNAUTHORIZED:
      return 'Unauthorized';
    case HttpStatus.NOT_FOUND:
      return 'Resource not found';
    case HttpStatus.INTERNAL_SERVER_ERROR:
      return 'Internal server error';
    default:
      return status >= 500 ? 'Internal server error' : 'Request failed';
  }
};

const validationDetails = (response: unknown): ErrorDetail[] => {
  if (!response || typeof response !== 'object') return [];
  const messages = (response as { message?: unknown }).message;
  if (!Array.isArray(messages)) return [];

  const details: ErrorDetail[] = [];
  const visit = (error: ValidationError, parentPath = '') => {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;
    for (const message of Object.values(error.constraints ?? {})) {
      details.push({ field: path || 'request', message });
    }
    for (const child of error.children ?? []) visit(child, path);
  };

  for (const message of messages) {
    if (message && typeof message === 'object' && 'property' in message) {
      visit(message as ValidationError);
    } else {
      // Do not copy arbitrary exception text into a public validation body:
      // it could contain a rejected value or an implementation detail.
      details.push({ field: 'request', message: 'Invalid value' });
    }
  }
  return details;
};

export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body: ErrorEnvelope = {
      statusCode: status,
      code: errorCodeForStatus(status),
      message: messageForStatus(status),
      details:
        status === HttpStatus.BAD_REQUEST && exception instanceof HttpException
          ? validationDetails(exception.getResponse())
          : [],
    };

    response.status(status).json(body);
  }
}

import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiException } from '@kubernetes/client-node';

export function mapK8sError(error: unknown): HttpException {
  if (error instanceof ApiException) {
    const message = `Kubernetes API error (${error.code})`;
    switch (error.code) {
      case 404:
        return new NotFoundException(message);
      case 409:
        return new ConflictException(message);
      case 403:
        return new ForbiddenException(message);
      case 401:
        return new UnauthorizedException(message);
      default:
        return new ServiceUnavailableException(message);
    }
  }
  return new ServiceUnavailableException('Kubernetes API unavailable');
}

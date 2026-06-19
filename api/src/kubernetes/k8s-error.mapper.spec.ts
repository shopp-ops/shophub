import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';

jest.mock('@kubernetes/client-node', () => ({
  ApiException: class ApiException extends Error {
    constructor(
      public code: number,
      message: string,
      public body: unknown,
      public headers: unknown,
    ) {
      super(message);
    }
  },
  KubeConfig: jest.fn(),
  CustomObjectsApi: class CustomObjectsApi {},
  CoreV1Api: class CoreV1Api {},
}));

import { ApiException } from '@kubernetes/client-node';
import { mapK8sError } from './k8s-error.mapper';

const apiError = (code: number) => new ApiException(code, 'boom', {}, {});

describe('mapK8sError', () => {
  it('maps 404 to NotFoundException', () => {
    expect(mapK8sError(apiError(404))).toBeInstanceOf(NotFoundException);
  });
  it('maps 409 to ConflictException', () => {
    expect(mapK8sError(apiError(409))).toBeInstanceOf(ConflictException);
  });
  it('maps 403 to ForbiddenException', () => {
    expect(mapK8sError(apiError(403))).toBeInstanceOf(ForbiddenException);
  });
  it('maps 401 to UnauthorizedException', () => {
    expect(mapK8sError(apiError(401))).toBeInstanceOf(UnauthorizedException);
  });
  it('maps other codes to ServiceUnavailableException', () => {
    expect(mapK8sError(apiError(500))).toBeInstanceOf(ServiceUnavailableException);
  });
  it('maps non-ApiException errors to ServiceUnavailableException', () => {
    expect(mapK8sError(new Error('network'))).toBeInstanceOf(ServiceUnavailableException);
  });
});

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

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiException } from '@kubernetes/client-node';
import { ShopResourceService } from './shop-resource.service';
import { KubernetesClientProvider } from './kubernetes-client.provider';
import { ShopManifest } from './shop-manifest.interface';

const manifest: ShopManifest = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  name: 'My Shop',
  availability: 'standard',
  database: 'light',
  apiImage: 'ghcr.io/shopp-ops/shop-api:1.0.0',
  webImage: 'ghcr.io/shopp-ops/shop-web:1.0.0',
  walletAddress: '0xabc',
};

describe('ShopResourceService.createShop', () => {
  let custom: { createNamespacedCustomObject: jest.Mock };
  let core: { createNamespace: jest.Mock };
  let service: ShopResourceService;

  beforeEach(() => {
    custom = { createNamespacedCustomObject: jest.fn().mockResolvedValue({}) };
    core = { createNamespace: jest.fn().mockResolvedValue({}) };
    const client = {
      customObjectsApi: () => custom,
      coreV1Api: () => core,
    } as unknown as KubernetesClientProvider;
    service = new ShopResourceService(client);
  });

  it('creates the namespace then the Shop CR with mapped spec and label', async () => {
    await service.createShop(manifest);

    expect(core.createNamespace).toHaveBeenCalledWith({
      body: { metadata: { name: 'shop-my-shop-7c9e6679' } },
    });
    expect(custom.createNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'shopops.shopops.dc.com',
      version: 'v1',
      namespace: 'shop-my-shop-7c9e6679',
      plural: 'shops',
      body: {
        apiVersion: 'shopops.shopops.dc.com/v1',
        kind: 'Shop',
        metadata: {
          name: 'my-shop-7c9e6679',
          labels: { 'shopops.dc.com/shop-id': manifest.id },
        },
        spec: {
          name: 'My Shop',
          availability: 'standard',
          database: { type: 'light' },
          apiImage: 'ghcr.io/shopp-ops/shop-api:1.0.0',
          webImage: 'ghcr.io/shopp-ops/shop-web:1.0.0',
          walletAddress: '0xabc',
        },
      },
    });
  });

  it('swallows a 409 from namespace creation (idempotent) and still creates the CR', async () => {
    core.createNamespace.mockRejectedValue(new ApiException(409, 'exists', {}, {}));
    await service.createShop(manifest);
    expect(custom.createNamespacedCustomObject).toHaveBeenCalledTimes(1);
  });

  it('maps a non-409 namespace error through mapK8sError', async () => {
    core.createNamespace.mockRejectedValue(new ApiException(403, 'denied', {}, {}));
    await expect(service.createShop(manifest)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps a 409 from CR creation to ConflictException', async () => {
    custom.createNamespacedCustomObject.mockRejectedValue(new ApiException(409, 'exists', {}, {}));
    await expect(service.createShop(manifest)).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps a 404 from CR creation via mapK8sError', async () => {
    custom.createNamespacedCustomObject.mockRejectedValue(new ApiException(404, 'gone', {}, {}));
    await expect(service.createShop(manifest)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ShopResourceService get/patch/delete', () => {
  let custom: {
    getNamespacedCustomObject: jest.Mock;
    patchNamespacedCustomObject: jest.Mock;
    deleteNamespacedCustomObject: jest.Mock;
  };
  let core: { deleteNamespace: jest.Mock };
  let service: ShopResourceService;

  beforeEach(() => {
    custom = {
      getNamespacedCustomObject: jest.fn().mockResolvedValue({ kind: 'Shop' }),
      patchNamespacedCustomObject: jest.fn().mockResolvedValue({}),
      deleteNamespacedCustomObject: jest.fn().mockResolvedValue({}),
    };
    core = { deleteNamespace: jest.fn().mockResolvedValue({}) };
    const client = {
      customObjectsApi: () => custom,
      coreV1Api: () => core,
    } as unknown as KubernetesClientProvider;
    service = new ShopResourceService(client);
  });

  it('getShop requests the CR by coordinates', async () => {
    const result = await service.getShop('shop-ns', 'my-shop-7c9e6679');
    expect(custom.getNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'shopops.shopops.dc.com',
      version: 'v1',
      namespace: 'shop-ns',
      plural: 'shops',
      name: 'my-shop-7c9e6679',
    });
    expect(result).toEqual({ kind: 'Shop' });
  });

  it('getShop maps a 404 to NotFoundException', async () => {
    custom.getNamespacedCustomObject.mockRejectedValue(new ApiException(404, 'gone', {}, {}));
    await expect(service.getShop('shop-ns', 'x')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('patchShop sends a merge-patch of the spec', async () => {
    await service.patchShop('shop-ns', 'my-shop-7c9e6679', { availability: 'high' });
    expect(custom.patchNamespacedCustomObject).toHaveBeenCalledWith(
      {
        group: 'shopops.shopops.dc.com',
        version: 'v1',
        namespace: 'shop-ns',
        plural: 'shops',
        name: 'my-shop-7c9e6679',
        body: { spec: { availability: 'high' } },
      },
      expect.objectContaining({
        middleware: expect.arrayContaining([expect.objectContaining({ pre: expect.any(Function) })]),
      }),
    );
  });

  it('deleteShop deletes the CR', async () => {
    await service.deleteShop('shop-ns', 'my-shop-7c9e6679');
    expect(custom.deleteNamespacedCustomObject).toHaveBeenCalledWith({
      group: 'shopops.shopops.dc.com',
      version: 'v1',
      namespace: 'shop-ns',
      plural: 'shops',
      name: 'my-shop-7c9e6679',
    });
  });

  it('deleteShopNamespace deletes the namespace', async () => {
    await service.deleteShopNamespace('shop-ns');
    expect(core.deleteNamespace).toHaveBeenCalledWith({ name: 'shop-ns' });
  });
});

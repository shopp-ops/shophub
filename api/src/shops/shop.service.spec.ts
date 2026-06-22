import { ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShopResourceService } from '../kubernetes/shop-resource.service';
import { AvailabilityTier, DatabaseType, Shop } from './shop.entity';
import { ShopService } from './shop.service';

const mockRepo = {
  findOneBy: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

const mockK8s = {
  createShop: jest.fn().mockResolvedValue(undefined),
  patchShop: jest.fn().mockResolvedValue(undefined),
  deleteShopNamespace: jest.fn().mockResolvedValue(undefined),
  waitForReady: jest.fn().mockResolvedValue(undefined),
  readAdminCredentials: jest.fn().mockResolvedValue({ email: 'a@b.c', password: 'pw' }),
  readShopStatus: jest.fn().mockResolvedValue({ walletAddress: undefined }),
  readWalletCredentials: jest.fn().mockResolvedValue({ address: '0xgen', privateKey: '0xpriv' }),
};

const mockConfig = {
  getOrThrow: jest.fn((key: string) =>
    ({ SHOP_API_IMAGE: 'ghcr.io/shopp-ops/shop-api:1', SHOP_WEB_IMAGE: 'ghcr.io/shopp-ops/shop-web:1' })[key],
  ),
  get: jest.fn(() => 'local'),
};

describe('ShopService', () => {
  let service: ShopService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockK8s.createShop.mockResolvedValue(undefined);
    mockK8s.patchShop.mockResolvedValue(undefined);
    mockK8s.deleteShopNamespace.mockResolvedValue(undefined);
    mockK8s.waitForReady.mockResolvedValue(undefined);
    mockK8s.readAdminCredentials.mockResolvedValue({ email: 'a@b.c', password: 'pw' });
    mockK8s.readShopStatus.mockResolvedValue({ walletAddress: undefined });
    mockK8s.readWalletCredentials.mockResolvedValue({ address: '0xgen', privateKey: '0xpriv' });
    const module = await Test.createTestingModule({
      providers: [
        ShopService,
        { provide: getRepositoryToken(Shop), useValue: mockRepo },
        { provide: ShopResourceService, useValue: mockK8s },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(ShopService);
  });

  describe('findByIdForUser', () => {
    it('throws NotFoundException when shop does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.findByIdForUser('shop-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when shop belongs to another user', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id: 'shop-1', userId: 'user-2' });
      await expect(service.findByIdForUser('shop-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns shop when userId matches', async () => {
      const shop = { id: 'shop-1', userId: 'user-1' };
      mockRepo.findOneBy.mockResolvedValue(shop);
      await expect(service.findByIdForUser('shop-1', 'user-1')).resolves.toEqual(shop);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'my-shop',
      availabilityTier: AvailabilityTier.STANDARD,
      walletAddress: '0x123',
      databaseType: DatabaseType.STANDARD,
    };
    const saved = { id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', userId: 'user-1', ...dto };

    beforeEach(() => {
      mockRepo.create.mockReturnValue({ ...dto, userId: 'user-1' });
      mockRepo.save.mockResolvedValue(saved);
    });

    it('persists then creates the Shop CR', async () => {
      const result = await service.create('user-1', dto);
      expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, userId: 'user-1' });
      expect(mockK8s.createShop).toHaveBeenCalledWith(
        expect.objectContaining({ id: saved.id, name: 'my-shop', availability: 'standard', database: 'standard' }),
      );
      expect(result.shop).toEqual(saved);
    });

    it('rolls back the DB row and rethrows when CR creation fails', async () => {
      mockK8s.createShop.mockRejectedValue(new Error('k8s down'));
      await expect(service.create('user-1', dto)).rejects.toThrow('k8s down');
      expect(mockRepo.remove).toHaveBeenCalledWith(saved);
    });

    it('returns admin credentials once the shop is Ready', async () => {
      mockK8s.waitForReady.mockResolvedValue(undefined);
      mockK8s.readAdminCredentials.mockResolvedValue({ email: 'admin@shop.local', password: 's3cret' });
      const result = await service.create('user-1', dto);
      expect(result.shop).toEqual(saved);
      expect(result.adminCredentials).toEqual({ email: 'admin@shop.local', password: 's3cret' });
      expect(result.credentialsError).toBeUndefined();
    });

    it('returns credentialsError when readiness times out', async () => {
      mockK8s.waitForReady.mockRejectedValue(new ServiceUnavailableException('timeout'));
      const result = await service.create('user-1', dto);
      expect(result.shop).toEqual(saved);
      expect(result.adminCredentials).toBeNull();
      expect(result.credentialsError).toContain('timeout');
      expect(mockK8s.readAdminCredentials).not.toHaveBeenCalled();
    });

    it('returns credentialsError when the secret is missing', async () => {
      mockK8s.waitForReady.mockResolvedValue(undefined);
      mockK8s.readAdminCredentials.mockRejectedValue(new NotFoundException('no secret'));
      const result = await service.create('user-1', dto);
      expect(result.adminCredentials).toBeNull();
      expect(result.credentialsError).toBeDefined();
    });

    describe('wallet', () => {
      const autoDto = { ...dto, walletAddress: undefined };
      const autoSaved = { ...saved, walletAddress: null as string | null };

      beforeEach(() => {
        mockRepo.create.mockReturnValue({ ...autoDto, userId: 'user-1' });
        mockRepo.save.mockResolvedValue(autoSaved);
      });

      it('auto-gen: returns wallet credentials and persists the resolved address', async () => {
        mockK8s.readShopStatus.mockResolvedValue({ walletAddress: '0xgenerated' });
        mockK8s.readWalletCredentials.mockResolvedValue({ address: '0xgenerated', privateKey: '0xkey' });

        const result = await service.create('user-1', autoDto);

        expect(mockK8s.readWalletCredentials).toHaveBeenCalledWith('shop-my-shop-7c9e6679', 'my-shop-7c9e6679');
        expect(result.walletCredentials).toEqual({ address: '0xgenerated', privateKey: '0xkey' });
        expect(result.shop.walletAddress).toBe('0xgenerated');
        expect(mockRepo.save).toHaveBeenLastCalledWith(expect.objectContaining({ walletAddress: '0xgenerated' }));
      });

      it('provided address: no wallet read, walletCredentials null', async () => {
        const result = await service.create('user-1', dto);
        expect(mockK8s.readWalletCredentials).not.toHaveBeenCalled();
        expect(result.walletCredentials).toBeNull();
      });

      it('auto-gen: wallet read failure leaves walletCredentials null, admin creds still returned', async () => {
        mockK8s.readShopStatus.mockResolvedValue({ walletAddress: '0xgenerated' });
        mockK8s.readWalletCredentials.mockRejectedValue(new NotFoundException('no keypair'));

        const result = await service.create('user-1', autoDto);

        expect(result.walletCredentials).toBeNull();
        expect(result.adminCredentials).toEqual({ email: 'a@b.c', password: 'pw' });
        expect(result.credentialsError).toBeUndefined();
      });
    });
  });

  describe('update', () => {
    const shop = {
      id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      userId: 'user-1',
      name: 'my-shop',
      availabilityTier: AvailabilityTier.STANDARD,
    };

    it('throws ForbiddenException when updating a shop owned by another user', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...shop, userId: 'user-2' });
      await expect(
        service.update('shop-1', 'user-1', { availabilityTier: AvailabilityTier.HIGH }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockK8s.patchShop).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when shop does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update('shop-1', 'user-1', {})).rejects.toThrow(NotFoundException);
    });

    it('saves then patches the CR spec', async () => {
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockRepo.save.mockResolvedValue({ ...shop, availabilityTier: AvailabilityTier.HIGH });

      await service.update(shop.id, 'user-1', { availabilityTier: AvailabilityTier.HIGH });

      expect(mockRepo.save).toHaveBeenCalledWith({ ...shop, availabilityTier: AvailabilityTier.HIGH });
      expect(mockK8s.patchShop).toHaveBeenCalledWith('shop-my-shop-7c9e6679', 'my-shop-7c9e6679', {
        availability: 'high',
      });
    });

    it('does not patch when the dto maps to an empty spec', async () => {
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockRepo.save.mockResolvedValue(shop);
      await service.update(shop.id, 'user-1', {});
      expect(mockK8s.patchShop).not.toHaveBeenCalled();
    });

    it('rolls back to the original row and rethrows when the patch fails', async () => {
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockRepo.save.mockResolvedValue({ ...shop, availabilityTier: AvailabilityTier.HIGH });
      mockK8s.patchShop.mockRejectedValue(new Error('patch failed'));

      await expect(
        service.update(shop.id, 'user-1', { availabilityTier: AvailabilityTier.HIGH }),
      ).rejects.toThrow('patch failed');
      expect(mockRepo.save).toHaveBeenLastCalledWith({ ...shop });
    });
  });

  describe('remove', () => {
    const shop = {
      id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      userId: 'user-1',
      name: 'my-shop',
    };

    it('throws NotFoundException when shop does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove('shop-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when removing a shop owned by another user', async () => {
      mockRepo.findOneBy.mockResolvedValue({ ...shop, userId: 'user-2' });
      await expect(service.remove('shop-1', 'user-1')).rejects.toThrow(ForbiddenException);
      expect(mockK8s.deleteShopNamespace).not.toHaveBeenCalled();
    });

    it('removes the row then deletes the namespace', async () => {
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.remove(shop.id, 'user-1');

      expect(mockRepo.remove).toHaveBeenCalledWith(shop);
      expect(mockK8s.deleteShopNamespace).toHaveBeenCalledWith('shop-my-shop-7c9e6679');
    });

    it('swallows a NotFoundException from the namespace delete', async () => {
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockK8s.deleteShopNamespace.mockRejectedValue(new NotFoundException());
      await expect(service.remove(shop.id, 'user-1')).resolves.toBeUndefined();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rolls back by re-inserting the row and rethrows on other failures', async () => {
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockK8s.deleteShopNamespace.mockRejectedValue(new Error('delete failed'));
      await expect(service.remove(shop.id, 'user-1')).rejects.toThrow('delete failed');
      expect(mockRepo.save).toHaveBeenCalledWith({ ...shop });
    });
  });
});

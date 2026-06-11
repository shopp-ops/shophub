import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AvailabilityTier, DatabaseType, Shop } from './shop.entity';
import { ShopService } from './shop.service';

const mockRepo = {
  findOneBy: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};

describe('ShopService', () => {
  let service: ShopService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ShopService, { provide: getRepositoryToken(Shop), useValue: mockRepo }],
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
    it('saves shop with provided userId', async () => {
      const dto = {
        name: 'my-shop',
        availabilityTier: AvailabilityTier.STANDARD,
        walletAddress: '0x123',
        databaseType: DatabaseType.STANDARD,
      };
      const entity = { ...dto, userId: 'user-1' };
      mockRepo.create.mockReturnValue(entity);
      mockRepo.save.mockResolvedValue({ id: 'shop-1', ...entity });

      const result = await service.create('user-1', dto);

      expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, userId: 'user-1' });
      expect(result.userId).toBe('user-1');
    });
  });

  describe('update', () => {
    it('throws ForbiddenException when updating a shop owned by another user', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id: 'shop-1', userId: 'user-2' });
      await expect(service.update('shop-1', 'user-1', { availabilityTier: AvailabilityTier.HIGH })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when shop does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.update('shop-1', 'user-1', {})).rejects.toThrow(NotFoundException);
    });

    it('merges dto onto existing shop and saves', async () => {
      const shop = { id: 'shop-1', userId: 'user-1', availabilityTier: AvailabilityTier.STANDARD };
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockRepo.save.mockResolvedValue({ ...shop, availabilityTier: AvailabilityTier.HIGH });

      await service.update('shop-1', 'user-1', { availabilityTier: AvailabilityTier.HIGH });

      expect(mockRepo.save).toHaveBeenCalledWith({ ...shop, availabilityTier: AvailabilityTier.HIGH });
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when shop does not exist', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.remove('shop-1', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when removing a shop owned by another user', async () => {
      mockRepo.findOneBy.mockResolvedValue({ id: 'shop-1', userId: 'user-2' });
      await expect(service.remove('shop-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('removes the loaded shop entity when ownership confirmed', async () => {
      const shop = { id: 'shop-1', userId: 'user-1' };
      mockRepo.findOneBy.mockResolvedValue(shop);
      mockRepo.remove.mockResolvedValue(undefined);

      await service.remove('shop-1', 'user-1');

      expect(mockRepo.remove).toHaveBeenCalledWith(shop);
    });
  });
});

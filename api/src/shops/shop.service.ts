import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { buildShopIdentity } from '../kubernetes/shop-identity.util';
import { ShopResourceService } from '../kubernetes/shop-resource.service';
import { CreateShopDto } from './dto/create-shop.dto';
import { UpdateShopDto } from './dto/update-shop.dto';
import { CreateShopResult } from './create-shop-result.interface';
import { ShopManifestConfig, mapUpdateToSpec, toShopManifest } from './shop-manifest.mapper';
import { Shop } from './shop.entity';

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(
    @InjectRepository(Shop) private repo: Repository<Shop>,
    private readonly k8s: ShopResourceService,
    private readonly config: ConfigService,
  ) {}

  async findByIdForUser(id: string, userId: string): Promise<Shop> {
    const shop = await this.repo.findOneBy({ id });
    if (!shop) throw new NotFoundException('Shop not found');
    if (shop.userId !== userId) throw new ForbiddenException();
    return shop;
  }

  findAllByUser(userId: string): Promise<Shop[]> {
    return this.repo.findBy({ userId });
  }

  async create(userId: string, dto: CreateShopDto): Promise<CreateShopResult> {
    const saved = await this.repo.save(this.repo.create({ ...dto, userId }));
    try {
      await this.k8s.createShop(toShopManifest(saved, this.manifestConfig()));
    } catch (error) {
      await this.rollback(() => this.repo.remove(saved), error);
    }
    return { shop: saved };
  }

  // Best-effort: reads the operator-resolved wallet address (persisting it onto the
  // shop row) and, for the auto-generated case only, the one-time keypair credentials.
  // Any failure here must not fail shop creation nor the admin-credentials result.
  private async resolveWallet(
    shop: Shop,
    autoGenerate: boolean,
    namespace: string,
    crName: string,
  ): Promise<{ address: string; privateKey: string } | null> {
    try {
      const { walletAddress } = await this.k8s.readShopStatus(namespace, crName);
      if (walletAddress && walletAddress !== shop.walletAddress) {
        shop.walletAddress = walletAddress;
        await this.repo.save(shop);
      }
      if (!autoGenerate) return null;
      return await this.k8s.readWalletCredentials(namespace, crName);
    } catch (error) {
      this.logger.warn(`Wallet credentials unavailable for ${namespace}/${crName}: ${(error as Error).message}`);
      return null;
    }
  }

  async update(id: string, userId: string, dto: UpdateShopDto): Promise<Shop> {
    const shop = await this.findByIdForUser(id, userId);
    const original = { ...shop };
    const updated = await this.repo.save({ ...shop, ...dto });
    const partialSpec = mapUpdateToSpec(dto);
    if (Object.keys(partialSpec).length > 0) {
      const { namespace, crName } = buildShopIdentity(shop.id, shop.name);
      try {
        await this.k8s.patchShop(namespace, crName, partialSpec);
      } catch (error) {
        await this.rollback(() => this.repo.save(original), error);
      }
    }
    return updated;
  }

  async remove(id: string, userId: string): Promise<void> {
    const shop = await this.findByIdForUser(id, userId);
    const original = { ...shop };
    const { namespace } = buildShopIdentity(shop.id, shop.name);
    await this.repo.remove(shop);
    try {
      await this.k8s.deleteShopNamespace(namespace);
    } catch (error) {
      if (error instanceof NotFoundException) return;
      await this.rollback(() => this.repo.save(original), error);
    }
  }

  private manifestConfig(): ShopManifestConfig {
    return {
      apiImage: this.config.getOrThrow<string>('SHOP_API_IMAGE'),
      webImage: this.config.getOrThrow<string>('SHOP_WEB_IMAGE'),
      hostSuffix: this.config.get<string>('SHOP_HOST_SUFFIX') ?? 'local',
    };
  }

  private async rollback(undo: () => Promise<unknown>, error: unknown): Promise<never> {
    try {
      await undo();
    } catch (rollbackError) {
      this.logger.error('Rollback failed', rollbackError as Error);
    }
    throw error;
  }
}

import { buildShopIdentity } from '../kubernetes/shop-identity.util';
import { ShopManifest } from '../kubernetes/shop-manifest.interface';
import { UpdateShopDto } from './dto/update-shop.dto';
import { Shop } from './shop.entity';

export interface ShopManifestConfig {
  apiImage: string;
  webImage: string;
  hostSuffix: string;
}

export function toShopManifest(shop: Shop, cfg: ShopManifestConfig): ShopManifest {
  const { crName } = buildShopIdentity(shop.id, shop.name);
  return {
    id: shop.id,
    name: shop.name,
    availability: shop.availabilityTier as ShopManifest['availability'],
    database: shop.databaseType as ShopManifest['database'],
    walletAddress: shop.walletAddress ?? undefined,
    apiImage: cfg.apiImage,
    webImage: cfg.webImage,
    host: `shophub.${crName}.${cfg.hostSuffix}`,
  };
}

export function mapUpdateToSpec(dto: UpdateShopDto): Record<string, unknown> {
  const spec: Record<string, unknown> = {};
  if (dto.availabilityTier !== undefined) spec.availability = dto.availabilityTier;
  if (dto.walletAddress !== undefined) spec.walletAddress = dto.walletAddress;
  if (dto.databaseType !== undefined) spec.database = { type: dto.databaseType };
  return spec;
}

import { AvailabilityTier, DatabaseType, Shop } from './shop.entity';
import { mapUpdateToSpec, toShopManifest } from './shop-manifest.mapper';

const cfg = { apiImage: 'ghcr.io/shopp-ops/shop-api:1', webImage: 'ghcr.io/shopp-ops/shop-web:1', hostSuffix: 'local' };

const shop = {
  id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  name: 'My Shop',
  availabilityTier: AvailabilityTier.STANDARD,
  databaseType: DatabaseType.LIGHT,
  walletAddress: '0xabc',
  adminEmail: 'admin@shop.local',
} as Shop;

describe('toShopManifest', () => {
  it('maps entity + config to a manifest with derived host', () => {
    expect(toShopManifest(shop, cfg)).toEqual({
      id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      name: 'My Shop',
      availability: 'standard',
      database: 'light',
      walletAddress: '0xabc',
      adminEmail: 'admin@shop.local',
      apiImage: 'ghcr.io/shopp-ops/shop-api:1',
      webImage: 'ghcr.io/shopp-ops/shop-web:1',
      host: 'shophub.my-shop-7c9e6679.local',
    });
  });
});

describe('mapUpdateToSpec', () => {
  it('includes only provided fields and nests database', () => {
    expect(
      mapUpdateToSpec({ availabilityTier: AvailabilityTier.HIGH, databaseType: DatabaseType.STANDARD }),
    ).toEqual({ availability: 'high', database: { type: 'standard' } });
  });
  it('returns an empty object for an empty dto', () => {
    expect(mapUpdateToSpec({})).toEqual({});
  });
  it('maps walletAddress alone', () => {
    expect(mapUpdateToSpec({ walletAddress: '0xdef' })).toEqual({ walletAddress: '0xdef' });
  });
});

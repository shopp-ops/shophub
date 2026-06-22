import { Shop } from './shop.entity';

export interface CreateShopResult {
  shop: Shop;
  adminCredentials: { email: string; password: string } | null;
  credentialsError?: string;
}

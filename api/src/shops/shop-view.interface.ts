import { Shop } from './shop.entity';

export interface ShopView extends Shop {
  phase: string;
  statusReason: string | null;
}

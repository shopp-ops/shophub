export interface ShopManifest {
  id: string;
  name: string;
  availability: 'standard' | 'high';
  database: 'standard' | 'light';
  apiImage: string;
  webImage: string;
  adminEmail: string;
  walletAddress?: string;
  host?: string;
  discordChannelRef?: string;
}

export interface ShopManifest {
  id: string;
  name: string;
  availability: 'standard' | 'high';
  database: 'standard' | 'light';
  apiImage: string;
  webImage: string;
  walletAddress?: string;
  host?: string;
  discordChannelRef?: string;
}

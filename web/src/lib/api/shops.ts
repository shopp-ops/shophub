import { request } from "./client";

export type Shop = {
  id: string;
  name: string;
  adminEmail: string;
  availabilityTier: "standard" | "high";
  walletAddress: string | null;
  databaseType: "standard" | "light";
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateShopDto = {
  name: string;
  adminEmail: string;
  availabilityTier: "standard" | "high";
  walletAddress?: string;
  databaseType: "standard" | "light";
};

export type UpdateShopDto = {
  availabilityTier?: "standard" | "high";
  walletAddress?: string;
  databaseType?: "standard" | "light";
};

export type AdminCredentials = {
  email: string;
  password: string;
};

export type WalletCredentials = {
  address: string;
  privateKey: string;
};

export type CreateShopResult = {
  shop: Shop;
  adminCredentials: AdminCredentials | null;
  credentialsError?: string;
  walletCredentials: WalletCredentials | null;
};

export const shopsApi = {
  list: (token: string) => request<Shop[]>("/shops", {}, token),

  create: (token: string, dto: CreateShopDto) =>
    request<CreateShopResult>("/shops", { method: "POST", body: JSON.stringify(dto) }, token),

  update: (token: string, id: string, dto: UpdateShopDto) =>
    request<Shop>(`/shops/${id}`, { method: "PATCH", body: JSON.stringify(dto) }, token),

  remove: (token: string, id: string) =>
    request<void>(`/shops/${id}`, { method: "DELETE" }, token),
};

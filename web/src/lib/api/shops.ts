import { request } from "./client";

export type Shop = {
  id: string;
  name: string;
  availabilityTier: "standard" | "high";
  walletAddress: string;
  databaseType: "standard" | "light";
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateShopDto = {
  name: string;
  availabilityTier: "standard" | "high";
  walletAddress: string;
  databaseType: "standard" | "light";
};

export type UpdateShopDto = {
  availabilityTier?: "standard" | "high";
  walletAddress?: string;
  databaseType?: "standard" | "light";
};

export const shopsApi = {
  list: (token: string) => request<Shop[]>("/shops", {}, token),

  create: (token: string, dto: CreateShopDto) =>
    request<Shop>("/shops", { method: "POST", body: JSON.stringify(dto) }, token),

  update: (token: string, id: string, dto: UpdateShopDto) =>
    request<Shop>(`/shops/${id}`, { method: "PATCH", body: JSON.stringify(dto) }, token),

  remove: (token: string, id: string) =>
    request<void>(`/shops/${id}`, { method: "DELETE" }, token),
};

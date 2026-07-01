import { API_URL, request } from "./client";

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
  /** Live K8s phase: Progressing | Ready | Degraded | Failed | Unknown */
  phase: string;
  statusReason: string | null;
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

/** POST /shops now returns only the shop (201, non-blocking). */
export type CreateShopResult = {
  shop: Shop;
};

/** Thrown by {@link getShopCredentials} for non-2xx responses. Carries the HTTP status. */
export class CredentialsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "CredentialsError";
  }
}

/**
 * Fetch one-time credentials for a shop.
 * - 200 → credentials object
 * - 409 → throws CredentialsError(409) — shop not ready yet
 * - 410 → throws CredentialsError(410) — already retrieved
 */
export async function getShopCredentials(
  id: string,
  token: string,
): Promise<{
  adminCredentials: AdminCredentials | null;
  walletCredentials: WalletCredentials | null;
}> {
  const res = await fetch(`${API_URL}/shops/${id}/credentials`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new CredentialsError(res.status, body?.message ?? "Request failed");
  }
  return body as {
    adminCredentials: AdminCredentials | null;
    walletCredentials: WalletCredentials | null;
  };
}

export const shopsApi = {
  list: (token: string) => request<Shop[]>("/shops", {}, token),

  create: (token: string, dto: CreateShopDto) =>
    request<CreateShopResult>("/shops", { method: "POST", body: JSON.stringify(dto) }, token),

  update: (token: string, id: string, dto: UpdateShopDto) =>
    request<Shop>(`/shops/${id}`, { method: "PATCH", body: JSON.stringify(dto) }, token),

  remove: (token: string, id: string) =>
    request<void>(`/shops/${id}`, { method: "DELETE" }, token),
};

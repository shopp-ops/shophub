import { request } from "./client";

export type LoginResponse = { accessToken: string };
export type RegisterResponse = { id: string; email: string };
export type MeResponse = { userId: string; email: string };

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string) =>
    request<RegisterResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) => request<MeResponse>("/auth/me", {}, token),
};

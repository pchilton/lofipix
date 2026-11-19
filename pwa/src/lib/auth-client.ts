import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

import { pwaEnvironment } from "../config/environment";

export const authClient = createAuthClient({
  baseURL: pwaEnvironment.API_URL,
  plugins: [organizationClient()],
  fetchOptions: {
    credentials: "include",
  },
});

export function describeAuthError(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }
  return fallback;
}

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

import { config } from "./config";

export const authClient = createAuthClient({
  baseURL: config.API_URL,
  plugins: [organizationClient()],
});

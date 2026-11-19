import { PowerSyncDatabase } from "@powersync/web";

import { AppSchema } from "./schema";

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: "lofipix-pwa.db",
    vfs: "auto",
  },
});

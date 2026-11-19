function requiredValue(name: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing required PWA configuration value: ${name}`);
  }
  return trimmed;
}

export const pwaEnvironment = {
  API_URL: requiredValue("VITE_API_URL", import.meta.env.VITE_API_URL),
  WEB_URL: requiredValue("VITE_WEB_URL", import.meta.env.VITE_WEB_URL),
  POWERSYNC_URL: requiredValue("VITE_POWERSYNC_URL", import.meta.env.VITE_POWERSYNC_URL),
} as const;

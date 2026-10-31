export interface AppConfig {
  WEBSITE_URL: string;
  WEBAPP_URL: string;
  API_URL: string;
}

const DEV_HOST = '192.168.1.15';

function detectConfig(): AppConfig {
  if (typeof window === "undefined") {
    // Build-time fallback (config is resolved at runtime in the browser).
    return {
      WEBSITE_URL: `http://${DEV_HOST}:5173/`,
      WEBAPP_URL: `http://${DEV_HOST}:5174/`,
      API_URL: `http://${DEV_HOST}:5634/`,
    };
  }

  const { hostname } = window.location;
  if (hostname === DEV_HOST) {
    return {
      WEBSITE_URL: `http://${DEV_HOST}:5173/`,
      WEBAPP_URL: `http://${DEV_HOST}:5174/`,
      API_URL: `http://${DEV_HOST}:5634/`,
    };
  }

  return {
    WEBSITE_URL: "https://www.lofipix.app/",
    WEBAPP_URL: "https://pwa.lofipix.app/",
    API_URL: "https://oceania.lofipix.app/",
  };
}

export const config = detectConfig();

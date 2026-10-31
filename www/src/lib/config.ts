export interface AppConfig {
  WEBSITE_URL: string;
  WEBAPP_URL: string;
  API_URL: string;
}

function detectConfig(): AppConfig {
  if (typeof window === "undefined") {
    // SSR/build time fallback
    return {
      WEBSITE_URL: "http://localhost:5173/",
      WEBAPP_URL: "http://localhost:5174/",
      API_URL: "http://localhost:5634/",
    };
  }

  const { port } = window.location;
  // Development: port 5173
  if (port === "5173") {
    return {
      WEBSITE_URL: "http://192.168.1.15:5173/",
      WEBAPP_URL: "http://192.168.1.15:5174/",
      API_URL: "http://192.168.1.15:5634/",
    };
  }

  // Production
  return {
    WEBSITE_URL: "https://www.lofipix.app/",
    WEBAPP_URL: "https://pwa.lofipix.app/",
    API_URL: "https://oceania.lofipix.app/",
  };
}

export const config = detectConfig();

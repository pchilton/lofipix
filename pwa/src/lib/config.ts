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

  const { hostname, port } = window.location;

  // Development: port 5174. Use the hostname the app was loaded from so the
  // website, PWA and API share a site and session cookies are sent.
  if (port === "5174") {
    return {
      WEBSITE_URL: `http://${hostname}:5173/`,
      WEBAPP_URL: `http://${hostname}:5174/`,
      API_URL: `http://${hostname}:5634/`,
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

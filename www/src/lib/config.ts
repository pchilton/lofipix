export interface AppConfig {
  WEBSITE_URL: string;
  API_URL: string;
}

const DEV_HOST = "192.168.1.15";

function detectConfig(): AppConfig {
  if (typeof window === "undefined") {
    return {
      WEBSITE_URL: `http://${DEV_HOST}:5173/`,
      API_URL: `http://${DEV_HOST}:5634/`,
    };
  }

  const { hostname } = window.location;
  if (hostname === DEV_HOST) {
    return {
      WEBSITE_URL: `http://${DEV_HOST}:5173/`,
      API_URL: `http://${DEV_HOST}:5634/`,
    };
  }

  return {
    WEBSITE_URL: "https://www.lofipix.app/",
    API_URL: "https://oceania.lofipix.app/",
  };
}

export const config = detectConfig();

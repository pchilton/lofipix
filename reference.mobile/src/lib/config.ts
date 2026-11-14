export const config = {
  API_URL: __DEV__ ? 'http://192.168.1.15:5634/' : 'https://oceania.lofipix.app/',
  WEBSITE_URL: __DEV__ ? 'http://192.168.1.15:5173/' : 'https://www.lofipix.app/',
} as const;

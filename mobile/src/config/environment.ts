import Config, { type NativeConfig } from 'react-native-config';

function requiredValue(name: keyof NativeConfig) {
  const value = Config[name]?.trim();
  if (!value) {
    throw new Error(`Missing required mobile configuration value: ${name}`);
  }
  return value;
}

export const mobileEnvironment = {
  API_URL: requiredValue('API_URL'),
  WEB_URL: requiredValue('WEB_URL'),
  POWERSYNC_URL: requiredValue('POWERSYNC_URL'),
};

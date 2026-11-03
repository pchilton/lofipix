import { SvgXml } from 'react-native-svg';

import { icons, type IconName } from './registry';

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 20, color = '#0f172a' }: IconProps) {
  const icon = icons[name];
  const body = icon.body.replaceAll('currentColor', color);
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${icon.width} ${icon.height}" color="${color}">${body}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} color={color} />;
}

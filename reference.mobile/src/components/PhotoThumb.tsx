import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';

import { loadPhotoUri } from '../lib/photo-capture';
import { colors, radius, spacing } from '../theme/tokens';

export function PhotoThumb({
  photoId,
  label,
  style,
  imageStyle,
}: {
  photoId: string;
  label?: string;
  style?: StyleProp<ImageStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}) {
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    setUri(null);
    void loadPhotoUri(photoId).then((next) => {
      if (!disposed) {
        setUri(next);
      }
    });
    return () => {
      disposed = true;
    };
  }, [photoId]);

  if (!uri) {
    return (
      <View style={[styles.placeholder, style as StyleProp<ImageStyle>]}>
        <Text style={styles.placeholderText}>Device-only photo</Text>
      </View>
    );
  }

  return <Image source={{ uri }} style={[styles.image, style, imageStyle]} accessibilityLabel={label} />;
}

const styles = StyleSheet.create({
  image: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  placeholder: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs,
  },
  placeholderText: {
    fontSize: 10,
    color: colors.muted,
    textAlign: 'center',
  },
});

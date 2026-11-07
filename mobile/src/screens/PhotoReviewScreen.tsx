import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '../components/PhotoThumb';
import { SyncChip } from '../components/SyncChip';
import { Icon } from '../icons/Icon';
import { deletePhoto } from '../lib/domain/photos';
import { useAlbumPhotos } from '../lib/hooks';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme/tokens';
import { AppText, Button, Card, Header, Screen } from '../ui';

type ReviewRoute = RouteProp<RootStackParamList, 'PhotoReview'>;

export function PhotoReviewScreen() {
  const route = useRoute<ReviewRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { albumId, photoId } = route.params;
  const photos = useAlbumPhotos(albumId);
  const [index, setIndex] = useState(0);

  const albumPhotos = useMemo(() => photos.data ?? [], [photos.data]);
  const photo = albumPhotos[index];

  useEffect(() => {
    const found = albumPhotos.findIndex((candidate) => candidate.id === photoId);
    setIndex(found >= 0 ? found : 0);
  }, [albumPhotos, photoId]);

  if (!photo) {
    return (
      <Screen testID="photo-review-screen">
        <AppText variant="heading">Photo not found</AppText>
        <Button label="Back to album" onPress={() => navigation.navigate('Finish', { albumId })} />
      </Screen>
    );
  }

  function confirmDelete() {
    Alert.alert('Delete photo', 'The photo is removed locally and the delete syncs to other devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deletePhoto(photo.id);
            navigation.navigate('Finish', { albumId });
          })();
        },
      },
    ]);
  }

  return (
    <Screen testID="photo-review-screen">
      <Header
        title={`Photo #${photo.position}`}
        subtitle={`${index + 1} of ${albumPhotos.length}`}
        right={<SyncChip queued={Boolean(photo.$hasPendingWrites)} />}
      />

      <PhotoThumb photoId={photo.id} label={`Photo ${photo.position}`} style={styles.image} imageStyle={styles.imageInner} />

      <Card>
        <View style={styles.detailRow}>
          <AppText variant="muted">Dimensions</AppText>
          <AppText variant="body">
            {photo.image_width} × {photo.image_height}
          </AppText>
        </View>
        <View style={styles.detailRow}>
          <AppText variant="muted">Size</AppText>
          <AppText variant="body">{Math.round(photo.image_size / 1024)} KB</AppText>
        </View>
        <View style={styles.detailRow}>
          <AppText variant="muted">Captured</AppText>
          <AppText variant="body">{new Date(photo.originated_at ?? '').toLocaleString()}</AppText>
        </View>
        <View style={styles.detailRow}>
          <AppText variant="muted">Checksum</AppText>
          <AppText variant="small">{photo.image_checksum?.slice(0, 16) ?? '—'}…</AppText>
        </View>
      </Card>

      <View style={styles.pager}>
        <Button
          label="Previous"
          variant="secondary"
          icon={<Icon name="lucide:chevron-left" size={16} />}
          disabled={index <= 0}
          onPress={() => setIndex((current) => Math.max(0, current - 1))}
        />
        <Button
          label="Next"
          variant="secondary"
          icon={<Icon name="lucide:chevron-right" size={16} />}
          disabled={index >= albumPhotos.length - 1}
          onPress={() => setIndex((current) => Math.min(albumPhotos.length - 1, current + 1))}
        />
      </View>

      <Button
        testID="delete-photo-button"
        label="Delete photo"
        variant="danger"
        icon={<Icon name="lucide:trash-2" size={16} color={colors.primaryText} />}
        onPress={confirmDelete}
      />
      <Button label="Back to album" variant="ghost" onPress={() => navigation.navigate('Finish', { albumId })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 320 },
  imageInner: { width: '100%', height: 320, resizeMode: 'contain' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  pager: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
});

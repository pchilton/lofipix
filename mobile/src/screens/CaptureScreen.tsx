import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Camera, CameraType, type CameraApi } from 'react-native-camera-kit';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '../components/PhotoThumb';
import { Icon } from '../icons/Icon';
import { useAuth } from '../lib/auth';
import { capturePhoto } from '../lib/domain/photos';
import { useAlbum, useAlbumPhotos } from '../lib/hooks';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, Button, ErrorText, Screen } from '../ui';

type CaptureRoute = RouteProp<RootStackParamList, 'Capture'>;

export function CaptureScreen() {
  const route = useRoute<CaptureRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { albumId } = route.params;
  const { session } = useAuth();
  const album = useAlbum(albumId);
  const photos = useAlbumPhotos(albumId);
  const cameraRef = useRef<CameraApi>(null);
  const [permission, setPermission] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void (async () => {
      try {
        const current = cameraRef.current;
        if (!current) {
          return;
        }
        const status = await current.checkDeviceCameraAuthorizationStatus();
        if (status) {
          if (!disposed) setPermission('granted');
          return;
        }
        const granted = await current.requestDeviceCameraAuthorization();
        if (!disposed) setPermission(granted ? 'granted' : 'denied');
      } catch {
        if (!disposed) setPermission('denied');
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  async function takePhoto() {
    const organizationId = session?.organizationId;
    if (!organizationId) {
      setError('This account has no organisation.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const capture = await cameraRef.current?.capture();
      if (!capture) {
        throw new Error('The camera is not ready yet.');
      }
      await capturePhoto(albumId, organizationId, {
        uri: capture.uri,
        width: capture.width,
        height: capture.height,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The photo could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  const latest = [...(photos.data ?? [])].sort((a, b) => b.position - a.position).slice(0, 3);

  if (!album.data && !album.isLoading) {
    return (
      <Screen testID="capture-screen">
        <AppText variant="heading">Album not found</AppText>
        <AppText variant="muted">It may have been deleted, or it has not synced to this device yet.</AppText>
        <Button label="Back to albums" onPress={() => navigation.navigate('Dashboard')} />
      </Screen>
    );
  }

  return (
    <Screen testID="capture-screen" scroll={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="heading">{album.data?.name ?? 'Album'}</AppText>
          <AppText variant="muted">Take photos</AppText>
        </View>
        <Button
          testID="finish-album-button"
          label="Finish album"
          variant="secondary"
          onPress={() => navigation.navigate('Finish', { albumId })}
        />
      </View>

      <View style={styles.cameraWrap}>
        <Camera
          ref={cameraRef}
          style={styles.camera}
          cameraType={CameraType.Back}
          flashMode="auto"
          focusMode="on"
          onError={(event) => setError(event.nativeEvent.errorMessage)}
        />
        {permission !== 'granted' ? (
          <View style={styles.overlay}>
            {permission === 'checking' ? (
              <>
                <ActivityIndicator color={colors.primaryText} />
                <AppText variant="body" style={styles.overlayText}>
                  Waiting for camera permission…
                </AppText>
              </>
            ) : (
              <>
                <Icon name="lucide:alert-circle" size={28} color={colors.primaryText} />
                <AppText variant="body" style={styles.overlayText}>
                  Camera access is required to capture damage photos. Enable it in the device settings and
                  try again.
                </AppText>
                <Button
                  label="Allow camera"
                  onPress={() => void cameraRef.current?.requestDeviceCameraAuthorization().then((granted) => setPermission(granted ? 'granted' : 'denied'))}
                />
              </>
            )}
          </View>
        ) : null}
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}

      <View style={styles.footer}>
        <Button
          testID="capture-button"
          label={busy ? 'Saving…' : 'Capture'}
          loading={busy}
          disabled={permission !== 'granted'}
          icon={<Icon name="lucide:camera" size={18} color={colors.primaryText} />}
          onPress={() => void takePhoto()}
        />
        <View style={styles.thumbs}>
          {latest.map((photo) => (
            <PhotoThumb key={photo.id} photoId={photo.id} label={`Photo ${photo.position}`} style={styles.thumb} />
          ))}
        </View>
        <AppText variant="muted">
          {photos.data?.length ?? 0} photo{(photos.data?.length ?? 0) === 1 ? '' : 's'} captured
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  cameraWrap: {
    flex: 1,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.camera,
    minHeight: 280,
  },
  camera: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  overlayText: { color: colors.primaryText, textAlign: 'center' },
  footer: { padding: spacing.lg, gap: spacing.md },
  thumbs: { flexDirection: 'row', gap: spacing.sm },
  thumb: { width: 56, height: 56 },
});

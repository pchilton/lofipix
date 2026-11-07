import { useForm, useStore } from '@tanstack/react-form';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { PhotoThumb } from '../components/PhotoThumb';
import { SyncChip } from '../components/SyncChip';
import { Icon } from '../icons/Icon';
import { useAuth } from '../lib/auth';
import { createAlbum } from '../lib/domain/albums';
import { errorText } from '../lib/form';
import { useAlbums, usePhotos, useSyncLabel } from '../lib/hooks';
import { colors, radius, spacing } from '../theme/tokens';
import type { RootStackParamList } from '../navigation/types';
import { AppText, Button, Card, ErrorText, Header, Screen, TextField } from '../ui';

const albumNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter an album name.')
  .max(80, 'Keep the album name under 80 characters.');
const notesSchema = z.string().max(2000, 'Keep notes under 2000 characters.');

function normalizedName(value: string): string {
  return value.trim().toLowerCase();
}

export function DashboardScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session, signOut } = useAuth();
  const albumsQuery = useAlbums();
  const photosQuery = usePhotos();
  const syncLabel = useSyncLabel();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const albums = useMemo(() => albumsQuery.data ?? [], [albumsQuery.data]);
  const photos = useMemo(() => photosQuery.data ?? [], [photosQuery.data]);

  const photosByAlbum = useMemo(() => {
    const grouped = new Map<string, typeof photos>();
    for (const photo of photos) {
      const list = grouped.get(photo.album_id) ?? [];
      list.push(photo);
      grouped.set(photo.album_id, list);
    }
    return grouped;
  }, [photos]);

  const form = useForm({
    defaultValues: { name: '', notes: '' },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      const organizationId = session?.organizationId;
      if (!organizationId) {
        setSubmitError('This account has no organisation. Ask an administrator to add you.');
        return;
      }
      if (!value.name.trim()) {
        setSubmitError('Enter an album name.');
        return;
      }
      setPending(true);
      try {
        const albumId = await createAlbum(organizationId, value.name, value.notes);
        form.reset();
        navigation.navigate('Capture', { albumId });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'The album could not be created.');
      } finally {
        setPending(false);
      }
    },
  });

  const name = useStore(form.store, (state) => state.values.name ?? '');
  const duplicate = useMemo(() => {
    const candidate = normalizedName(name);
    if (!candidate) {
      return undefined;
    }
    return albums.find((album) => normalizedName(album.name) === candidate);
  }, [albums, name]);

  function handleSignOut() {
    void signOut();
  }

  return (
    <Screen testID="dashboard-screen">
      <Header
        title="Albums"
        subtitle={syncLabel}
        right={
          <Button
            testID="sign-out-button"
            label="Sign out"
            variant="secondary"
            icon={<Icon name="lucide:log-out" size={16} color={colors.text} />}
            onPress={handleSignOut}
          />
        }
      />

      {albumsQuery.error || photosQuery.error ? (
        <ErrorText>Sync error: {albumsQuery.error ?? photosQuery.error}</ErrorText>
      ) : null}

      <Card>
        <AppText variant="heading">New album</AppText>
        <form.Field name="name" validators={{ onBlur: albumNameSchema }}>
          {(field) => (
            <TextField
              testID="album-name-input"
              label="Album name"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={errorText(field.state.meta.errors) ?? undefined}
              maxLength={80}
              placeholder="e.g. AB12 CDE"
            />
          )}
        </form.Field>
        <form.Field name="notes" validators={{ onBlur: notesSchema }}>
          {(field) => (
            <TextField
              testID="album-notes-input"
              label="Notes"
              value={field.state.value}
              onChangeText={field.handleChange}
              onBlur={field.handleBlur}
              error={errorText(field.state.meta.errors) ?? undefined}
              multiline
              placeholder="Optional notes"
            />
          )}
        </form.Field>

        {duplicate ? (
          <View style={styles.warning}>
            <AppText variant="small">
              An album named “{duplicate.name}” already exists.
            </AppText>
            <Button
              label="Review existing"
              variant="secondary"
              onPress={() => navigation.navigate('Finish', { albumId: duplicate.id, existing: true })}
            />
          </View>
        ) : (
          <Button
            testID="start-album-button"
            label={pending ? 'Creating…' : 'Start album'}
            loading={pending}
            onPress={() => void form.handleSubmit()}
          />
        )}

        {submitError ? <ErrorText>{submitError}</ErrorText> : null}
      </Card>

      <AppText variant="heading">Recent albums</AppText>
      {albums.length === 0 ? (
        <Card>
          <AppText variant="muted">No albums yet. Start one above.</AppText>
        </Card>
      ) : (
        albums.map((album) => {
          const albumPhotos = photosByAlbum.get(album.id) ?? [];
          return (
            <Card key={album.id}>
              <Pressable
                testID={`album-${album.id}`}
                onPress={() => navigation.navigate('Finish', { albumId: album.id })}
                style={styles.albumRow}
              >
                <View style={styles.albumText}>
                  <AppText variant="heading">{album.name}</AppText>
                  <AppText variant="muted">
                    {albumPhotos.length} photo{albumPhotos.length === 1 ? '' : 's'}
                  </AppText>
                </View>
                <SyncChip queued={Boolean(album.$hasPendingWrites)} />
              </Pressable>
              <View style={styles.thumbs}>
                {albumPhotos.slice(0, 4).map((photo) => (
                  <PhotoThumb key={photo.id} photoId={photo.id} label={`Photo ${photo.position}`} />
                ))}
              </View>
              <Button
                label="Take photos"
                variant="secondary"
                onPress={() => navigation.navigate('Capture', { albumId: album.id })}
              />
            </Card>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  albumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  albumText: { flex: 1, gap: spacing.xs },
  thumbs: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  warning: {
    gap: spacing.sm,
    backgroundColor: colors.warningSurface,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});

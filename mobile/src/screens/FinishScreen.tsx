import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { PhotoThumb } from '../components/PhotoThumb';
import { SyncChip } from '../components/SyncChip';
import { Icon } from '../icons/Icon';
import { touchAlbum, updateAlbumNotes } from '../lib/domain/albums';
import { deletePhoto } from '../lib/domain/photos';
import { useAlbum, useAlbumPhotos } from '../lib/hooks';
import type { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme/tokens';
import { AppText, Button, Card, ErrorText, Header, Screen, TextField } from '../ui';

type FinishRoute = RouteProp<RootStackParamList, 'Finish'>;

export function FinishScreen() {
  const route = useRoute<FinishRoute>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { albumId, existing } = route.params;
  const album = useAlbum(albumId);
  const photos = useAlbumPhotos(albumId);
  const [notes, setNotes] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesPending, setNotesPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);

  useEffect(() => {
    if (album.data) {
      setNotes(album.data.notes ?? '');
    }
  }, [album.data]);

  async function saveNotes() {
    setNotesPending(true);
    setError(null);
    try {
      await updateAlbumNotes(albumId, notes);
      setNotesSaved(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The notes could not be saved.');
    } finally {
      setNotesPending(false);
    }
  }

  function confirmDelete(photoId: string) {
    Alert.alert('Delete photo', 'The photo is removed locally and the delete syncs to other devices.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deletePhoto(photoId);
        },
      },
    ]);
  }

  async function submitAlbum() {
    setSubmitPending(true);
    setError(null);
    try {
      await touchAlbum(albumId);
      navigation.navigate('Dashboard');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not submit the album.');
    } finally {
      setSubmitPending(false);
    }
  }

  if (!album.data && !album.isLoading) {
    return (
      <Screen testID="finish-screen">
        <AppText variant="heading">Album not found</AppText>
        <Button label="Back to albums" onPress={() => navigation.navigate('Dashboard')} />
      </Screen>
    );
  }

  const albumPhotos = photos.data ?? [];

  return (
    <Screen testID="finish-screen">
      <Header
        title={album.data?.name ?? 'Album'}
        subtitle={`${albumPhotos.length} photo${albumPhotos.length === 1 ? '' : 's'}${existing ? ' · album already existed' : ''}`}
        right={<Button label="Back" variant="secondary" onPress={() => navigation.navigate('Dashboard')} />}
      />

      <Card>
        <AppText variant="heading">Notes</AppText>
        <TextField
          testID="album-notes-edit"
          label="Notes"
          value={notes}
          onChangeText={(value) => {
            setNotes(value);
            setNotesSaved(false);
          }}
          multiline
          placeholder="Optional notes"
        />
        <View style={styles.row}>
          <Button
            testID="save-notes-button"
            label={notesPending ? 'Saving…' : 'Save notes'}
            variant="secondary"
            loading={notesPending}
            disabled={!album.data || notes === (album.data.notes ?? '')}
            onPress={() => void saveNotes()}
          />
          {notesSaved ? <AppText variant="muted">Saved locally.</AppText> : null}
        </View>
      </Card>

      <View style={styles.sectionHeader}>
        <AppText variant="heading">Photos</AppText>
        <Button
          testID="add-photos-button"
          label="Add photos"
          variant={existing ? 'primary' : 'secondary'}
          icon={<Icon name="lucide:plus" size={16} />}
          onPress={() => navigation.navigate('Capture', { albumId })}
        />
      </View>

      {albumPhotos.length === 0 ? (
        <Card>
          <AppText variant="muted">No photos yet.</AppText>
        </Card>
      ) : (
        <View style={styles.grid}>
          {albumPhotos.map((photo) => (
            <Card key={photo.id} style={styles.photoTile}>
              <Pressable
                testID={`photo-tile-${photo.position}`}
                onPress={() => navigation.navigate('PhotoReview', { albumId, photoId: photo.id })}
              >
                <PhotoThumb photoId={photo.id} label={`Photo ${photo.position}`} style={styles.photo} />
              </Pressable>
              <View style={styles.photoFooter}>
                <AppText variant="small">#{photo.position}</AppText>
                <SyncChip queued={Boolean(photo.$hasPendingWrites)} />
              </View>
              <Button label="Delete" variant="danger" onPress={() => confirmDelete(photo.id)} />
            </Card>
          ))}
        </View>
      )}

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button
        testID="submit-album-button"
        label={submitPending ? 'Submitting…' : 'Submit album'}
        loading={submitPending}
        icon={<Icon name="lucide:check" size={18} color={colors.primaryText} />}
        onPress={() => void submitAlbum()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  photoTile: { width: '47%', padding: spacing.md, gap: spacing.sm },
  photo: { width: '100%', height: 120, borderRadius: radius.md },
  photoFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

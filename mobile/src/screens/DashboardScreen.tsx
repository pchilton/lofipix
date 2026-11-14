import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCameraPermission } from 'react-native-vision-camera';
import { SafeAreaView } from 'react-native-safe-area-context';

type DashboardScreenProps = {
  onOpenSettings: () => void;
};

export function DashboardScreen({ onOpenSettings }: DashboardScreenProps) {
  const {
    canRequestPermission,
    hasPermission,
    requestPermission,
    status,
  } = useCameraPermission();
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    if (hasPermission || !canRequestPermission || hasRequestedPermission) return;

    setHasRequestedPermission(true);
    setIsRequestingPermission(true);
    requestPermission()
      .then(granted => {
        if (!granted) {
          setPermissionError('Camera access was not granted.');
        }
      })
      .catch(() => {
        setPermissionError('Unable to request camera access.');
      })
      .finally(() => setIsRequestingPermission(false));
  }, [canRequestPermission, hasPermission, hasRequestedPermission, requestPermission]);

  const handlePermissionAction = async () => {
    setPermissionError(null);
    if (!canRequestPermission) {
      try {
        await Linking.openSettings();
      } catch {
        setPermissionError('Unable to open device settings.');
      }
      return;
    }

    setHasRequestedPermission(true);
    setIsRequestingPermission(true);
    try {
      const granted = await requestPermission();
      if (!granted) setPermissionError('Camera access was not granted.');
    } catch {
      setPermissionError('Unable to request camera access.');
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const permissionMessage = hasPermission
    ? 'Camera access is enabled.'
    : permissionError ??
      (status === 'restricted'
        ? 'Camera access is restricted on this device.'
        : status === 'denied'
          ? 'Camera access is denied. Enable it in Settings to take photos.'
          : 'Allow camera access to take vehicle damage photos.');

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.brandMark}>
            <View style={styles.cameraBody}>
              <View style={styles.cameraLens} />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onOpenSettings}
            style={styles.settingsButton}
            testID="dashboard-settings-button"
          >
            <Text style={styles.settingsButtonText}>Settings</Text>
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={styles.title} testID="dashboard-title">
          Welcome to LoFi Pix
        </Text>
        <Text style={styles.subtitle}>Your workspace is ready.</Text>

        <View style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>Camera access</Text>
          {isRequestingPermission ? (
            <View style={styles.requesting}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.permissionMessage}>Requesting camera access…</Text>
            </View>
          ) : (
            <Text
              accessibilityRole={permissionError ? 'alert' : undefined}
              style={styles.permissionMessage}
              testID="camera-permission-status"
            >
              {permissionMessage}
            </Text>
          )}
          {!hasPermission && !isRequestingPermission && status !== 'restricted' ? (
            <Pressable
              accessibilityRole="button"
              onPress={handlePermissionAction}
              style={({ pressed }) => [
                styles.permissionButton,
                pressed && styles.permissionButtonPressed,
              ]}
              testID="camera-permission-action"
            >
              <Text style={styles.permissionButtonText}>
                {canRequestPermission ? 'Allow camera access' : 'Open settings'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const colors = {
  background: '#F4F7F5',
  border: '#D9E2DD',
  muted: '#5E6F68',
  primary: '#176B52',
  primaryDark: '#115640',
  text: '#17231F',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
    width: '100%',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  settingsButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  settingsButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  cameraBody: {
    alignItems: 'center',
    borderColor: colors.white,
    borderRadius: 7,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 29,
  },
  cameraLens: {
    borderColor: colors.white,
    borderRadius: 6,
    borderWidth: 2,
    height: 12,
    width: 12,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    marginBottom: 28,
  },
  permissionCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  permissionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  permissionMessage: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  requesting: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  permissionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  permissionButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  permissionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});

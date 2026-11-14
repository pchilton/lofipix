import { useState } from 'react';
import {
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type SettingsScreenProps = {
  email: string;
  onBack: () => void;
  onLogout: () => Promise<void>;
};

export function SettingsScreen({ email, onBack, onLogout }: SettingsScreenProps) {
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const handleRevokeCameraAccess = async () => {
    try {
      await Linking.openSettings();
    } catch {
      setPermissionError('Unable to open device settings.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={onBack}
            style={styles.backButton}
            testID="settings-back-button"
          >
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title} testID="settings-title">
            Settings
          </Text>
        </View>

        <View style={styles.accountCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Text style={styles.label}>Signed in as</Text>
          <Text style={styles.email} testID="settings-account-email">
            {email}
          </Text>
        </View>

        {__DEV__ ? (
          <View style={styles.developmentCard}>
            <Text style={styles.sectionTitle}>Development</Text>
            <Text style={styles.label}>
              Open device settings and turn Camera access off to test the denied state.
            </Text>
            {permissionError ? (
              <Text accessibilityRole="alert" style={styles.permissionError}>
                {permissionError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Opens device settings to change camera access"
              onPress={handleRevokeCameraAccess}
              style={({ pressed }) => [
                styles.permissionButton,
                pressed && styles.permissionButtonPressed,
              ]}
              testID="revoke-camera-access-button"
            >
              <Text style={styles.permissionButtonText}>Revoke camera access</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.logoutButtonPressed,
          ]}
          testID="logout-button"
        >
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const colors = {
  background: '#F4F7F5',
  border: '#D9E2DD',
  error: '#B42318',
  muted: '#5E6F68',
  primary: '#176B52',
  primaryDark: '#115640',
  text: '#17231F',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  page: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 28,
    minHeight: 48,
  },
  backButton: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 64,
  },
  backText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 8,
  },
  accountCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  developmentCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    marginTop: 16,
    padding: 20,
  },
  permissionError: {
    color: colors.error,
    fontSize: 13,
  },
  permissionButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderColor: colors.primary,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  permissionButtonPressed: {
    opacity: 0.75,
  },
  permissionButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 14,
  },
  email: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    justifyContent: 'center',
    marginTop: 'auto',
    minHeight: 52,
  },
  logoutButtonPressed: {
    backgroundColor: colors.primaryDark,
  },
  logoutText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});

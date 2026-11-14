import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  restoreAuthSession,
  signInWithEmail,
  signOut,
  type MobileUser,
} from './src/lib/auth';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';

function App() {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [page, setPage] = useState<'dashboard' | 'settings'>('dashboard');
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  useEffect(() => {
    let active = true;
    restoreAuthSession()
      .then(session => {
        if (active) setUser(session);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsRestoringSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    setUser(await signInWithEmail(email, password));
    setPage('dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      if (__DEV__) console.warn('[LoFi Pix Auth] Failed to clear the saved session.');
    } finally {
      setUser(null);
      setPage('dashboard');
    }
  };

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      {isRestoringSession ? (
        <SafeAreaView style={styles.loadingScreen}>
          <ActivityIndicator color="#176B52" size="large" />
        </SafeAreaView>
      ) : user ? (
        page === 'settings' ? (
          <SettingsScreen
            email={user.email}
            onBack={() => setPage('dashboard')}
            onLogout={handleLogout}
          />
        ) : (
          <DashboardScreen onOpenSettings={() => setPage('settings')} />
        )
      ) : (
        <WelcomeScreen onSignIn={handleSignIn} />
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: '#F4F7F5',
    flex: 1,
    justifyContent: 'center',
  },
});

export default App;

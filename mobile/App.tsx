import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './src/lib/auth';
import type { RootStackParamList } from './src/navigation/types';
import { CaptureScreen } from './src/screens/CaptureScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { FinishScreen } from './src/screens/FinishScreen';
import { PhotoReviewScreen } from './src/screens/PhotoReviewScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors } from './src/theme/tokens';

const Stack = createNativeStackNavigator<RootStackParamList>();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 10_000 },
  },
});

function AppNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'signed-in' ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="Capture" component={CaptureScreen} />
            <Stack.Screen name="Finish" component={FinishScreen} />
            <Stack.Screen name="PhotoReview" component={PhotoReviewScreen} />
          </>
        ) : (
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});

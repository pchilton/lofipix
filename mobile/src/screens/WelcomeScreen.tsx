import { useRef, useState, type ElementRef } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type FieldErrors = {
  email: string | null;
  password: string | null;
};

type WelcomeScreenProps = {
  onSignIn?: (email: string, password: string) => Promise<void>;
};

function validateEmail(value: string) {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Enter a valid email address.';
  }
  return null;
}

function validatePassword(value: string) {
  return value.length > 0 ? null : 'Enter your password.';
}

export function WelcomeScreen({ onSignIn }: WelcomeScreenProps) {
  const passwordInput = useRef<ElementRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({
    email: null,
    password: null,
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    const errors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    setAuthError(null);

    if (errors.email || errors.password) return;
    if (!onSignIn) {
      setAuthError('Sign-in is not connected yet.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSignIn(email.trim(), password);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : 'Unable to sign in. Try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setFieldErrors(current => ({
      ...current,
      email: current.email ? validateEmail(value) : null,
    }));
    setAuthError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setFieldErrors(current => ({
      ...current,
      password: current.password ? validatePassword(value) : null,
    }));
    setAuthError(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <View style={styles.brand}>
              <View style={styles.brandMark}>
                <View style={styles.cameraBody}>
                  <View style={styles.cameraLens} />
                </View>
              </View>
              <Text style={styles.brandName}>LOFI PIX</Text>
            </View>

            <View style={styles.intro}>
              <Text accessibilityRole="header" style={styles.title} testID="welcome-title">
                Welcome to LoFi Pix
              </Text>
              <Text style={styles.subtitle}>
                Sign in to capture and manage vehicle damage photos.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  accessibilityLabel="Email address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  keyboardType="email-address"
                  maxLength={254}
                  onChangeText={handleEmailChange}
                  onSubmitEditing={() => passwordInput.current?.focus()}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="next"
                  selectionColor={colors.primary}
                  style={[styles.input, fieldErrors.email && styles.inputError]}
                  testID="sign-in-email"
                  textContentType="emailAddress"
                  value={email}
                />
                {fieldErrors.email ? (
                  <Text accessibilityRole="alert" style={styles.fieldError} testID="email-error">
                    {fieldErrors.email}
                  </Text>
                ) : null}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  ref={passwordInput}
                  accessibilityLabel="Password"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  maxLength={128}
                  onChangeText={handlePasswordChange}
                  onSubmitEditing={handleSignIn}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.placeholder}
                  returnKeyType="done"
                  secureTextEntry
                  selectionColor={colors.primary}
                  style={[styles.input, fieldErrors.password && styles.inputError]}
                  testID="sign-in-password"
                  textContentType="password"
                  value={password}
                />
                {fieldErrors.password ? (
                  <Text
                    accessibilityRole="alert"
                    style={styles.fieldError}
                    testID="password-error"
                  >
                    {fieldErrors.password}
                  </Text>
                ) : null}
              </View>

              {authError ? (
                <Text accessibilityRole="alert" style={styles.authError} testID="auth-error">
                  {authError}
                </Text>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  busy: isSubmitting,
                  disabled: isSubmitting,
                }}
                disabled={isSubmitting}
                onPress={handleSignIn}
                style={({ pressed }) => [
                  styles.button,
                  pressed && styles.buttonPressed,
                  isSubmitting && styles.buttonDisabled,
                ]}
                testID="sign-in-button"
              >
                <Text style={styles.buttonText}>
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                </Text>
              </Pressable>

              <Text style={styles.offlineNote}>
                Sign in requires an internet connection. After that, you can keep
                working offline.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const colors = {
  background: '#F4F7F5',
  border: '#D9E2DD',
  error: '#B42318',
  muted: '#5E6F68',
  placeholder: '#899891',
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    alignSelf: 'center',
    maxWidth: 480,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
  },
  brand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 16,
    height: 48,
    justifyContent: 'center',
    width: 48,
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
  brandName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  intro: {
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 39,
    marginBottom: 10,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  form: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 20,
    padding: 22,
  },
  fieldGroup: {
    gap: 8,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  inputError: {
    borderColor: colors.error,
  },
  fieldError: {
    color: colors.error,
    fontSize: 13,
  },
  authError: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 13,
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  offlineNote: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
});

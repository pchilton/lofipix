import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Icon } from '../icons/Icon';
import { useAuth } from '../lib/auth';
import { errorText } from '../lib/form';
import { colors, spacing } from '../theme/tokens';
import { AppText, Button, Card, ErrorText, Screen, TextField } from '../ui';

export function WelcomeScreen() {
  const { signIn } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm({
    defaultValues: { email: '', password: '' },
    onSubmit: async ({ value }) => {
      setSubmitError(null);
      setPending(true);
      try {
        await signIn(value.email, value.password);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Sign in failed.');
      } finally {
        setPending(false);
      }
    },
  });

  return (
    <Screen testID="welcome-screen">
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name="mdi:car-wrench" size={30} />
        </View>
        <AppText variant="title">lofipix</AppText>
        <AppText variant="muted">Sign in to capture vehicle damage photos.</AppText>
      </View>

      <Card>
        <View style={styles.form}>
          <form.Field name="email" validators={{ onBlur: z.email('Enter a valid email address.') }}>
            {(field) => {
              const message = errorText(field.state.meta.errors);
              return (
                <TextField
                  testID="sign-in-email"
                  label="Email"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  error={message ?? undefined}
                  autoCapitalize="none"
                  autoComplete="username"
                  keyboardType="email-address"
                  textContentType="username"
                />
              );
            }}
          </form.Field>

          <form.Field name="password" validators={{ onBlur: z.string().min(1, 'Enter your password.') }}>
            {(field) => {
              const message = errorText(field.state.meta.errors);
              return (
                <TextField
                  testID="sign-in-password"
                  label="Password"
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  error={message ?? undefined}
                  secureTextEntry
                  autoComplete="current-password"
                  textContentType="password"
                />
              );
            }}
          </form.Field>

          {submitError ? <ErrorText>{submitError}</ErrorText> : null}

          <Button
            testID="sign-in-button"
            label={pending ? 'Signing in…' : 'Sign in'}
            loading={pending}
            onPress={() => void form.handleSubmit()}
          />
        </View>
      </Card>

      <AppText variant="muted" style={styles.footer}>
        The mobile app stores photos on this device and syncs their details to your organisation. Sign-in
        needs a connection; after that the app works offline.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
  },
  form: { gap: spacing.md },
  footer: { textAlign: 'center' },
});

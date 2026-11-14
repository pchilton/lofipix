import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '../icons/Icon';
import { colors, radius, spacing, typography } from '../theme/tokens';

export function Screen({
  children,
  scroll = true,
  style,
  testID,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  testID?: string;
}) {
  return (
    <SafeAreaView testID={testID} style={[styles.safe, style]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={styles.fill}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function AppText({
  children,
  variant = 'body',
  style,
}: {
  children: React.ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'small' | 'muted';
  style?: object;
}) {
  const variantStyle =
    variant === 'title'
      ? styles.title
      : variant === 'heading'
        ? styles.heading
        : variant === 'small'
          ? styles.small
          : variant === 'muted'
            ? styles.muted
            : styles.body;
  return <Text style={[variantStyle, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="heading">{title}</AppText>
        {subtitle ? <AppText variant="muted">{subtitle}</AppText> : null}
      </View>
      {right}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const buttonStyle =
    variant === 'danger'
      ? styles.buttonDanger
      : variant === 'secondary'
        ? styles.buttonSecondary
        : variant === 'ghost'
          ? styles.buttonGhost
          : styles.buttonPrimary;
  const textStyle =
    variant === 'primary' || variant === 'danger' ? styles.buttonTextLight : styles.buttonText;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        buttonStyle,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && !loading ? styles.buttonPressed : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.primaryText : colors.text} /> : icon}
      <Text style={[styles.buttonTextBase, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  testID,
  multiline,
  ...props
}: TextInputProps & { label: string; error?: string; testID?: string }) {
  return (
    <View style={styles.field}>
      <AppText variant="small">{label}</AppText>
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline ? styles.inputMultiline : null, error ? styles.inputError : null]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

export function Chip({
  label,
  tone = 'muted',
}: {
  label: string;
  tone?: 'muted' | 'queued' | 'synced' | 'danger';
}) {
  const toneStyle =
    tone === 'queued'
      ? styles.chipQueued
      : tone === 'synced'
        ? styles.chipSynced
        : tone === 'danger'
          ? styles.chipDanger
          : styles.chipMuted;
  return (
    <View style={[styles.chip, toneStyle]}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.empty}>
      <Icon name="lucide:folder-open" size={28} color={colors.muted} />
      <AppText variant="heading">{title}</AppText>
      <AppText variant="muted">{body}</AppText>
    </View>
  );
}

export function InlineIcon({ name, color = colors.muted, size = 16 }: { name: Parameters<typeof Icon>[0]['name']; color?: string; size?: number }) {
  return <Icon name={name} color={color} size={size} />;
}

export const uiStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  title: { fontSize: typography.title, fontWeight: '700', color: colors.text },
  heading: { fontSize: typography.heading, fontWeight: '600', color: colors.text },
  body: { fontSize: typography.body, color: colors.text },
  small: { fontSize: typography.small, color: colors.text, fontWeight: '500' },
  muted: { fontSize: typography.small, color: colors.muted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  headerText: { flex: 1, gap: spacing.xs },
  button: {
    minHeight: 44,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  buttonDanger: { backgroundColor: colors.danger },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  buttonTextBase: { fontSize: typography.body, fontWeight: '600' },
  buttonText: { color: colors.text },
  buttonTextLight: { color: colors.primaryText },
  field: { gap: spacing.xs },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: typography.body,
  },
  inputMultiline: { minHeight: 96, paddingTop: spacing.md },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: typography.small },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, alignSelf: 'flex-start' },
  chipMuted: { backgroundColor: colors.surfaceMuted },
  chipQueued: { backgroundColor: colors.warningSurface },
  chipSynced: { backgroundColor: colors.successSurface },
  chipDanger: { backgroundColor: colors.dangerSurface },
  chipText: { fontSize: typography.tiny, fontWeight: '600', color: colors.text },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
});

const styles = uiStyles;

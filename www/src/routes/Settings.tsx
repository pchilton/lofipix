import { useForm } from "@tanstack/react-form";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldError,
  FieldLabel,
  Input,
  Separator,
} from "@lofipix/ui";
import { useState } from "react";
import { z } from "zod";
import IconEye from "~icons/lucide/eye";
import IconEyeOff from "~icons/lucide/eye-off";

import { authClient } from "../lib/auth-client";
import { describeError } from "../lib/organization";

interface PasswordInputProps {
  id: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  invalid?: boolean;
}

function PasswordInput({ id, name, autoComplete, value, onChange, onBlur, disabled, invalid }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-start gap-2">
      <Input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(event) => onChange(event.currentTarget.value)}
        onBlur={onBlur}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <IconEyeOff /> : <IconEye />}
      </Button>
    </div>
  );
}

function firstError(errors: readonly unknown[]): string | undefined {
  for (const error of errors) {
    if (typeof error === "string" && error.length > 0) {
      return error;
    }
    if (error && typeof error === "object" && "message" in error) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === "string" && message.length > 0) {
        return message;
      }
    }
  }
  return undefined;
}

export default function Settings() {
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordPending, setChangePasswordPending] = useState(false);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

  const changePasswordForm = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      setChangePasswordError(null);
      setChangePasswordSuccess(false);

      if (value.newPassword !== value.confirmPassword) {
        setChangePasswordError("New passwords do not match.");
        return;
      }

      if (value.newPassword.length < 8) {
        setChangePasswordError("New password must be at least 8 characters.");
        return;
      }

      setChangePasswordPending(true);
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      });
      setChangePasswordPending(false);

      if (error) {
        setChangePasswordError(describeError(error, "Failed to change password."));
        return;
      }

      setChangePasswordSuccess(true);
      changePasswordForm.reset();
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings. Photo capture happens in the mobile app.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Update your password. You will need to enter your current password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void changePasswordForm.handleSubmit();
            }}
          >
            <changePasswordForm.Field
              name="currentPassword"
              validators={{ onBlur: z.string().min(1, "Enter your current password.") }}
            >
              {(field) => {
                const message = firstError(field.state.meta.errors);
                return (
                  <Field data-invalid={Boolean(message)}>
                    <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                    <PasswordInput
                      id="current-password"
                      name={field.name}
                      autoComplete="current-password"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={Boolean(message)}
                    />
                    <FieldError>{message}</FieldError>
                  </Field>
                );
              }}
            </changePasswordForm.Field>

            <changePasswordForm.Field
              name="newPassword"
              validators={{ onBlur: z.string().min(8, "New password must be at least 8 characters.") }}
            >
              {(field) => {
                const message = firstError(field.state.meta.errors);
                return (
                  <Field data-invalid={Boolean(message)}>
                    <FieldLabel htmlFor="new-password">New password</FieldLabel>
                    <PasswordInput
                      id="new-password"
                      name={field.name}
                      autoComplete="new-password"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={Boolean(message)}
                    />
                    <FieldError>{message}</FieldError>
                  </Field>
                );
              }}
            </changePasswordForm.Field>

            <changePasswordForm.Field
              name="confirmPassword"
              validators={{ onBlur: z.string().min(1, "Confirm your new password.") }}
            >
              {(field) => {
                const message = firstError(field.state.meta.errors);
                return (
                  <Field data-invalid={Boolean(message)}>
                    <FieldLabel htmlFor="confirm-password">Confirm new password</FieldLabel>
                    <PasswordInput
                      id="confirm-password"
                      name={field.name}
                      autoComplete="new-password"
                      value={field.state.value}
                      onChange={field.handleChange}
                      onBlur={field.handleBlur}
                      invalid={Boolean(message)}
                    />
                    <FieldError>{message}</FieldError>
                  </Field>
                );
              }}
            </changePasswordForm.Field>

            {changePasswordError ? <FieldError>{changePasswordError}</FieldError> : null}
            {changePasswordSuccess ? (
              <div className="text-sm text-green-600 dark:text-green-400">Password changed successfully.</div>
            ) : null}

            <Button type="submit" className="w-full" disabled={changePasswordPending}>
              {changePasswordPending ? "Changing password…" : "Change password"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Separator className="flex-1" />
        <span>
          Need the capture app?{" "}
          <a href="/" className="underline underline-offset-4 hover:text-foreground">
            Learn about lofipix
          </a>
        </span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}
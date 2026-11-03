import { useForm } from "@tanstack/react-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
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
import { createOrganisation, describeError } from "../lib/organization";

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

export default function Auth() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { data: session } = authClient.useSession();

  const [signInError, setSignInError] = useState<string | null>(null);
  const [signInPending, setSignInPending] = useState(false);

  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signUpPending, setSignUpPending] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgPending, setOrgPending] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);

  function redirectTarget(): string | null {
    const target = search.redirect;
    return target && target.startsWith("/") ? target : null;
  }

  const signInForm = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setSignInError(null);
      setSignInPending(true);
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      });
      setSignInPending(false);
      if (error) {
        setSignInError(describeError(error, "Sign in failed."));
        return;
      }
      const target = redirectTarget();
      if (target) {
        window.location.assign(target);
      } else {
        await navigate({ to: "/dashboard" });
      }
    },
  });

  async function finishOrganisationSetup(organisationName: string): Promise<boolean> {
    setOrgError(null);
    setOrgPending(true);
    const result = await createOrganisation(organisationName);
    setOrgPending(false);
    if (result.ok) {
      await navigate({ to: "/dashboard" });
      return true;
    }
    setOrgError(result.message);
    return false;
  }

  const signUpForm = useForm({
    defaultValues: {
      organisationName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
    onSubmit: async ({ value }) => {
      setSignUpError(null);

      if (value.password !== value.confirmPassword) {
        setSignUpError("Passwords do not match.");
        return;
      }

      setSignUpPending(true);
      const { error } = await authClient.signUp.email({
        email: value.email,
        password: value.password,
        name: value.name,
      });
      setSignUpPending(false);
      if (error) {
        setSignUpError(describeError(error, "Sign up failed."));
        return;
      }

      setAccountCreated(true);
      await finishOrganisationSetup(value.organisationName);
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Sign in / Register</h1>
        <p className="text-muted-foreground">
          Manage your organisation and albums. Photo capture happens in the mobile app.
        </p>
        {session?.user ? (
          <p className="text-sm text-muted-foreground">Signed in as {session.user.email}.</p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use the email address and password for your account.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void signInForm.handleSubmit();
              }}
            >
              <signInForm.Field
                name="email"
                validators={{ onBlur: z.email("Enter a valid email address.") }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sign-in-email">Email address</FieldLabel>
                      <Input
                        id="sign-in-email"
                        name={field.name}
                        type="email"
                        required
                        autoComplete="email"
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.currentTarget.value)}
                        aria-invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </signInForm.Field>

              <signInForm.Field
                name="password"
                validators={{ onBlur: z.string().min(1, "Enter your password.") }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sign-in-password">Password</FieldLabel>
                      <PasswordInput
                        id="sign-in-password"
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
              </signInForm.Field>

              {signInError ? <FieldError>{signInError}</FieldError> : null}

              <Button type="submit" className="w-full" disabled={signInPending}>
                {signInPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create account</CardTitle>
            <CardDescription>
              Create your account and its organisation. You can retry the organisation step if it
              fails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void signUpForm.handleSubmit();
              }}
            >
              <signUpForm.Field
                name="organisationName"
                validators={{ onBlur: z.string().min(1, "Enter an organisation name.") }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sign-up-organisation">Organisation name</FieldLabel>
                      <Input
                        id="sign-up-organisation"
                        name={field.name}
                        type="text"
                        required
                        value={field.state.value}
                        disabled={accountCreated}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.currentTarget.value)}
                        aria-invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </signUpForm.Field>

              <signUpForm.Field
                name="name"
                validators={{ onBlur: z.string().min(1, "Enter your name.") }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sign-up-name">Name</FieldLabel>
                      <Input
                        id="sign-up-name"
                        name={field.name}
                        type="text"
                        required
                        autoComplete="name"
                        value={field.state.value}
                        disabled={accountCreated}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.currentTarget.value)}
                        aria-invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </signUpForm.Field>

              <signUpForm.Field
                name="email"
                validators={{ onBlur: z.email("Enter a valid email address.") }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sign-up-email">Email address</FieldLabel>
                      <Input
                        id="sign-up-email"
                        name={field.name}
                        type="email"
                        required
                        autoComplete="email"
                        value={field.state.value}
                        disabled={accountCreated}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.currentTarget.value)}
                        aria-invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </signUpForm.Field>

              <signUpForm.Field
                name="password"
                validators={{ onBlur: z.string().min(8, "Password must be at least 8 characters.") }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sign-up-password">Password</FieldLabel>
                      <PasswordInput
                        id="sign-up-password"
                        name={field.name}
                        autoComplete="new-password"
                        value={field.state.value}
                        disabled={accountCreated}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </signUpForm.Field>

              <signUpForm.Field
                name="confirmPassword"
                validators={{ onBlur: z.string().min(1, "Confirm your password.") }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="sign-up-confirm-password">Confirm password</FieldLabel>
                      <PasswordInput
                        id="sign-up-confirm-password"
                        name={field.name}
                        autoComplete="new-password"
                        value={field.state.value}
                        disabled={accountCreated}
                        onChange={field.handleChange}
                        onBlur={field.handleBlur}
                        invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </signUpForm.Field>

              {signUpError ? <FieldError>{signUpError}</FieldError> : null}

              {orgError ? (
                <div className="space-y-2">
                  <FieldError>{orgError}</FieldError>
                  <p className="text-sm text-muted-foreground">
                    Your account was created; retry to finish setting up the organisation.
                  </p>
                </div>
              ) : null}

              {accountCreated ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={orgPending}
                  onClick={() => void finishOrganisationSetup(signUpForm.state.values.organisationName)}
                >
                  {orgPending ? "Creating organisation…" : "Retry create organisation"}
                </Button>
              ) : (
                <Button type="submit" className="w-full" disabled={signUpPending}>
                  {signUpPending ? "Creating account…" : "Create account"}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Separator className="flex-1" />
        <span>
          Need the capture app?{" "}
          <Link to="/" className="underline underline-offset-4 hover:text-foreground">
            Learn about lofipix
          </Link>
        </span>
        <Separator className="flex-1" />
      </div>
    </div>
  );
}

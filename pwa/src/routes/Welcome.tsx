import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import {
  Badge,
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
} from "@lofipix/ui";
import { useState } from "react";
import { z } from "zod";
import IconCamera from "~icons/lucide/camera";
import IconCloudOff from "~icons/lucide/cloud-off";
import IconDownload from "~icons/lucide/download";
import IconWifiOff from "~icons/lucide/wifi-off";

import { describeAuthError } from "../lib/auth-client";
import { pwaEnvironment } from "../config/environment";
import { useSession } from "../lib/session";

const steps = [
  {
    icon: IconDownload,
    title: "Install from the browser",
    description: "Add LoFi Pix to your home screen. No app store or tester account.",
  },
  {
    icon: IconWifiOff,
    title: "Capture offline",
    description: "Albums and photo metadata live on the device first.",
  },
  {
    icon: IconCloudOff,
    title: "Sync when connected",
    description: "Changes sync when the network returns.",
  },
] as const;

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

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

export default function Welcome() {
  const { signIn, isStale, isOffline } = useSession();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setPending(true);
      try {
        await signIn(value.email.trim(), value.password);
        await navigate({ to: "/dashboard" });
      } catch (error) {
        setFormError(describeAuthError(error, "Sign-in failed."));
      } finally {
        setPending(false);
      }
    },
  });

  return (
    <div className="space-y-12">
      <section className="mx-auto max-w-3xl space-y-5 py-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted">
          <IconCamera className="size-8" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          <Badge variant="secondary">Progressive Web App</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            LoFi Pix in your browser
          </h1>
          <p className="text-lg text-muted-foreground">
            Sign in with your LoFi Pix account. Albums and photos are available offline once
            they have synced to this device.
          </p>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-4xl gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use the same account as the website and native app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isStale ? (
              <p className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
                Your session expired. Sign in again. Local work is kept on this device.
              </p>
            ) : null}
            {isOffline ? (
              <p className="mb-4 rounded-md border bg-muted px-3 py-2 text-sm">
                You are offline. Sign in once while online to use this device offline.
              </p>
            ) : null}

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <form.Field
                name="email"
                validators={{ onBlur: signInSchema.shape.email }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="email">Email</FieldLabel>
                      <Input
                        id="email"
                        name={field.name}
                        type="email"
                        autoComplete="email"
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.currentTarget.value)}
                        aria-invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </form.Field>

              <form.Field
                name="password"
                validators={{ onBlur: signInSchema.shape.password }}
              >
                {(field) => {
                  const message = firstError(field.state.meta.errors);
                  return (
                    <Field data-invalid={Boolean(message)}>
                      <FieldLabel htmlFor="password">Password</FieldLabel>
                      <Input
                        id="password"
                        name={field.name}
                        type="password"
                        autoComplete="current-password"
                        required
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.currentTarget.value)}
                        aria-invalid={Boolean(message)}
                      />
                      <FieldError>{message}</FieldError>
                    </Field>
                  );
                }}
              </form.Field>

              {formError ? <FieldError>{formError}</FieldError> : null}

              <Button type="submit" className="w-full" disabled={pending || isOffline}>
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-4 text-sm text-muted-foreground">
              Need an account or an organisation?{" "}
              <a className="underline underline-offset-4" href={pwaEnvironment.WEB_URL}>
                Use the website
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <Card key={step.title}>
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <CardTitle>{step.title}</CardTitle>
                  <CardDescription>{step.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}

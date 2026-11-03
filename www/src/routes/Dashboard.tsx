import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  Skeleton,
} from "@lofipix/ui";
import { useState } from "react";
import { z } from "zod";

import { authClient } from "../lib/auth-client";
import { createOrganisation, describeError } from "../lib/organization";

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

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: session, isPending: sessionPending, error: sessionError } = authClient.useSession();
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgPending, setOrgPending] = useState(false);

  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const result = await authClient.organization.list();
      if (result.error) {
        throw new Error(describeError(result.error, "Could not load organisations."));
      }
      return result.data ?? [];
    },
    enabled: Boolean(session?.user),
  });

  const organizationForm = useForm({
    defaultValues: {
      organisationName: "",
    },
    onSubmit: async ({ value }) => {
      setOrgError(null);
      setOrgPending(true);
      const result = await createOrganisation(value.organisationName);
      setOrgPending(false);
      if (!result.ok) {
        setOrgError(result.message);
        return;
      }
      organizationForm.reset();
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });

  const organizations = organizationsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Manage your organisation. Albums are captured in the mobile app and reviewed here.
        </p>
      </div>

      {sessionPending ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full max-w-xl" />
        </div>
      ) : null}

      {sessionError ? <FieldError>{sessionError.message}</FieldError> : null}

      {session?.user ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Signed in as {session.user.email}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Organisations</span>
                <Badge variant="secondary">{organizations.length}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Each account belongs to one organisation. Albums and photos are scoped to it.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Organisation</CardTitle>
              <CardDescription>
                {organizations.length > 0
                  ? "Your organisation is ready."
                  : "Create the organisation that owns your albums."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {organizationsQuery.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : null}

              {organizationsQuery.error ? (
                <FieldError>{organizationsQuery.error.message}</FieldError>
              ) : null}

              {!organizationsQuery.isLoading && organizations.length === 0 ? (
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void organizationForm.handleSubmit();
                  }}
                >
                  <organizationForm.Field
                    name="organisationName"
                    validators={{ onBlur: z.string().min(1, "Enter an organisation name.") }}
                  >
                    {(field) => {
                      const message = firstError(field.state.meta.errors);
                      return (
                        <Field data-invalid={Boolean(message)}>
                          <FieldLabel htmlFor="organisation-name">Organisation name</FieldLabel>
                          <Input
                            id="organisation-name"
                            name={field.name}
                            type="text"
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
                  </organizationForm.Field>

                  {orgError ? <FieldError>{orgError}</FieldError> : null}

                  <Button type="submit" disabled={orgPending}>
                    {orgPending ? "Creating organisation…" : "Create organisation"}
                  </Button>
                </form>
              ) : null}

              {organizations.length > 0 ? (
                <ul className="space-y-2">
                  {organizations.map((organization) => (
                    <li
                      key={organization.id}
                      className="flex items-center justify-between rounded-lg border px-3 py-2"
                    >
                      <span className="text-sm font-medium">{organization.name}</span>
                      {session.session.activeOrganizationId === organization.id ? (
                        <Badge variant="outline">Active</Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

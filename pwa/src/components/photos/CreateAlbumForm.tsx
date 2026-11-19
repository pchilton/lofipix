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
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import IconArrowRight from "~icons/lucide/arrow-right";
import IconImagePlus from "~icons/lucide/image-plus";

import { createAlbum, DuplicateAlbumError } from "../../lib/photos/capture";
import { useAlbums } from "../../lib/photos/read";
import { useSession } from "../../lib/session";
import { Textarea } from "../Textarea";

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

export function CreateAlbumForm({ fullPage = false }: { fullPage?: boolean }) {
  const { profile } = useSession();
  const { albums } = useAlbums();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const form = useForm({
    defaultValues: {
      name: "",
      notes: "",
    },
    onSubmit: async ({ value }) => {
      if (!profile?.organizationId) {
        setFormError("Your session has no active organisation.");
        return;
      }
      setFormError(null);
      setPending(true);
      try {
        const albumId = await createAlbum({
          organizationId: profile.organizationId,
          name: value.name,
          notes: value.notes,
        });
        await navigate({ to: "/albums/$albumId/capture", params: { albumId } });
      } catch (error) {
        if (error instanceof DuplicateAlbumError) {
          await navigate({ to: "/albums/$albumId/finish", params: { albumId: error.albumId } });
          return;
        }
        setFormError(
          error instanceof Error ? error.message : "Could not create the album.",
        );
      } finally {
        setPending(false);
      }
    },
  });

  return (
    <Card className={fullPage ? "mx-auto w-full max-w-2xl" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconImagePlus className="size-4" aria-hidden="true" />
          Create album
        </CardTitle>
        <CardDescription>
          Name the album and optionally add notes. Photos are captured next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!profile?.organizationId ? (
          <p className="mb-4 rounded-md border bg-muted px-3 py-2 text-sm">
            Sign in with an active organisation to create albums.
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
            name="name"
            validators={{
              onSubmit: ({ value }) =>
                value.trim().length > 0 ? undefined : "Enter an album name.",
            }}
          >
            {(field) => {
              const message = firstError(field.state.meta.errors);
              const duplicate =
                albums.find(
                  (album) =>
                    album.name.trim().toLowerCase() ===
                    field.state.value.trim().toLowerCase(),
                ) ?? null;
              return (
                <Field data-invalid={Boolean(message)}>
                  <FieldLabel htmlFor="album-name">Name</FieldLabel>
                  <Input
                    id="album-name"
                    name={field.name}
                    placeholder="e.g. AB12 CDE"
                    required
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.currentTarget.value)}
                    aria-invalid={Boolean(message)}
                  />
                  <FieldError>{message}</FieldError>
                  {duplicate ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">Album already exists</Badge>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/albums/$albumId/finish"
                          params={{ albumId: duplicate.id }}
                        >
                          Review existing
                          <IconArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="notes">
            {(field) => (
              <Field>
                <FieldLabel htmlFor="album-notes">Notes (optional)</FieldLabel>
                <Textarea
                  id="album-notes"
                  name={field.name}
                  placeholder="Damage notes. Separate paragraphs with a blank line."
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.currentTarget.value)}
                />
              </Field>
            )}
          </form.Field>

          {formError ? <FieldError>{formError}</FieldError> : null}

          <form.Subscribe selector={(state) => state.values.name}>
            {(name) => {
              const duplicate = albums.find(
                (album) =>
                  album.name.trim().toLowerCase() === name.trim().toLowerCase(),
              );
              if (duplicate) {
                return (
                  <Button asChild className="w-full">
                    <Link to="/albums/$albumId/finish" params={{ albumId: duplicate.id }}>
                      Review existing album
                    </Link>
                  </Button>
                );
              }
              return (
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending || !profile?.organizationId}
                >
                  {pending ? "Creating…" : "Start"}
                  <IconArrowRight aria-hidden="true" />
                </Button>
              );
            }}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  );
}
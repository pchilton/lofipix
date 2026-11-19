import { useNavigate } from "@tanstack/react-router";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lofipix/ui";
import { useState } from "react";
import IconLogOut from "~icons/lucide/log-out";

import { RequireSession } from "../components/RequireSession";
import { SyncBadge } from "../components/SyncBadge";
import { useSession } from "../lib/session";

function SettingsContent() {
  const { profile, isOffline, signOut } = useSession();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Account details for this browser session.
          </p>
        </div>
        <SyncBadge />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{profile?.name ?? "Account"}</CardTitle>
          <CardDescription>{profile?.email ?? "No email available"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Active organisation: {profile?.organizationId ?? "none"}
          </p>
          <p>
            This browser keeps a local PowerSync database. Signing out removes it from
            this device.
          </p>
          {isOffline ? (
            <p>Connect to the internet to log out and revoke the server session.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Log out</CardTitle>
          <CardDescription>
            Local albums and photo metadata are removed from this browser. Server data is
            not deleted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            disabled={pending || isOffline}
            onClick={() => {
              setPending(true);
              void signOut()
                .then(() => navigate({ to: "/" }))
                .finally(() => setPending(false));
            }}
          >
            <IconLogOut aria-hidden="true" />
            {pending ? "Logging out…" : "Log out"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  return (
    <RequireSession>
      <SettingsContent />
    </RequireSession>
  );
}

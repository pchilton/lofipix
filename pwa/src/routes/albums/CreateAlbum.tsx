import { Button } from "@lofipix/ui";
import { Link } from "@tanstack/react-router";
import IconArrowLeft from "~icons/lucide/arrow-left";

import { CreateAlbumForm } from "../../components/photos/CreateAlbumForm";
import { RequireSession } from "../../components/RequireSession";
import { SyncBadge } from "../../components/SyncBadge";

export default function CreateAlbum() {
  return (
    <RequireSession>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Button asChild variant="ghost" size="sm" className="-ml-3">
              <Link to="/dashboard">
                <IconArrowLeft aria-hidden="true" />
                Albums
              </Link>
            </Button>
            <h1 className="text-3xl font-semibold tracking-tight">Create album</h1>
          </div>
          <SyncBadge />
        </div>
        <CreateAlbumForm fullPage />
      </div>
    </RequireSession>
  );
}
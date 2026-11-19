import { Skeleton } from "@lofipix/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { useSession } from "../lib/session";

export function RequireSession({ children }: { children: ReactNode }) {
  const { isAuthenticated, isPending, profile } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      void navigate({ to: "/" });
    }
  }, [isAuthenticated, isPending, navigate]);

  if (isPending && !profile) {
    return (
      <div className="space-y-3" aria-label="Checking your session">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

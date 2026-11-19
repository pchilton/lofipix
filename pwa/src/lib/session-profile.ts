import { pwaEnvironment } from "../config/environment";

const STORAGE_KEY = "lofipix.pwa.session-profile";

export interface SessionProfile {
  userId: string;
  name: string;
  email: string;
  organizationId: string | null;
}

function isProfile(value: unknown): value is SessionProfile {
  if (!value || typeof value !== "object") {
    return false;
  }
  const profile = value as Record<string, unknown>;
  return (
    typeof profile.userId === "string" &&
    typeof profile.name === "string" &&
    typeof profile.email === "string" &&
    (typeof profile.organizationId === "string" || profile.organizationId === null)
  );
}

export function readCachedProfile(): SessionProfile | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCachedProfile(profile: SessionProfile): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function clearCachedProfile(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export function profileFromSession(session: {
  user: { id: string; name: string; email: string };
  session?: { activeOrganizationId?: string | null } | null;
}): SessionProfile {
  return {
    userId: session.user.id,
    name: session.user.name,
    email: session.user.email,
    organizationId: session.session?.activeOrganizationId ?? null,
  };
}

export function webUrl(path = ""): string {
  return new URL(path.replace(/^\//, ""), pwaEnvironment.WEB_URL).toString();
}

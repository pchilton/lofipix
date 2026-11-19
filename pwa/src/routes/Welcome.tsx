import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lofipix/ui";
import IconCamera from "~icons/lucide/camera";
import IconCloudOff from "~icons/lucide/cloud-off";
import IconDownload from "~icons/lucide/download";
import IconSmartphone from "~icons/lucide/smartphone";
import IconWifiOff from "~icons/lucide/wifi-off";

import { pwaEnvironment } from "../config/environment";

const steps = [
  {
    icon: IconDownload,
    title: "Install from the browser",
    description:
      "Open pwa.lofipix.app and add it to your home screen. No app store or tester account is required.",
  },
  {
    icon: IconWifiOff,
    title: "Capture offline",
    description:
      "Albums and photos are stored on the device first. The app keeps working when the network drops.",
  },
  {
    icon: IconCloudOff,
    title: "Sync when connected",
    description:
      "PowerSync syncs albums and photo metadata when connectivity returns. Photo bytes stay on the device.",
  },
] as const;

export default function Welcome() {
  return (
    <div className="space-y-14">
      <section className="mx-auto max-w-3xl space-y-6 py-8 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted">
          <IconCamera className="size-8" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          <Badge variant="secondary">Progressive Web App</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">LoFi Pix PWA</h1>
          <p className="text-lg text-muted-foreground">
            The browser version of the LoFi Pix capture app. This build is the installable shell:
            sign-in, sync and the camera arrive in the next tasks.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href={pwaEnvironment.WEB_URL}>Visit the website</a>
          </Button>
          <span className="text-sm text-muted-foreground">
            Native iOS and Android apps remain available from the app stores.
          </span>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">How it will work</h2>
          <p className="text-muted-foreground">
            The PWA follows the same offline-first capture loop as the native app, within the
            browser&apos;s camera and storage limits.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
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

      <section className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <IconSmartphone className="size-5" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">Prefer the native app?</h2>
            <p className="text-sm text-muted-foreground">
              The iOS and Android apps use the device camera and document storage directly.
            </p>
          </div>
        </div>
        <Button variant="outline" disabled>
          Store links soon
        </Button>
      </section>
    </div>
  );
}

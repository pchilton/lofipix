import { Link } from "@tanstack/react-router";
import { Badge, Button, Card, CardDescription, CardHeader, CardTitle } from "@lofipix/ui";
import IconCamera from "~icons/lucide/camera";
import IconCloud from "~icons/lucide/cloud";
import IconCarWrench from "~icons/mdi/car-wrench";
import IconShieldCheck from "~icons/lucide/shield-check";

const features = [
  {
    icon: IconCamera,
    title: "Offline-first capture",
    description: "Capture damage photos without a connection; they sync when the device reconnects.",
  },
  {
    icon: IconCloud,
    title: "Cloud albums",
    description: "Photos are compressed and stored in albums shared with your organisation.",
  },
  {
    icon: IconShieldCheck,
    title: "Your own storage",
    description: "Albums can sync to the customer's OneDrive or Google Drive account.",
  },
] as const;

export default function Welcome() {
  return (
    <div className="space-y-16">
      <section className="mx-auto max-w-3xl space-y-6 py-10 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-muted">
          <IconCarWrench className="size-8" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          <Badge variant="secondary">For panel-beaters</Badge>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">lofipix</h1>
          <p className="text-lg text-muted-foreground">
            Offline-first photo capture for panel-beaters. Capture damage photos in the mobile app,
            sync them to the cloud, and review albums from the website.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth">Sign in / Register</Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Native apps for iOS and Android are coming to the app stores.
          </span>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Built for the workshop</h2>
          <p className="text-muted-foreground">
            The capture loop works on the device. The website handles the organisation and the
            review work that needs a bigger screen.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-muted">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border bg-muted/40 p-6 text-center">
        <h2 className="text-xl font-semibold">Review and administration</h2>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Sign in to manage your organisation, members and albums. Photo capture lives in the
          mobile app, where the camera and offline storage belong.
        </p>
      </section>
    </div>
  );
}

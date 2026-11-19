import { Button } from "@lofipix/ui";
import { useRegisterSW } from "virtual:pwa-register/react";

export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-4 shadow-lg"
    >
      <p className="text-sm">A new version of LoFi Pix is ready.</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
        <Button
          size="sm"
          onClick={() => {
            void updateServiceWorker(true);
          }}
        >
          Reload
        </Button>
      </div>
    </div>
  );
}

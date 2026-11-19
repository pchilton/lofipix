import { cn } from "@lofipix/ui";
import IconImageOff from "~icons/lucide/image-off";

import { usePhotoUrl } from "../../lib/photos/use-photo-url";

export function PhotoThumbnail({
  photoId,
  alt,
  className,
}: {
  photoId: string;
  alt: string;
  className?: string;
}) {
  const url = usePhotoUrl(photoId);

  if (!url) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-muted text-muted-foreground",
          className,
        )}
        aria-label="Photo bytes are not on this device"
      >
        <IconImageOff className="size-5" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={cn("rounded-md bg-muted object-cover", className)}
      loading="lazy"
    />
  );
}
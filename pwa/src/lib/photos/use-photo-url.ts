import { useEffect, useState } from "react";

import { readPhotoFile } from "./opfs";

export function usePhotoUrl(photoId: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!photoId) {
      setUrl(null);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setUrl(null);

    void readPhotoFile(photoId)
      .then((blob) => {
        if (!active || !blob) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (active) {
          setUrl(null);
        }
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setUrl(null);
    };
  }, [photoId]);

  return url;
}
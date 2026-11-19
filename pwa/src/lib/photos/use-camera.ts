import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus =
  | "loading"
  | "ready"
  | "denied"
  | "unavailable"
  | "error";

export interface CameraState {
  status: CameraStatus;
  message: string | null;
}

function describeCameraError(error: unknown): CameraState {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return {
        status: "denied",
        message:
          "Camera access was denied. Allow camera access for this site in your browser settings.",
      };
    }
    if (
      error.name === "NotFoundError" ||
      error.name === "NotSupportedError" ||
      error.name === "OverconstrainedError"
    ) {
      return {
        status: "unavailable",
        message: "No camera is available on this device.",
      };
    }
    if (error.name === "NotReadableError") {
      return {
        status: "error",
        message: "The camera is in use by another application.",
      };
    }
  }
  return {
    status: "error",
    message: "The camera could not be started.",
  };
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>({
    status: "loading",
    message: null,
  });

  const stop = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const start = useCallback(async () => {
    stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({
        status: "unavailable",
        message: "This browser does not expose a camera to web applications.",
      });
      return;
    }

    setState({ status: "loading", message: null });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      setState({ status: "ready", message: null });
    } catch (error) {
      setState(describeCameraError(error));
    }
  }, [stop]);

  useEffect(() => {
    void start();
    return () => stop();
  }, [start, stop]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (state.status === "ready" && video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [state.status]);

  return { videoRef, state, start, stop };
}

export async function captureVideoFrame(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error("The camera preview is not ready yet.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not capture the camera frame.");
  }
  context.drawImage(video, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not capture the camera frame."));
        }
      },
      "image/jpeg",
      0.95,
    );
  });
}
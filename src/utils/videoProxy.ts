let nextProxyId = 0;

interface ProxyWorkerResponse {
  id: string;
  buffer?: ArrayBuffer;
  error?: string;
}

export function createVideoProxy(file: File, signal?: AbortSignal): Promise<Blob> {
  if (typeof Worker === "undefined") {
    return Promise.reject(new Error("Web Workers are not supported in this browser."));
  }

  const id = `proxy_${Date.now()}_${nextProxyId++}`;
  let worker: Worker;
  try {
    worker = new Worker(new URL("../workers/videoProxy.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)));
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      signal?.removeEventListener("abort", handleAbort);
      worker.terminate();
    };
    const handleAbort = () => {
      cleanup();
      const error = new Error("Video proxy generation was cancelled.");
      error.name = "AbortError";
      reject(error);
    };

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    signal?.addEventListener("abort", handleAbort, { once: true });

    worker.onmessage = ({ data }: MessageEvent<ProxyWorkerResponse>) => {
      if (data.id !== id) return;
      cleanup();
      if (data.error) {
        reject(new Error(data.error));
      } else if (data.buffer) {
        resolve(new Blob([data.buffer], { type: "video/webm" }));
      } else {
        reject(new Error("Proxy worker returned no video data."));
      }
    };

    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "The video proxy worker failed."));
    };

    worker.onmessageerror = () => {
      cleanup();
      reject(new Error("Could not read the video proxy worker response."));
    };

    try {
      worker.postMessage({ id, file });
    } catch (error) {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

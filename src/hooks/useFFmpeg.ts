import { useState, useRef, useCallback, useEffect } from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

export interface FFmpegLoadConfig {
  coreVersion?: string;
  preferMultiThread?: boolean;
}

export interface UseFFmpegReturn {
  ffmpeg: FFmpeg | null;
  isLoaded: boolean;
  isLoading: boolean;
  isMultiThread: boolean;
  progress: number; // 0 to 100
  statusMessage: string;
  error: string | null;
  loadFFmpeg: () => Promise<FFmpeg>;
  runCommand: (args: string[]) => Promise<number>;
  writeFile: (fileName: string, data: string | File | Blob | ArrayBuffer | Uint8Array) => Promise<void>;
  readFile: (fileName: string) => Promise<Uint8Array>;
  deleteFile: (fileName: string) => Promise<void>;
  transcodeLocalFile: (
    file: File | Blob,
    outputName?: string,
    customArgs?: string[]
  ) => Promise<{ blob: Blob; url: string; size: number }>;
}

// Global cached instance to prevent redundant WebAssembly module re-initializations
let globalFFmpeg: FFmpeg | null = null;
let globalFFmpegLoadingPromise: Promise<FFmpeg> | null = null;
let globalIsMultiThread = false;

/**
 * Initializes and loads modern @ffmpeg/ffmpeg (v0.12+)
 * Uses unpkg CDN ESM core binaries with multi-threaded (@ffmpeg/core-mt) support
 * when crossOriginIsolated is true, and seamless fallback to single-threaded (@ffmpeg/core)
 * when running inside restricted iframe environments.
 */
export async function getLoadedFFmpegInstance(
  onProgress?: (progress: number, time?: number) => void,
  onLog?: (message: string) => void
): Promise<{ ffmpeg: FFmpeg; isMultiThread: boolean }> {
  if (globalFFmpeg && globalFFmpeg.loaded) {
    return { ffmpeg: globalFFmpeg, isMultiThread: globalIsMultiThread };
  }

  if (globalFFmpegLoadingPromise) {
    const ffmpeg = await globalFFmpegLoadingPromise;
    return { ffmpeg, isMultiThread: globalIsMultiThread };
  }

  globalFFmpegLoadingPromise = (async () => {
    const ffmpeg = new FFmpeg();
    globalFFmpeg = ffmpeg;

    if (onLog) {
      ffmpeg.on("log", ({ message }) => {
        onLog(message);
      });
    }

    if (onProgress) {
      ffmpeg.on("progress", ({ progress, time }) => {
        const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
        onProgress(pct, time);
      });
    }

    const isIsolated =
      typeof window !== "undefined" &&
      window.crossOriginIsolated === true &&
      typeof SharedArrayBuffer !== "undefined";

    const coreVersion = "0.12.6";

    try {
      if (isIsolated) {
        // Multi-threaded core with Web Workers for maximum local device compute
        const baseURL = `https://unpkg.com/@ffmpeg/core-mt@${coreVersion}/dist/esm`;
        console.log("[FFmpeg.wasm] Loading multi-threaded core from unpkg...", baseURL);

        const [coreURL, wasmURL, workerURL] = await Promise.all([
          toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
          toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, "text/javascript"),
        ]);

        await ffmpeg.load({
          coreURL,
          wasmURL,
          workerURL,
        });

        globalIsMultiThread = true;
        console.log("[FFmpeg.wasm] Multi-threaded core loaded successfully.");
      } else {
        // Single-threaded core fallback (guaranteed to work across all iframes and browser sandboxes)
        const baseURL = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;
        console.log("[FFmpeg.wasm] Loading single-threaded core from unpkg...", baseURL);

        const [coreURL, wasmURL] = await Promise.all([
          toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
          toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
        ]);

        await ffmpeg.load({
          coreURL,
          wasmURL,
        });

        globalIsMultiThread = false;
        console.log("[FFmpeg.wasm] Single-threaded core loaded successfully.");
      }
    } catch (primaryErr) {
      console.warn("[FFmpeg.wasm] Primary load failed, attempting single-threaded fallback...", primaryErr);
      const fallbackBase = `https://unpkg.com/@ffmpeg/core@${coreVersion}/dist/esm`;
      const [coreURL, wasmURL] = await Promise.all([
        toBlobURL(`${fallbackBase}/ffmpeg-core.js`, "text/javascript"),
        toBlobURL(`${fallbackBase}/ffmpeg-core.wasm`, "application/wasm"),
      ]);

      await ffmpeg.load({
        coreURL,
        wasmURL,
      });
      globalIsMultiThread = false;
    }

    return ffmpeg;
  })();

  try {
    const ffmpeg = await globalFFmpegLoadingPromise;
    return { ffmpeg, isMultiThread: globalIsMultiThread };
  } catch (err) {
    globalFFmpeg = null;
    globalFFmpegLoadingPromise = null;
    throw err;
  }
}

/**
 * React Hook for modern @ffmpeg/ffmpeg (v0.12+) client-side video processing
 */
export function useFFmpeg(config?: FFmpegLoadConfig): UseFFmpegReturn {
  const [isLoaded, setIsLoaded] = useState<boolean>(() => Boolean(globalFFmpeg?.loaded));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMultiThread, setIsMultiThread] = useState<boolean>(globalIsMultiThread);
  const [progress, setProgress] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>("Ready");
  const [error, setError] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(globalFFmpeg);

  const loadFFmpeg = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current && ffmpegRef.current.loaded) {
      setIsLoaded(true);
      return ffmpegRef.current;
    }

    setIsLoading(true);
    setError(null);
    setStatusMessage("Downloading WebAssembly core binaries...");

    try {
      const { ffmpeg, isMultiThread: multiThread } = await getLoadedFFmpegInstance(
        (pct) => setProgress(pct),
        (msg) => setStatusMessage(msg)
      );

      ffmpegRef.current = ffmpeg;
      setIsMultiThread(multiThread);
      setIsLoaded(true);
      setStatusMessage(multiThread ? "FFmpeg WASM (Multi-threaded) Ready" : "FFmpeg WASM Ready");
      return ffmpeg;
    } catch (err: any) {
      const errMsg = err?.message || "Failed to initialize FFmpeg WebAssembly engine.";
      console.error("[useFFmpeg] Initialization error:", err);
      setError(errMsg);
      setStatusMessage("Initialization failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const writeFile = useCallback(
    async (fileName: string, data: string | File | Blob | ArrayBuffer | Uint8Array) => {
      const ffmpeg = await loadFFmpeg();
      let fileData: Uint8Array;

      if (data instanceof Uint8Array) {
        fileData = data;
      } else if (data instanceof ArrayBuffer) {
        fileData = new Uint8Array(data);
      } else if (typeof data === "string" || data instanceof File || data instanceof Blob) {
        fileData = await fetchFile(data);
      } else {
        throw new Error("Unsupported file data format for FFmpeg WASM write.");
      }

      await ffmpeg.writeFile(fileName, fileData);
    },
    [loadFFmpeg]
  );

  const readFile = useCallback(
    async (fileName: string): Promise<Uint8Array> => {
      const ffmpeg = await loadFFmpeg();
      const rawData = await ffmpeg.readFile(fileName);
      if (typeof rawData === "string") {
        return new TextEncoder().encode(rawData);
      }
      return rawData as Uint8Array;
    },
    [loadFFmpeg]
  );

  const deleteFile = useCallback(
    async (fileName: string) => {
      if (!ffmpegRef.current || !ffmpegRef.current.loaded) return;
      try {
        await ffmpegRef.current.deleteFile(fileName);
      } catch (e) {
        // Ignored if already cleaned
      }
    },
    []
  );

  const runCommand = useCallback(
    async (args: string[]): Promise<number> => {
      const ffmpeg = await loadFFmpeg();
      setStatusMessage(`Executing: ffmpeg ${args.slice(0, 4).join(" ")}...`);
      return await ffmpeg.exec(args);
    },
    [loadFFmpeg]
  );

  /**
   * Accepts a video File or Blob from upload input or timeline,
   * compiles/transcodes it via FFmpeg.wasm using ultrafast flags,
   * and generates a secure local Blob URL without network calls.
   */
  const transcodeLocalFile = useCallback(
    async (
      file: File | Blob,
      outputName: string = "output.mp4",
      customArgs?: string[]
    ): Promise<{ blob: Blob; url: string; size: number }> => {
      const ffmpeg = await loadFFmpeg();
      setProgress(5);
      setStatusMessage("Writing source file into WebAssembly virtual memory...");

      const inputName = `input_${Date.now()}_source`;
      await writeFile(inputName, file);

      setProgress(15);
      setStatusMessage("Compiling video locally with H.264 ultrafast preset...");

      // Default optimal performance flags requested: -preset ultrafast -crf 28
      const args = customArgs || [
        "-i",
        inputName,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputName,
      ];

      const exitCode = await ffmpeg.exec(args);
      if (exitCode !== 0) {
        throw new Error(`FFmpeg.wasm execution failed with exit code ${exitCode}`);
      }

      setStatusMessage("Reading rendered video from WebAssembly filesystem...");
      const fileBuffer = await readFile(outputName);
      const outputBlob = new Blob([fileBuffer as any], { type: "video/mp4" });
      const downloadUrl = URL.createObjectURL(outputBlob);

      // Clean virtual files to preserve WebAssembly heap memory
      await deleteFile(inputName);
      await deleteFile(outputName);

      setProgress(100);
      setStatusMessage("Compilation complete! Local Blob URL ready.");

      return {
        blob: outputBlob,
        url: downloadUrl,
        size: outputBlob.size,
      };
    },
    [loadFFmpeg, writeFile, readFile, deleteFile]
  );

  return {
    ffmpeg: ffmpegRef.current,
    isLoaded,
    isLoading,
    isMultiThread,
    progress,
    statusMessage,
    error,
    loadFFmpeg,
    runCommand,
    writeFile,
    readFile,
    deleteFile,
    transcodeLocalFile,
  };
}

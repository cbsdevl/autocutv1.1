import {
  BlobSource,
  BufferTarget,
  Conversion,
  Input,
  MATROSKA,
  MP4,
  Output,
  QTFF,
  WEBM,
  WebMOutputFormat,
} from "mediabunny";

interface ProxyRequest {
  id: string;
  file: File;
}

interface WorkerScope {
  onmessage: ((event: MessageEvent<ProxyRequest>) => void) | null;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async ({ data }) => {
  try {
    const input = new Input({
      source: new BlobSource(data.file),
      formats: [MP4, QTFF, WEBM, MATROSKA],
    });
    const output = new Output({
      format: new WebMOutputFormat(),
      target: new BufferTarget(),
    });
    const conversion = await Conversion.init({
      input,
      output,
      tracks: "primary",
      copy: false,
      video: {
        codec: "vp8",
        width: 854,
        height: 480,
        fit: "contain",
        bitrate: 500_000,
        frameRate: 24,
        hardwareAcceleration: "prefer-hardware",
        forceTranscode: true,
      },
      audio: {
        codec: "opus",
        bitrate: 64_000,
        forceTranscode: true,
      },
      showWarnings: false,
    });

    if (!conversion.isValid) {
      throw new Error("This video cannot be converted to a browser proxy.");
    }

    await conversion.execute();
    const buffer = output.target.buffer;
    if (!buffer || buffer.byteLength === 0) {
      throw new Error("The proxy encoder produced an empty video.");
    }

    workerScope.postMessage({ id: data.id, buffer }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      id: data.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

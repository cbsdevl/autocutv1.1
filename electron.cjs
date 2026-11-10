// Electron Main Process for AutoCut AI Desktop (.EXE) Application
const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");

// Hardware & GPU acceleration switches for high-performance WebCodecs video editing
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-webgl");
app.commandLine.appendSwitch("force_high_performance_gpu");

let mainWindow = null;
let localServer = null;
let serverPort = 0;

// Basic MIME type lookup for local file server
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json",
};

// Start a lightweight local loopback server to serve dist/ with COOP/COEP headers
// This unlocks SharedArrayBuffer, WebCodecs hardware decoding, and client-side SPA routing.
function startLocalServer() {
  return new Promise((resolve) => {
    const distDir = path.join(__dirname, "dist");

    localServer = http.createServer((req, res) => {
      // Security headers for high-speed WebCodecs & multi-threaded rendering
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const urlPath = req.url.split("?")[0];
      let safePath = path.normalize(path.join(distDir, urlPath));

      if (!safePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      fs.stat(safePath, (err, stats) => {
        if (!err && stats.isFile()) {
          const ext = path.extname(safePath).toLowerCase();
          res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
          fs.createReadStream(safePath).pipe(res);
        } else {
          // SPA fallback to index.html for client-side routing
          const indexPath = path.join(distDir, "index.html");
          res.setHeader("Content-Type", "text/html");
          fs.createReadStream(indexPath).pipe(res);
        }
      });
    });

    localServer.listen(0, "127.0.0.1", () => {
      const address = localServer.address();
      serverPort = typeof address === "object" && address ? address.port : 3000;
      console.log(`[AutoCut Desktop] Embedded loopback server running on http://127.0.0.1:${serverPort}`);
      resolve(serverPort);
    });
  });
}

async function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, "public", "icon.ico"))
    ? path.join(__dirname, "public", "icon.ico")
    : path.join(__dirname, "public", "pwa-512x512.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "AutoCut AI — Professional Video Editor",
    icon: iconPath,
    backgroundColor: "#090A10",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  let startUrl = process.env.ELECTRON_START_URL;
  if (!startUrl) {
    if (!serverPort) {
      await startLocalServer();
    }
    startUrl = `http://127.0.0.1:${serverPort}`;
  }

  mainWindow.loadURL(startUrl);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links (documentation, stripe, etc.) in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:") || url.startsWith("http:")) {
      if (!url.includes(`127.0.0.1:${serverPort}`) && !url.includes("localhost")) {
        shell.openExternal(url);
        return { action: "deny" };
      }
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startLocalServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (localServer) {
    try {
      localServer.close();
    } catch (_) {}
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

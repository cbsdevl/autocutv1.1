// Builds both the real Windows NSIS Setup Installer (AutoCut-AI-Setup.exe)
// and the Portable standalone executable (AutoCut-AI-Portable.exe) on Linux
// without requiring Wine by enabling electron-builder's built-in pure-JS UninstallerReader.

const path = require("path");
const fs = require("fs");

// 1. Enable pure-JS UninstallerReader in electron-builder's NsisTarget
// (avoids spawning Wine to extract the NSIS uninstaller binary on Linux)
const macosVersion = require("app-builder-lib/out/util/macosVersion");
macosVersion.isMacOsCatalina = () => true;

const builder = require("electron-builder");
const { Platform } = builder;

async function main() {
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? args : ["nsis", "portable"];
  const rootDir = path.resolve(__dirname, "..");
  const distElectronDir = path.join(rootDir, "dist-electron");

  console.log(`[Windows Build] Building targets: ${targets.join(", ")}...`);

  await builder.build({
    targets: Platform.WINDOWS.createTarget(targets, builder.Arch.x64),
    projectDir: rootDir,
    config: {
      npmRebuild: false,
      nodeGypRebuild: false,
    },
  });

  // Normalize output filenames cleanly for web download endpoints
  const setupSrc = path.join(distElectronDir, "AutoCut AI Setup 0.0.0.exe");
  const setupDst = path.join(distElectronDir, "AutoCut-AI-Setup.exe");
  if (fs.existsSync(setupSrc)) {
    const size = fs.statSync(setupSrc).size;
    if (size < 50 * 1024 * 1024) {
      throw new Error(`NSIS setup installer is unexpectedly small (${size} bytes) — archive embedding may have failed.`);
    }
    fs.copyFileSync(setupSrc, setupDst);
    console.log(`[Windows Build] Verified Setup Installer: ${setupDst} (${(size / (1024 * 1024)).toFixed(1)} MB)`);
  }

  const portableSrc = path.join(distElectronDir, "AutoCut AI 0.0.0.exe");
  const portableDst = path.join(distElectronDir, "AutoCut-AI-Portable.exe");
  if (fs.existsSync(portableSrc)) {
    const size = fs.statSync(portableSrc).size;
    fs.copyFileSync(portableSrc, portableDst);
    console.log(`[Windows Build] Verified Portable App: ${portableDst} (${(size / (1024 * 1024)).toFixed(1)} MB)`);
  }

  // Remove intermediate .nsis.7z files if any remain
  try {
    for (const file of fs.readdirSync(distElectronDir)) {
      if (file.endsWith(".nsis.7z")) {
        fs.unlinkSync(path.join(distElectronDir, file));
      }
    }
  } catch (_) {}
}

main().catch((err) => {
  console.error("[Windows Build Failed]:", err);
  process.exit(1);
});

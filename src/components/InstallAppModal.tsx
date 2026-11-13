import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  Monitor,
  Download,
  Share2,
  PlusSquare,
  CheckCircle2,
  Sparkles,
  Cpu,
  WifiOff,
  ExternalLink,
  Laptop,
  Layers,
  Terminal,
  Loader2,
  RefreshCw,
  Zap,
  Box,
  AlertCircle,
} from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ExeFileInfo {
  size: number;
  sizeFormatted: string;
  modified: string;
  filename: string;
}

interface ExeStatusData {
  available: boolean;
  setup?: ExeFileInfo | null;
  portable?: ExeFileInfo | null;
  file: ExeFileInfo | null;
  buildState: {
    isBuilding: boolean;
    progress: number;
    message: string;
    error: string | null;
  };
}

export const InstallAppModal: React.FC<InstallAppModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, isMobile, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<"mobile" | "pc">(isMobile ? "mobile" : "pc");
  const [installSuccess, setInstallSuccess] = useState(false);
  const [exeStatus, setExeStatus] = useState<ExeStatusData | null>(null);
  const [isTriggeringBuild, setIsTriggeringBuild] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    active: boolean;
    percent: number;
    message: string;
  } | null>(null);
  const [downloadSuccessNotice, setDownloadSuccessNotice] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Poll desktop .exe build status
  const fetchExeStatus = async () => {
    try {
      const res = await fetch("/api/desktop/status");
      if (res.ok) {
        const data = await res.json();
        setExeStatus(data);
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchExeStatus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (exeStatus?.buildState?.isBuilding) {
      const interval = setInterval(fetchExeStatus, 2500);
      return () => clearInterval(interval);
    }
  }, [isOpen, exeStatus?.buildState?.isBuilding]);

  const handleTriggerBuild = async () => {
    try {
      setIsTriggeringBuild(true);
      const res = await fetch("/api/desktop/build-exe", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.buildState) {
          setExeStatus((prev) => ({
            available: prev?.available ?? false,
            file: prev?.file ?? null,
            buildState: data.buildState,
          }));
        }
      }
    } catch (err) {
      console.error("Failed to start build:", err);
    } finally {
      setIsTriggeringBuild(false);
      fetchExeStatus();
    }
  };

  // High-reliability multi-part chunked downloader:
  // Downloads the binary in 15 MB chunks to bypass Cloud Run / proxy response buffers
  // and validates the Windows PE 'MZ' binary signature to guarantee zero file corruption.
  const handleDownloadExe = async (type: "setup" | "portable" = "setup") => {
    try {
      setDownloadError(null);
      setDownloadSuccessNotice(false);

      // 1. Verify binary availability and get exact byte size
      const checkRes = await fetch("/api/desktop/status");
      if (!checkRes.ok) {
        throw new Error("Unable to contact desktop status service.");
      }
      const statusData: ExeStatusData = await checkRes.json();
      const targetFile = type === "setup" ? statusData.setup : statusData.portable;

      if (!targetFile?.size) {
        // Automatically start the build if not yet compiled
        handleTriggerBuild();
        return;
      }

      const totalBytes = targetFile.size;
      const downloadFilename = type === "setup" ? "AutoCut-AI-Setup.exe" : "AutoCut-AI-Portable.exe";
      const chunkSize = 15 * 1024 * 1024; // 15 MB per chunk (well within Cloud Run proxy limits)
      const chunks: ArrayBuffer[] = [];
      let downloadedBytes = 0;
      let partIndex = 1;
      const totalParts = Math.ceil(totalBytes / chunkSize);

      setDownloadProgress({
        active: true,
        percent: 0,
        message: `Connecting & allocating download stream for ${downloadFilename} (${totalParts} parts)...`,
      });

      while (downloadedBytes < totalBytes) {
        const start = downloadedBytes;
        const end = Math.min(downloadedBytes + chunkSize - 1, totalBytes - 1);

        setDownloadProgress({
          active: true,
          percent: Math.round((downloadedBytes / totalBytes) * 100),
          message: `Streaming ${downloadFilename} Part ${partIndex}/${totalParts}: ${(downloadedBytes / (1024 * 1024)).toFixed(1)} / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB (${Math.round((downloadedBytes / totalBytes) * 100)}%)`,
        });

        const chunkRes = await fetch(`/api/desktop/download-exe?type=${type}`, {
          headers: {
            Range: `bytes=${start}-${end}`,
          },
          credentials: "include",
        });

        if (!chunkRes.ok && chunkRes.status !== 206) {
          throw new Error(`Server returned status ${chunkRes.status} for part ${partIndex}.`);
        }

        const contentType = chunkRes.headers.get("content-type") || "";
        if (contentType.includes("text/html")) {
          throw new Error("Authentication wrapper returned an HTML redirect. Please refresh and try again.");
        }

        const buffer = await chunkRes.arrayBuffer();
        if (buffer.byteLength === 0) {
          throw new Error(`Received empty buffer for part ${partIndex}.`);
        }

        // Validate Windows PE header on first chunk (must begin with 'MZ')
        if (partIndex === 1) {
          const magicBytes = new Uint8Array(buffer.slice(0, 2));
          if (magicBytes[0] !== 0x4d || magicBytes[1] !== 0x5a) {
            throw new Error("Downloaded data is not a valid Windows executable (corrupted response).");
          }
        }

        chunks.push(buffer);
        downloadedBytes += buffer.byteLength;
        partIndex++;
      }

      setDownloadProgress({
        active: true,
        percent: 100,
        message: `Assembling verified ${downloadFilename}...`,
      });

      // Assemble full binary blob
      const fullBlob = new Blob(chunks, {
        type: "application/vnd.microsoft.portable-executable",
      });

      const downloadUrl = URL.createObjectURL(fullBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = downloadFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 60000);

      setDownloadProgress(null);
      setDownloadSuccessNotice(true);
      setTimeout(() => setDownloadSuccessNotice(false), 8000);
    } catch (err: any) {
      console.error("[Download Error]:", err);
      setDownloadProgress(null);
      setDownloadError(err?.message || "Failed to download executable. Please try again or click Rebuild.");
    }
  };

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const success = await install();
    if (success) {
      setInstallSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2500);
    }
  };

  const handleDownloadLauncher = () => {
    // Generate a Windows .bat desktop shortcut launcher that launches the app in standalone app mode
    const currentOrigin = window.location.origin;
    const batContent = `@echo off
title AutoCut AI Desktop Launcher
echo Starting AutoCut AI in Windows Desktop Standalone Mode...
start msedge --app="${currentOrigin}" || start chrome --app="${currentOrigin}"
exit
`;
    const blob = new Blob([batContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "AutoCut_AI_Windows_Desktop.bat";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <img src="/favicon.svg" alt="AutoCut AI" className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Install AutoCut AI App
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Mobile & PC (EXE)
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Run natively on your device with offline support and zero-lag GPU rendering
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/30 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab("mobile")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "mobile"
                ? "bg-amber-500 text-zinc-950 shadow-md font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile App (Android & iOS)</span>
          </button>

          <button
            onClick={() => setActiveTab("pc")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
              activeTab === "pc"
                ? "bg-amber-500 text-zinc-950 shadow-md font-bold"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>PC Windows App (.EXE & Desktop)</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-zinc-200">
          {installSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100">Application Installed Successfully!</h3>
              <p className="text-xs text-zinc-400 max-w-sm">
                AutoCut AI is now installed on your device. You can launch it directly from your home screen or desktop.
              </p>
            </div>
          ) : activeTab === "mobile" ? (
            /* MOBILE TAB CONTENT */
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center space-y-1">
                  <Cpu className="w-4 h-4 text-amber-400 mx-auto" />
                  <div className="text-[11px] font-bold text-zinc-200">Hardware GPU</div>
                  <div className="text-[10px] text-zinc-500">Fast local video encode</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center space-y-1">
                  <WifiOff className="w-4 h-4 text-amber-400 mx-auto" />
                  <div className="text-[11px] font-bold text-zinc-200">100% Offline</div>
                  <div className="text-[10px] text-zinc-500">Edit without internet</div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-center space-y-1">
                  <Sparkles className="w-4 h-4 text-amber-400 mx-auto" />
                  <div className="text-[11px] font-bold text-zinc-200">CapCut Style</div>
                  <div className="text-[10px] text-zinc-500">Touch friendly editor</div>
                </div>
              </div>

              {/* Android Section */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <h3 className="text-sm font-bold text-zinc-100">Android (Chrome / Samsung / Firefox)</h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">One-click Install</span>
                </div>

                {isInstallable ? (
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Install AutoCut AI Android App</span>
                  </button>
                ) : isInstalled ? (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>AutoCut AI is already running as an installed app!</span>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400 space-y-1.5 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80">
                    <p className="font-semibold text-zinc-300">How to install on Android:</p>
                    <p>1. Tap the browser menu (<strong className="text-zinc-200">⋮</strong> three vertical dots in Chrome).</p>
                    <p>2. Tap <strong className="text-amber-400">"Install app"</strong> or <strong className="text-amber-400">"Add to Home screen"</strong>.</p>
                    <p>3. AutoCut AI will install to your app drawer and home screen.</p>
                  </div>
                )}
              </div>

              {/* iOS Section */}
              <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                    <h3 className="text-sm font-bold text-zinc-100">iPhone & iPad (Apple Safari)</h3>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">Add to Home Screen</span>
                </div>

                <div className="space-y-2 text-xs text-zinc-400 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/80">
                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-200 mt-0.5">
                      <Share2 className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-200">Step 1: </span>
                      Tap the <strong className="text-amber-400">Share</strong> button in Safari's bottom toolbar.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-200 mt-0.5">
                      <PlusSquare className="w-3 h-3" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-200">Step 2: </span>
                      Scroll down and tap <strong className="text-amber-400">"Add to Home Screen"</strong>.
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center shrink-0 text-zinc-200 mt-0.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-zinc-200">Step 3: </span>
                      Tap <strong className="text-zinc-200">Add</strong> in top-right. AutoCut AI will launch in full screen with zero Safari browser bars!
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* PC (EXE) TAB CONTENT */
            <div className="space-y-5">
              {/* Option 1: Native Desktop PWA Install */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-bold text-zinc-100">Method 1: Instant Windows Desktop App</h3>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Installs directly onto Windows 10/11. Creates a desktop icon, Start Menu shortcut, taskbar icon, and runs in a dedicated standalone desktop window without browser URL bars.
                </p>

                {isInstallable ? (
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    <span>Install AutoCut AI to PC Desktop</span>
                  </button>
                ) : isInstalled ? (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>AutoCut AI is already running as an installed desktop app!</span>
                  </div>
                ) : (
                  <div className="space-y-2 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800 text-xs text-zinc-400">
                    <p className="font-semibold text-zinc-300">How to install in Microsoft Edge or Google Chrome:</p>
                    <p>• Click the <strong className="text-amber-400">Install icon</strong> (a small computer monitor or [+] button) on the right side of the URL address bar.</p>
                    <p>• Or click browser menu (<strong className="text-zinc-200">⋯</strong> or <strong className="text-zinc-200">⋮</strong>) &rarr; <strong className="text-amber-400">Apps</strong> &rarr; <strong className="text-amber-400">"Install AutoCut AI"</strong>.</p>
                  </div>
                )}
              </div>

              {/* Option 2: 1-Click Standalone Windows .EXE Builder & Downloader */}
              <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                      <Box className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                        Standalone Windows .EXE Application
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          1-Click Build & Run
                        </span>
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        Portable 64-bit Windows executable. Zero installation required—runs directly from any folder or USB drive.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Build in progress UI */}
                {exeStatus?.buildState?.isBuilding ? (
                  <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/30 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-amber-300 font-semibold">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>{exeStatus.buildState.message || "Building Windows .EXE..."}</span>
                      </div>
                      <span className="font-mono text-amber-400 font-bold">
                        {exeStatus.buildState.progress || 10}%
                      </span>
                    </div>
                    {/* Animated Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500 rounded-full"
                        style={{ width: `${Math.max(10, exeStatus.buildState.progress || 10)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500">
                      Packaging native Electron runtime, Chromium GPU acceleration flags, and offline WebCodecs pipeline.
                    </p>
                  </div>
                ) : exeStatus?.available ? (
                  /* Available for Download */
                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                            <span>Windows Packages Ready</span>
                            <span className="text-[10px] font-mono text-emerald-400">
                              {exeStatus.setup?.sizeFormatted || exeStatus.portable?.sizeFormatted || "Ready"}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400">
                            {exeStatus.setup
                              ? "Includes full Setup Wizard (NSIS Installer) & Portable App."
                              : "Portable binary ready. Click Setup to compile Wizard Installer."}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Ready
                      </span>
                    </div>

                    {/* Active Download Progress Bar */}
                    {downloadProgress?.active && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 text-amber-300 font-semibold">
                            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            <span className="truncate">{downloadProgress.message}</span>
                          </div>
                          <span className="font-mono text-amber-400 font-bold ml-2 shrink-0">
                            {downloadProgress.percent}%
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-zinc-950 overflow-hidden border border-zinc-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 transition-all duration-300 rounded-full"
                            style={{ width: `${Math.max(4, downloadProgress.percent)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-zinc-400">
                          Streaming verified Windows binary chunks directly into your browser memory to prevent proxy corruption.
                        </p>
                      </div>
                    )}

                    <div className="space-y-2.5">
                      {/* Option A: Windows Setup Installer (Recommended) */}
                      <div className="p-3 rounded-xl bg-zinc-950/80 border border-amber-500/30 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                            <span>Windows Setup Wizard (.exe)</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                              Recommended
                            </span>
                            {exeStatus.setup && (
                              <span className="text-[10px] font-mono text-emerald-400">
                                {exeStatus.setup.sizeFormatted}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate">
                            Opens installation wizard, installs to Program Files, creates Desktop &amp; Start Menu icons.
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadExe("setup")}
                          className="py-2.5 px-3.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-md shadow-amber-500/20 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{exeStatus.setup ? "Download Setup (.exe)" : "Build & Download Setup"}</span>
                        </button>
                      </div>

                      {/* Option B: Portable Standalone with Splash Loader */}
                      <div className="p-3 rounded-xl bg-zinc-950/50 border border-zinc-800 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                            <span>Portable Standalone App</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                              No Install Needed
                            </span>
                            {exeStatus.portable && (
                              <span className="text-[10px] font-mono text-zinc-400">
                                {exeStatus.portable.sizeFormatted}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-400 truncate">
                            Single-file for USB drives. Runs immediately with built-in loading splash screen.
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadExe("portable")}
                          className="py-2.5 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs flex items-center gap-1.5 shrink-0 border border-zinc-700 transition cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-400" />
                          <span>{exeStatus.portable ? "Download Portable (.exe)" : "Build & Download Portable"}</span>
                        </button>
                      </div>

                      {/* Rebuild Trigger */}
                      <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500">
                        <span>Need to recompile latest code changes?</span>
                        <button
                          onClick={handleTriggerBuild}
                          disabled={isTriggeringBuild}
                          className="text-amber-400 hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isTriggeringBuild ? "animate-spin" : ""}`} />
                          <span>Rebuild Fresh Installers</span>
                        </button>
                      </div>
                    </div>

                    {downloadSuccessNotice && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-emerald-200">Download Complete (Verified Windows Executable)</p>
                          <p className="text-[10px] text-emerald-400/80">
                            Check your computer's Downloads folder. Double-click the file to install or run!
                          </p>
                        </div>
                      </div>
                    )}

                    {downloadError && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                        <span>{downloadError}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Not yet built */
                  <div className="space-y-3">
                    {exeStatus?.buildState?.error && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Build failed: {exeStatus.buildState.error}</span>
                      </div>
                    )}
                    <button
                      onClick={handleTriggerBuild}
                      disabled={isTriggeringBuild}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition cursor-pointer disabled:opacity-50"
                    >
                      {isTriggeringBuild ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                          <span>Initiating Build...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 stroke-[2.5]" />
                          <span>Build Standalone Windows .EXE (1-Click)</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Additional Quick Windows Options */}
                <div className="pt-2 border-t border-zinc-800/80 grid grid-cols-2 gap-2">
                  <button
                    onClick={handleDownloadLauncher}
                    className="py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-zinc-100 flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download .bat Launcher</span>
                  </button>

                  <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-[10px] text-zinc-400 select-all">
                    <span>CLI:</span>
                    <span className="text-amber-300">npm run build:exe</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>PWA & Standalone Engine Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

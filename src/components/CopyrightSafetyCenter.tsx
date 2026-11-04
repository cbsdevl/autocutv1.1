import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Download,
  Music,
  Film,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Info,
  HelpCircle,
  ChevronLeft,
} from "lucide-react";
import { CopyrightStatus, LicenseType, MediaItem, RiskLevel, TimelineTrack } from "../types";
import { generateLicenseReportText, triggerDownload } from "../utils/mediaUtils";
import { ROYALTY_FREE_LIBRARY } from "../data/presets";

interface CopyrightSafetyCenterProps {
  projectName: string;
  mediaItems: MediaItem[];
  tracks: TimelineTrack[];
  onUpdateMediaLicense: (
    id: string,
    updates: {
      licenseType: LicenseType;
      source: string;
      licenseUrl?: string;
      creator?: string;
      licenseNotes?: string;
      copyrightStatus: CopyrightStatus;
      riskLevel: RiskLevel;
    }
  ) => void;
  onReplaceRiskyMedia: (oldMediaId: string, newMedia: MediaItem) => void;
  onRunAudit: () => void;
  isAuditing: boolean;
  onBackToStudio?: () => void;
}

export const CopyrightSafetyCenter: React.FC<CopyrightSafetyCenterProps> = ({
  projectName,
  mediaItems,
  tracks,
  onUpdateMediaLicense,
  onReplaceRiskyMedia,
  onRunAudit,
  isAuditing,
  onBackToStudio,
}) => {
  const [selectedAssetForReplace, setSelectedAssetForReplace] = useState<MediaItem | null>(null);

  // High risk audio and video items
  const riskyItems = mediaItems.filter(
    (m) => m.riskLevel === "High" || m.riskLevel === "Medium" || m.copyrightStatus !== "Cleared"
  );
  const clearedItems = mediaItems.filter((m) => m.riskLevel === "Cleared");

  const royaltyFreeAudio = ROYALTY_FREE_LIBRARY.filter((m) => m.type === "audio");

  const handleDownloadReport = () => {
    const reportText = generateLicenseReportText(projectName, mediaItems, tracks);
    triggerDownload(reportText, `${projectName.replace(/\s+/g, "_")}_Copyright_Report.txt`);
  };

  const handleQuickClearOwnership = (asset: MediaItem) => {
    onUpdateMediaLicense(asset.id, {
      licenseType: "own",
      source: "User-Recorded Original Media",
      copyrightStatus: "Cleared",
      riskLevel: "Cleared",
      licenseNotes: "User affirmed complete copyright ownership and original creation.",
    });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-zinc-900/60 border-r border-zinc-800/80 w-full md:w-80 lg:w-96 select-none overflow-hidden">
      {/* Header */}
      <div className="p-2.5 sm:p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {onBackToStudio && (
            <button
              onClick={onBackToStudio}
              className="md:hidden flex items-center gap-0.5 text-xs font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-1 rounded-lg border border-amber-500/30 transition active:scale-95 min-h-[32px]"
              title="Return to Studio (Preview Player & Timeline)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Studio</span>
            </button>
          )}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Copyright Safety Center
            </h2>
            <p className="text-[10px] text-zinc-500">Compliance & Rights Management</p>
          </div>
        </div>
        <button
          onClick={onRunAudit}
          disabled={isAuditing}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition disabled:opacity-50 min-h-[32px] min-w-[32px] flex items-center justify-center"
          title="Re-run AI Copyright Check"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isAuditing ? "animate-spin text-amber-400" : ""}`} />
        </button>
      </div>

      {/* Mandatory Regulatory Warning Banner */}
      <div className="p-3 bg-amber-950/30 border-b border-amber-800/40 space-y-1.5">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>YouTube Content ID Transparency Notice</span>
        </div>
        <p className="text-[10.5px] text-amber-300/90 leading-relaxed">
          AutoCut AI helps you document ownership and replace unauthorized assets, but{" "}
          <strong className="text-white">never promises 100% claim-free immunity</strong>. YouTube
          Content ID and copyright holders maintain automated matching and can enforce claims even on
          licensed works.
        </p>
      </div>

      {/* Action Bar: Download License Report */}
      <div className="p-2.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/60">
        <div className="text-[11px] text-zinc-400">
          <span className="font-bold text-zinc-200">{clearedItems.length}</span> /{" "}
          <span>{mediaItems.length}</span> assets verified
        </div>
        <button
          onClick={handleDownloadReport}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition"
          title="Download full project licensing record"
        >
          <Download className="w-3 h-3" />
          <span>Export License Record</span>
        </button>
      </div>

      {/* Asset Audit List */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {/* Flagged / Risky Assets Section */}
        {riskyItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              Action Required ({riskyItems.length})
            </h3>

            {riskyItems.map((asset) => (
              <div
                key={asset.id}
                className="bg-zinc-950 border border-rose-900/40 rounded-xl p-3 space-y-2 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-100 truncate max-w-[200px]">
                      {asset.name}
                    </h4>
                    <p className="text-[10px] text-zinc-400">
                      Type: {asset.type.toUpperCase()} • Source: {asset.source}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                      asset.riskLevel === "High"
                        ? "bg-rose-950 text-rose-400 border border-rose-800"
                        : "bg-amber-950 text-amber-400 border border-amber-800"
                    }`}
                  >
                    {asset.copyrightStatus}
                  </span>
                </div>

                <div className="text-[10px] text-zinc-400 bg-zinc-900/80 p-2 rounded-lg leading-relaxed">
                  {asset.type === "audio"
                    ? "⚠️ Audio file lacks confirmed sync licensing. Unregistered commercial tracks trigger immediate YouTube Content ID claims."
                    : "⚠️ Media ownership unconfirmed. Verify that you have commercial distribution rights."}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 pt-1">
                  {asset.type === "audio" && (
                    <button
                      onClick={() => setSelectedAssetForReplace(asset)}
                      className="flex-1 py-1.5 px-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                    >
                      <Music className="w-3 h-3" />
                      <span>Replace Risky Music</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleQuickClearOwnership(asset)}
                    className="flex-1 py-1.5 px-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>I Own This</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cleared Assets Section */}
        <div className="space-y-2">
          <h3 className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Cleared & Verified Assets ({clearedItems.length})
          </h3>

          {clearedItems.length === 0 ? (
            <p className="text-xs text-zinc-500 italic p-2">No cleared assets yet.</p>
          ) : (
            clearedItems.map((asset) => (
              <div
                key={asset.id}
                className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-2.5 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <h4 className="text-xs font-semibold text-zinc-200 truncate">{asset.name}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                    <span className="text-emerald-400 font-medium">✓ {asset.licenseType}</span>
                    <span>• {asset.source}</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                  Cleared
                </span>
              </div>
            ))
          )}
        </div>

        {/* Educational Legal Guidelines */}
        <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-2 mt-4 text-[10.5px] text-zinc-400">
          <div className="font-bold text-zinc-300 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            <span>Myth Busting: Content ID Evasion</span>
          </div>
          <p>
            Modifying audio pitch, speeding up clips, reversing footage, or adding visual filters does{" "}
            <strong className="text-zinc-200">NOT</strong> make copyrighted material legal. YouTube's
            audio fingerprinting and perceptual hashing detect altered tracks.
          </p>
        </div>
      </div>

      {/* Replace Risky Music Dialog */}
      {selectedAssetForReplace && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5">
                  <Music className="w-4 h-4 text-rose-400" />
                  Replace Risky Music with Cleared Alternative
                </h3>
                <p className="text-xs text-zinc-400">
                  Replacing: <span className="text-zinc-200">{selectedAssetForReplace.name}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedAssetForReplace(null)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Select one of the certified royalty-free tracks below to instantly replace this audio on the
              timeline and update your project license report:
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {royaltyFreeAudio.map((track) => (
                <div
                  key={track.id}
                  className="bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-zinc-200 truncate">{track.name}</h4>
                    <p className="text-[10px] text-zinc-400">
                      {track.creator} • {track.source}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onReplaceRiskyMedia(selectedAssetForReplace.id, track);
                      setSelectedAssetForReplace(null);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition"
                  >
                    Select & Clear
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-zinc-800 flex justify-end">
              <button
                onClick={() => setSelectedAssetForReplace(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

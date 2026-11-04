import React from "react";
import {
  Film,
  Music,
  Type,
  Sparkles,
  Sliders,
  FolderOpen,
  Subtitles,
  Layers,
  ShieldAlert,
  Folders,
} from "lucide-react";
import { MediaItem } from "../types";

export type MobileTab =
  | "studio"
  | "media"
  | "audio"
  | "text"
  | "captions"
  | "effects"
  | "inspector"
  | "copyright";

interface MobileBottomNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  mediaItems: MediaItem[];
  hasSelectedClip: boolean;
  /** Called when the user taps the Projects button on mobile. */
  onOpenProjects?: () => void;
  projectCount?: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  mediaItems,
  hasSelectedClip,
  onOpenProjects,
  projectCount,
}) => {
  const hasRisk = mediaItems.some(
    (m) => m.riskLevel === "High" || m.riskLevel === "Medium"
  );

  const tabs: {
    id: MobileTab | "projects";
    label: string;
    icon: React.ReactNode;
    badge?: boolean;
    badgeColor?: string;
    onPress?: () => void;
  }[] = [
    {
      id: "studio",
      label: "Studio",
      icon: <Film className="w-5 h-5" />,
    },
    {
      id: "projects",
      label: "Projects",
      icon: (
        <div className="relative">
          <FolderOpen className="w-5 h-5" />
          {projectCount !== undefined && projectCount > 0 && (
            <span className="absolute -top-1 -right-1.5 min-w-[13px] h-[13px] rounded-full bg-zinc-700 text-[8px] font-medium text-zinc-200 flex items-center justify-center px-0.5">
              {projectCount > 9 ? "9+" : projectCount}
            </span>
          )}
        </div>
      ),
      onPress: onOpenProjects,
    },
    {
      id: "media",
      label: "Media",
      icon: <Folders className="w-5 h-5" />,
      badge: hasRisk,
      badgeColor: "bg-amber-500",
    },
    {
      id: "audio",
      label: "Audio",
      icon: <Music className="w-5 h-5" />,
    },
    {
      id: "text",
      label: "Text",
      icon: <Type className="w-5 h-5" />,
    },
    {
      id: "effects",
      label: "Effects",
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      id: "inspector",
      label: "Inspect",
      icon: <Sliders className="w-5 h-5" />,
      badge: hasSelectedClip,
      badgeColor: "bg-amber-400",
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 px-1 py-1 flex items-center justify-around select-none"
      style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
    >
      {tabs.map((tab) => {
        const isProjects = tab.id === "projects";
        const isActive = !isProjects && activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => {
              if (tab.onPress) {
                tab.onPress();
              } else {
                onSelectTab(tab.id as MobileTab);
              }
            }}
            className={`flex-1 min-h-[48px] py-1 px-0.5 rounded-md flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
              isProjects
                ? "text-zinc-500 hover:text-zinc-200"
                : isActive
                ? "text-zinc-100 font-medium"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
          >
            <div className="relative">
              {tab.icon}
              {tab.badge && !isProjects && (
                <span
                  className={`absolute -top-0.5 -right-1 w-2 h-2 rounded-full ${
                    tab.badgeColor || "bg-amber-500"
                    }`}
                />
              )}
            </div>
            <span className="text-[10px] tracking-tight leading-none text-center">
              {tab.label}
            </span>
            {isActive && (
              <span className="absolute bottom-0.5 w-4 h-px bg-amber-400" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

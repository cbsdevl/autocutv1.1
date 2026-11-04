import React from "react";
import { Link } from "react-router-dom";
import { Film, FolderOpen, Zap, HelpCircle, ArrowLeft, Home } from "lucide-react";

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full text-center">
        {/* Logo icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-zinc-950 mx-auto mb-6 shadow-xl shadow-amber-400/20">
          <Film className="w-8 h-8" />
        </div>

        <h1 className="text-6xl font-black text-amber-400 mb-2 tracking-tight">404</h1>
        <h2 className="text-2xl font-bold text-white mb-3">Page Not Found</h2>
        <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
          The video project or page you are looking for does not exist or may have been moved.
        </p>

        {/* Action navigation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <Link
            to="/editor"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-amber-400 hover:bg-amber-300 text-zinc-950 transition shadow-lg shadow-amber-400/20"
          >
            <Film className="w-4 h-4" />
            <span>Open Studio</span>
          </Link>

          <Link
            to="/projects"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 transition"
          >
            <FolderOpen className="w-4 h-4 text-sky-400" />
            <span>My Projects</span>
          </Link>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
          <Link to="/pricing" className="hover:text-zinc-300 flex items-center gap-1.5 transition">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Pricing</span>
          </Link>
          <span>•</span>
          <Link to="/help" className="hover:text-zinc-300 flex items-center gap-1.5 transition">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Help & Guides</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

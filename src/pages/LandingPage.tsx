import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film,
  Scissors,
  ShieldCheck,
  Subtitles,
  Download,
  ArrowRight,
  Play,
  Pause,
  Check,
  ChevronDown,
  Volume2,
  VolumeX,
  Sparkles,
  Layers,
  Clock,
  Sliders,
  HelpCircle,
  ExternalLink,
  LifeBuoy,
  Lock,
  Cpu,
  Monitor,
  Smartphone,
  Square,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { GooglePayMark } from "../components/payments/GooglePayMark";
const heroWorkspaceImg = "/assets/images/hero_editor_workspace_1792169564335.jpg";
const audioWaveformConsoleImg = "/assets/images/audio_waveform_console_1792169564753.jpg";
const creatorReviewImg = "/assets/images/creator_filmmaker_review_1792169564553.jpg";

export const LandingPage: React.FC = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // Interactive Silence Cutter Simulator State
  const [threshold, setThreshold] = useState<number>(-32);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadPos, setPlayheadPos] = useState<number>(0); // 0 to 100
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [selectedAspect, setSelectedAspect] = useState<"16:9" | "9:16" | "1:1">("16:9");

  // Web Audio Context reference for synthesized preview clicks
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Dynamic calculations for simulator
  const originalDuration = 14.5; // minutes
  const reductionFactor = Math.min(0.48, Math.max(0.18, (threshold + 42) * 0.02 + 0.2));
  const trimmedSeconds = Math.round(originalDuration * 60 * (1 - reductionFactor));
  const trimmedMinutes = (trimmedSeconds / 60).toFixed(1);
  const cutsDetected = Math.round(18 + (threshold + 40) * 1.6);
  const percentSaved = Math.round(reductionFactor * 100);

  // 50 simulated audio waveform amplitude bars (0-100)
  const waveformBars = [
    18, 42, 65, 80, 48, 12, 8, 9, 7, 10, 52, 78, 92, 85, 60, 32, 10, 8, 7, 45,
    68, 88, 74, 50, 15, 8, 7, 9, 38, 72, 95, 82, 58, 24, 9, 8, 40, 70, 84, 62,
    28, 10, 9, 8, 55, 80, 94, 76, 42, 15,
  ];

  // Helper to determine if a bar index is below cut threshold
  const isIndexSilent = (idx: number) => {
    const thresholdValue = Math.abs(threshold) * 1.8;
    return waveformBars[idx] < thresholdValue * 0.45;
  };

  // Playhead animation loop when isPlaying is active
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setPlayheadPos((prev) => {
        let next = prev + 1.25;
        if (next >= 100) {
          next = 0;
        }

        // Fast skip over silent segments
        const currentBarIdx = Math.floor((next / 100) * waveformBars.length);
        if (isIndexSilent(currentBarIdx)) {
          // Jump ahead to simulate auto-cutting
          next += 2.0;
          if (soundEnabled && audioCtxRef.current) {
            playCutClick();
          }
        }

        return Math.min(100, next);
      });
    }, 70);

    return () => clearInterval(interval);
  }, [isPlaying, threshold, soundEnabled]);

  // Synthesize a clean micro-click using Web Audio API
  const playCutClick = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {
      // Audio not permitted or suspended, ignore
    }
  };

  const FAQS = [
    {
      q: "How does AutoCut AI detect silences and dead pauses?",
      a: "Our timeline engine runs an in-browser WebAudio analyzer that samples your footage waveform in real time. Sections where audio amplitude drops below your chosen decibel threshold (default -32 dB) for more than 400 milliseconds are flagged and trimmed with micro-crossfades so your dialogue never pops.",
    },
    {
      q: "Does my raw footage get uploaded to external cloud servers?",
      a: "No. Video waveform extraction, speech decoding, and timeline splitting run client-side directly inside your browser. Your multi-gigabyte camera files never leave your machine until you choose to trigger an optional cloud export.",
    },
    {
      q: "How does subscription payment work with Google Pay?",
      a: "Google Pay facilitates recurring subscription access using secure 256-bit tokenized credentials (DPAN). You can authorize payment in one click with your existing saved card in Chrome or Android without manual card entry.",
    },
    {
      q: "Can I generate vertical 9:16 Shorts and 16:9 widescreen from one project?",
      a: "Yes. With a single click in the Studio top bar, switch project aspect ratio between 16:9 widescreen, 9:16 vertical Shorts/TikTok, and 1:1 square. The smart canvas centers your subject automatically.",
    },
    {
      q: "What customer support options are included?",
      a: "All users have access to our comprehensive Help Center and step-by-step guides. Pro and Agency subscribers receive priority 24/7 ticketing through our integrated Support Desk with guaranteed 15-minute response times for billing, export, and technical issues.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#0a0b10] text-zinc-100 flex flex-col font-sans selection:bg-amber-400 selection:text-zinc-950">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP NAVIGATION BAR (Strict 3-Zone Contract)
          Zone 1: Brand wordmark (single element)
          Zone 2: 4-5 single-line nav links
          Zone 3: 1 primary CTA
      ───────────────────────────────────────────────────────────── */}
      <header className="h-16 border-b border-white/[0.08] bg-[#0a0b10]/90 backdrop-blur-md px-6 sm:px-10 flex items-center justify-between gap-8 sticky top-0 z-50">
        {/* Zone 1: Single Text Element Wordmark */}
        <Link
          to="/"
          className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 group"
        >
          <div className="w-7 h-7 rounded-md bg-amber-400 flex items-center justify-center text-zinc-950 font-black shadow-sm group-hover:bg-amber-300 transition-colors">
            <Film className="w-4 h-4" />
          </div>
          <span>AutoCut AI</span>
        </Link>

        {/* Zone 2: Concise Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <a
            href="#capabilities"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Capabilities
          </a>
          <a
            href="#simulator"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Silence Trimmer
          </a>
          <a
            href="#case-study"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Case Study
          </a>
          <Link
            to="/pricing"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Pricing
          </Link>
          <Link
            to="/help"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Guides
          </Link>
          <Link
            to="/support"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <span>Support</span>
          </Link>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <Link
              to="/editor"
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-amber-400/10 flex items-center gap-1.5"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden sm:inline-block px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </Link>
              <Link
                to="/editor"
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors whitespace-nowrap shrink-0 shadow-sm shadow-amber-400/10 flex items-center gap-1.5"
              >
                <span>Try Studio Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
          Confident value proposition, clear visual proof, restrained CTAs
      ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 sm:pt-24 sm:pb-28 px-6 sm:px-10 max-w-7xl mx-auto w-full">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          {/* Unboxed inline kicker */}
          <div className="text-xs font-semibold tracking-wider text-amber-400 uppercase">
            Intelligent Video Assembly for YouTube Creators
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-[1.08] [text-wrap:balance]">
            Remove dead pauses. Protect your copyright. Export in 4K.
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl mx-auto [text-wrap:balance]">
            AutoCut AI scans camera waveforms directly in your browser to split silences, verify background audio against YouTube Content ID standards, and output production-ready video in seconds.
          </p>

          {/* Action Row */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/editor"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-amber-400/15 whitespace-nowrap shrink-0"
            >
              <span>Open Video Studio</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/pricing"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white font-medium text-sm transition flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
            >
              <span>View Pricing Plans</span>
            </Link>
          </div>

          {/* Trust points - unboxed text separated by dots */}
          <div className="pt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-zinc-500">
            <span>Runs locally in browser</span>
            <span aria-hidden="true">·</span>
            <span>Zero file size upload caps</span>
            <span aria-hidden="true">·</span>
            <span>Google Pay 1-click checkout</span>
            <span aria-hidden="true">·</span>
            <span>No watermark on Free tier</span>
          </div>
        </div>

        {/* Hero Visual Asset: High-Fidelity Studio Workplace Image with Measured Scrim */}
        <div className="mt-12 sm:mt-16 rounded-2xl border border-white/[0.08] overflow-hidden bg-[#12141c] shadow-2xl relative">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <img
              src={heroWorkspaceImg}
              onError={(e) => {
                const t = e.currentTarget;
                if (!t.dataset.fallback) {
                  t.dataset.fallback = "true";
                  t.src = "/assets/images/hero_editor_workspace_1792169564335.jpg";
                }
              }}
              alt="Professional AutoCut AI video editing studio workspace with ultra-wide waveform monitor"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            {/* Subtle bottom contrast scrim */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b10] via-transparent to-transparent opacity-85" />

            {/* Overlaid UI Annotation Bar */}
            <div className="absolute bottom-4 left-4 right-4 sm:bottom-6 sm:left-6 sm:right-6 p-4 rounded-xl bg-[#0a0b10]/90 backdrop-blur-md border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">Automated First Cut Engine</p>
                  <p className="text-[11px] text-zinc-400">
                    Real-time silence thresholding &amp; subtitle generation directly on your timeline
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] text-zinc-500 block uppercase font-mono">Render Speed</span>
                  <span className="text-emerald-400 font-bold font-mono">3.4× Realtime</span>
                </div>
                <div className="h-6 w-[1px] bg-white/[0.08] hidden sm:block" />
                <Link
                  to="/editor"
                  className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-zinc-950 font-bold text-xs hover:bg-amber-300 transition whitespace-nowrap"
                >
                  Try Timeline
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. INTERACTIVE SILENCE CUT SIMULATOR
          Real working demonstration with live playhead and dynamic stats
      ───────────────────────────────────────────────────────────── */}
      <section
        id="simulator"
        className="py-16 sm:py-24 px-6 sm:px-10 max-w-7xl mx-auto w-full border-t border-white/[0.06]"
      >
        <div className="max-w-2xl mb-10">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Interactive Demonstration
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            See how much time you save on every raw camera take
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
            Drag the decibel threshold slider below or click <strong className="text-zinc-200">Play Timeline</strong>. Watch the playhead dynamically skip quiet pauses in real time.
          </p>
        </div>

        {/* Simulator Box */}
        <div className="bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Top Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
            <div>
              <label
                htmlFor="threshold-slider"
                className="text-xs font-semibold text-zinc-300 block mb-1"
              >
                Audio Silence Cutoff Threshold:{" "}
                <span className="font-mono text-amber-400 font-bold">{threshold} dB</span>
              </label>
              <span className="text-[11px] text-zinc-500">
                Audio quieter than {threshold} dB is flagged as dead air and excised
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="threshold-slider"
                type="range"
                min="-44"
                max="-20"
                step="2"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-40 sm:w-48 accent-amber-400 cursor-pointer"
              />

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? "Mute audio cues" : "Enable sound cues"}
                className={`p-2 rounded-lg border text-xs transition ${
                  soundEnabled
                    ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                    : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 ${
                  isPlaying
                    ? "bg-amber-400 text-zinc-950 font-bold"
                    : "bg-zinc-800 hover:bg-zinc-700 text-white"
                }`}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? "Pause" : "Play Timeline"}</span>
              </button>
            </div>
          </div>

          {/* Waveform Visualization Strip with Live Playhead */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>00:00 Raw Camera Card</span>
              </span>
              <span>14:30 End of Interview</span>
            </div>

            <div className="h-28 bg-[#0a0b10] rounded-xl border border-white/[0.06] p-3 flex items-center justify-between gap-1 overflow-hidden relative select-none">
              {/* Threshold line indicator */}
              <div
                className="absolute left-0 right-0 border-t border-dashed border-amber-400/40 pointer-events-none transition-all duration-300 z-10"
                style={{ top: `${Math.min(85, Math.max(15, (threshold + 44) * 2.8))}%` }}
              >
                <span className="absolute right-3 -top-4 text-[9px] font-mono text-amber-400/80">
                  Threshold Cutline ({threshold} dB)
                </span>
              </div>

              {/* Moving Playhead Line */}
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-20 pointer-events-none transition-[left] duration-75 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                style={{ left: `${playheadPos}%` }}
              >
                <div className="absolute -top-1 -left-1.5 w-3.5 h-3.5 bg-amber-400 rounded-full flex items-center justify-center text-[7px] text-zinc-950 font-black shadow-md">
                  ▶
                </div>
              </div>

              {waveformBars.map((val, idx) => {
                const isSilent = isIndexSilent(idx);

                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col justify-center items-center h-full relative"
                    title={`Amplitude: ${val}%`}
                  >
                    <div
                      className={`w-full max-w-[8px] rounded-full transition-all duration-300 ${
                        isSilent
                          ? "bg-red-500/25 border-t border-red-500/50"
                          : "bg-amber-400/80 hover:bg-amber-300"
                      }`}
                      style={{ height: `${val}%` }}
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-zinc-500 pt-1 gap-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>Spoken Dialogue (Preserved)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500/60" />
                  <span>Silent Hesitations (Trimmed)</span>
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">
                Frame-accurate micro-crossfade smoothing enabled
              </span>
            </div>
          </div>

          {/* Quantitative Realtime Impact Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[#0a0b10] border border-white/[0.06]">
              <span className="text-[11px] text-zinc-500 block">Raw Footage</span>
              <span className="text-xl font-bold font-mono text-zinc-300 mt-0.5 block">14.5 min</span>
              <span className="text-[10px] text-zinc-600">Unedited take</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0b10] border border-white/[0.06]">
              <span className="text-[11px] text-zinc-500 block">Trimmed Duration</span>
              <span className="text-xl font-bold font-mono text-emerald-400 mt-0.5 block">
                {trimmedMinutes} min
              </span>
              <span className="text-[10px] text-emerald-500/80">High-retention pace</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0b10] border border-white/[0.06]">
              <span className="text-[11px] text-zinc-500 block">Dead Air Excised</span>
              <span className="text-xl font-bold font-mono text-amber-400 mt-0.5 block">
                {cutsDetected} cuts
              </span>
              <span className="text-[10px] text-zinc-500">Crossfaded seamlessly</span>
            </div>

            <div className="p-4 rounded-xl bg-[#0a0b10] border border-white/[0.06]">
              <span className="text-[11px] text-zinc-500 block">Pacing Improvement</span>
              <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                +{percentSaved}%
              </span>
              <span className="text-[10px] text-zinc-500">Viewer drop-off reduced</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. CORE CAPABILITIES (Asymmetric Bento Architecture)
          Detailed real outcomes using clean human editorial numbering
      ───────────────────────────────────────────────────────────── */}
      <section
        id="capabilities"
        className="py-16 sm:py-24 px-6 sm:px-10 max-w-7xl mx-auto w-full border-t border-white/[0.06]"
      >
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Engineering Rigor
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Built specifically for YouTube workflow bottlenecks
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2 leading-relaxed">
            Eliminate repetitive timeline scrubbing, aspect ratio re-framing, and copyright anxiety before you push your content live.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Span 2 cols - Multi-Aspect Ratio Smart Reframing with Interactive Switcher */}
          <div className="md:col-span-2 bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-4 font-mono">
                <span>01. Multi-Format Canvas Engine</span>
                <Sliders className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                One-Click Aspect Ratio Re-Framing
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xl">
                Switch effortlessly between 16:9 widescreen for main YouTube videos, 9:16 vertical for Shorts and TikTok, and 1:1 square for feed distribution.
              </p>
            </div>

            {/* Interactive Aspect Ratio Preview Box */}
            <div className="bg-[#0a0b10] border border-white/[0.06] rounded-xl p-4 flex flex-col sm:flex-row items-center gap-6">
              {/* Aspect Ratio Selector Tabs */}
              <div className="flex sm:flex-col gap-2 shrink-0">
                <button
                  onClick={() => setSelectedAspect("16:9")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                    selectedAspect === "16:9"
                      ? "bg-amber-400 text-zinc-950"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>16:9 Widescreen</span>
                </button>
                <button
                  onClick={() => setSelectedAspect("9:16")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                    selectedAspect === "9:16"
                      ? "bg-amber-400 text-zinc-950"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>9:16 Shorts</span>
                </button>
                <button
                  onClick={() => setSelectedAspect("1:1")}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
                    selectedAspect === "1:1"
                      ? "bg-amber-400 text-zinc-950"
                      : "bg-zinc-900 text-zinc-400 hover:text-white"
                  }`}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>1:1 Square</span>
                </button>
              </div>

              {/* Dynamic Aspect Ratio Preview Box */}
              <div className="flex-1 w-full flex items-center justify-center p-2 bg-zinc-950/60 rounded-lg min-h-[160px]">
                <div
                  className={`border border-amber-400/40 bg-zinc-900 rounded-md transition-all duration-300 flex flex-col items-center justify-center text-center p-4 relative overflow-hidden shadow-inner ${
                    selectedAspect === "16:9"
                      ? "w-full max-w-[280px] aspect-[16/9]"
                      : selectedAspect === "9:16"
                      ? "w-[120px] aspect-[9/16]"
                      : "w-[150px] aspect-square"
                  }`}
                >
                  <Film className="w-5 h-5 text-amber-400 mb-1" />
                  <span className="text-[11px] font-bold text-white block">
                    {selectedAspect === "16:9"
                      ? "YouTube Longform"
                      : selectedAspect === "9:16"
                      ? "YouTube Shorts"
                      : "Social Post"}
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {selectedAspect === "16:9"
                      ? "3840 × 2160 (4K)"
                      : selectedAspect === "9:16"
                      ? "1080 × 1920"
                      : "1080 × 1080"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Smart subject centering</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Burn-in open captions</span>
              </div>
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>60fps high bitrate export</span>
              </div>
            </div>
          </div>

          {/* Card 2: Span 1 col - Pre-Upload Copyright Safety Center with Real Console Image */}
          <div className="bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-4 font-mono">
                <span>02. Rights Verification</span>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                YouTube Copyright Safety Center
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Scan your background music and sound effects against commercial rights databases and YouTube Content ID signatures to ensure 100% monetization safety before upload.
              </p>
            </div>

            {/* Authentic Spectrogram Console Thumbnail */}
            <div className="rounded-xl overflow-hidden border border-white/[0.08] relative aspect-[4/3] bg-zinc-950">
              <img
                src={audioWaveformConsoleImg}
                onError={(e) => {
                  const t = e.currentTarget;
                  if (!t.dataset.fallback) {
                    t.dataset.fallback = "true";
                    t.src = "/assets/images/audio_waveform_console_1792169564753.jpg";
                  }
                }}
                alt="Audio spectrogram console showing safe frequency ranges and Content ID verification"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-semibold font-mono">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Content ID: 0 Flagged Segments</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] text-xs text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Pre-render risk score (0 to 100%)</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Audio spectrogram inspection</span>
              </div>
            </div>
          </div>

          {/* Card 3: Span 1 col - Chapter Markers & SEO Tags */}
          <div className="bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-4 font-mono">
                <span>03. Chapter Timestamps</span>
                <Subtitles className="w-4 h-4 text-sky-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Instant YouTube Chapter Timestamps
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Automatically generate formatted timestamped chapter markers that paste directly into your YouTube video description, improving retention and search discovery.
              </p>
            </div>

            <div className="p-3 bg-[#0a0b10] border border-white/[0.06] rounded-xl text-[11px] font-mono text-zinc-400 space-y-1">
              <p className="text-zinc-500 text-[10px] uppercase font-semibold">
                Formatted Description Output:
              </p>
              <p className="text-zinc-300">00:00 - Introduction &amp; Setup</p>
              <p className="text-zinc-300">02:14 - Camera Rig Demonstration</p>
              <p className="text-zinc-300">06:45 - Live Audio Testing</p>
              <p className="text-zinc-300">11:20 - Final Recommendations</p>
            </div>

            <div className="pt-2 border-t border-white/[0.06] text-xs text-zinc-400 space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>1-click copy formatted chapters</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Auto-generated high-CTR search tags</span>
              </div>
            </div>
          </div>

          {/* Card 4: Span 2 cols - Local Privacy & Zero Upload Limits */}
          <div className="md:col-span-2 bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-4 font-mono">
                <span>04. Client-Side Workstation</span>
                <Cpu className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                100% Client-Side Privacy &amp; Zero File Upload Caps
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed max-w-xl">
                Unlike cloud services that require waiting 45 minutes to upload a 20GB camera card, AutoCut AI runs its waveform analysis and timeline splitting directly on your CPU and GPU using WebAssembly and WebAudio.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-[#0a0b10] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">Security</span>
                <span className="text-sm font-semibold text-white mt-1 block">Zero Cloud Upload</span>
                <span className="text-[10px] text-zinc-400">Files stay strictly on your device</span>
              </div>
              <div className="p-3.5 bg-[#0a0b10] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">Speed</span>
                <span className="text-sm font-semibold text-emerald-400 mt-1 block">Instant Ingestion</span>
                <span className="text-[10px] text-zinc-400">Scrub 4K footage without buffering</span>
              </div>
              <div className="p-3.5 bg-[#0a0b10] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] uppercase font-mono text-zinc-500 block">Portability</span>
                <span className="text-sm font-semibold text-amber-400 mt-1 block">Offline Capable</span>
                <span className="text-[10px] text-zinc-400">Edit on trains, planes, and sets</span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
              <span>Backed by WebCodecs &amp; WebAudio browser standards</span>
              <Link
                to="/help"
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <span>Read technical guide</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. PROOF OF IMPACT / REAL CREATOR CASE STUDY
          Concrete quantified metrics adjacent to claims
      ───────────────────────────────────────────────────────────── */}
      <section
        id="case-study"
        className="py-16 sm:py-24 px-6 sm:px-10 max-w-7xl mx-auto w-full border-t border-white/[0.06]"
      >
        <div className="bg-[#12141c] border border-white/[0.08] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-2 items-stretch">
          {/* Left: Authentic Editorial Imagery */}
          <div className="relative aspect-[4/3] lg:aspect-auto h-full min-h-[340px]">
            <img
              src={creatorReviewImg}
              onError={(e) => {
                const t = e.currentTarget;
                if (!t.dataset.fallback) {
                  t.dataset.fallback = "true";
                  t.src = "/assets/images/creator_filmmaker_review_1792169564553.jpg";
                }
              }}
              alt="Editorial portrait of video creator editing YouTube episode in studio"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#12141c]/80 hidden lg:block" />
          </div>

          {/* Right: Quantified Case Proof */}
          <div className="p-8 sm:p-12 flex flex-col justify-between space-y-8">
            <div className="space-y-4">
              <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Production Case Study
              </div>
              <h3 className="text-2xl font-bold text-white tracking-tight leading-snug">
                &ldquo;AutoCut dropped our weekly rough cut assembly from 4.5 hours down to 35 minutes.&rdquo;
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                Talking-head videos have dozens of small false starts, breath pauses, and sentence resets. Instead of manually cutting every one, AutoCut excises dead air and leaves clean crossfades so our team can focus on storytelling.
              </p>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/[0.06]">
              <div>
                <span className="text-2xl sm:text-3xl font-extrabold text-white font-mono block">
                  87%
                </span>
                <span className="text-xs text-zinc-400">Reduction in initial rough cut editing time</span>
              </div>
              <div>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono block">
                  0
                </span>
                <span className="text-xs text-zinc-400">Content ID strikes across 140+ episodes</span>
              </div>
            </div>

            {/* Attribution */}
            <div className="text-xs text-zinc-400">
              <strong className="text-white block font-medium">Marcus Vance</strong>
              <span>Lead Producer · Apex Tech Media (420k subscribers)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. PRICING OVERVIEW (Transparent, Google Pay Integrated)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-6 sm:px-10 max-w-7xl mx-auto w-full border-t border-white/[0.06]">
        <div className="text-center max-w-xl mx-auto mb-12">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Clear, Transparent Pricing
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Start free, upgrade as you publish
          </h2>
          <p className="text-xs sm:text-sm text-zinc-400 mt-2">
            No unexpected fees or hidden charges. Pay easily and securely with Google Pay.
          </p>
        </div>

        {/* 3 Tier Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Tier */}
          <div className="bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-white">Free Studio</h4>
                <p className="text-xs text-zinc-400 mt-1">For new creators testing the workflow</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white font-mono">$0</span>
                <span className="text-xs text-zinc-500">/ forever</span>
              </div>

              <div className="space-y-2 text-xs text-zinc-300 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2 AI auto-video generations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1080p Full HD video export</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Unlimited manual timeline cuts</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No exported watermark</span>
                </div>
              </div>
            </div>

            <Link
              to="/editor"
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition text-center"
            >
              Start Free
            </Link>
          </div>

          {/* Pro Tier (Highlighted) */}
          <div className="bg-[#161822] border border-amber-400/60 rounded-2xl p-6 flex flex-col justify-between space-y-6 relative shadow-xl shadow-amber-400/5">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-lg font-bold text-white">Pro Tier</h4>
                  <p className="text-xs text-zinc-400 mt-1">For active weekly YouTubers</p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                  Most Popular
                </span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white font-mono">$19.99</span>
                <span className="text-xs text-zinc-500">/ month</span>
              </div>

              <div className="space-y-2 text-xs text-zinc-300 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>50 AI auto-video generations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>4K 60fps high-bitrate export</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto-captions &amp; YouTube chapter tags</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Copyright Safety Center scanner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Priority customer support desk</span>
                </div>
              </div>
            </div>

            <Link
              to="/pricing"
              className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-xs font-bold text-zinc-950 transition flex items-center justify-center gap-2 shadow-md shadow-amber-400/20"
            >
              <span>Subscribe with</span>
              <GooglePayMark height={18} theme="light" />
            </Link>
          </div>

          {/* Agency Tier */}
          <div className="bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-white">Agency</h4>
                <p className="text-xs text-zinc-400 mt-1">For studios and multi-channel teams</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black text-white font-mono">$49.99</span>
                <span className="text-xs text-zinc-500">/ month</span>
              </div>

              <div className="space-y-2 text-xs text-zinc-300 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Unlimited AI auto-cut generations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Multi-project batch export archive</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Enterprise Content ID rights scanner</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>24/7 dedicated priority ticket support</span>
                </div>
              </div>
            </div>

            <Link
              to="/pricing"
              className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-white transition text-center"
            >
              Choose Agency Plan
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. 24/7 CUSTOMER SUPPORT & ASSISTANCE CARD
      ───────────────────────────────────────────────────────────── */}
      <section className="py-12 px-6 sm:px-10 max-w-5xl mx-auto w-full">
        <div className="bg-[#12141c] border border-white/[0.08] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">
                Need Help with Google Pay, Billing, or Video Exports?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-xl">
                Our support team is available 24/7 to resolve subscription questions, render queries, or custom organization licenses. Open a support ticket anytime.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/support"
              className="px-4 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-white transition flex items-center gap-2 whitespace-nowrap"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-emerald-400" />
              <span>Customer Support</span>
            </Link>
            <Link
              to="/help"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition whitespace-nowrap"
            >
              Guides
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. MINIMALIST FAQ ACCORDION
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-24 px-6 sm:px-10 max-w-4xl mx-auto w-full border-t border-white/[0.06]">
        <div className="text-center mb-10">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Answers &amp; Clarity
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div
                key={idx}
                className="bg-[#12141c] border border-white/[0.08] rounded-xl overflow-hidden transition"
              >
                <button
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer"
                >
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-amber-400" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-5 sm:px-5 sm:pb-5 text-xs sm:text-sm text-zinc-400 leading-relaxed border-t border-white/[0.04] pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. CALL TO ACTION STRIP
      ───────────────────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-6 sm:px-10 max-w-7xl mx-auto w-full border-t border-white/[0.06]">
        <div className="bg-gradient-to-r from-[#161822] via-[#12141c] to-[#161822] border border-white/[0.08] rounded-2xl p-8 sm:p-12 flex flex-col lg:flex-row lg:items-center justify-between gap-6 text-center lg:text-left">
          <div className="space-y-2 max-w-xl">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Ready to streamline your video editing?
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Open AutoCut Studio now in your browser. No credit card required to start editing your footage.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-end gap-3 shrink-0">
            <Link
              to="/editor"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-sm transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
            >
              <span>Launch Studio Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/pricing"
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm transition flex items-center justify-center"
            >
              Pricing &amp; Plans
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. QUIET PROFESSIONAL FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/[0.08] bg-[#07080b] px-6 sm:px-10 py-12 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-zinc-300 font-bold text-sm">
              <Film className="w-4 h-4 text-amber-400" />
              <span>AutoCut AI</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Professional automatic video editor &amp; YouTube timeline pipeline.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-zinc-400 font-medium">
            <Link to="/editor" className="hover:text-white transition">
              Studio
            </Link>
            <Link to="/pricing" className="hover:text-white transition">
              Pricing
            </Link>
            <Link to="/help" className="hover:text-white transition">
              Documentation
            </Link>
            <Link to="/support" className="hover:text-white transition">
              Customer Support
            </Link>
            <Link to="/gpay-buyflow" className="hover:text-white transition">
              Google Pay Console Kit
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 mt-8 border-t border-white/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] text-zinc-600">
          <span>&copy; {new Date().getFullYear()} AutoCut AI. All rights reserved.</span>
          <span>Google Pay is a trademark of Google LLC.</span>
        </div>
      </footer>
    </div>
  );
};

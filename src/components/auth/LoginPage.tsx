import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Film, Eye, EyeOff, Loader2, Mail, Lock, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { GoogleAuthButton } from "./GoogleAuthButton";

interface LoginPageProps {
  onSwitchToRegister?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSwitchToRegister }) => {
  const { login, error, clearError, isLoading, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // If user is already authenticated, redirect
  React.useEffect(() => {
    if (currentUser) {
      const from = (location.state as any)?.from?.pathname || "/editor";
      navigate(from, { replace: true });
    }
  }, [currentUser, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    const success = await login(email.trim().toLowerCase(), password);
    setSubmitting(false);
    if (success) {
      const from = (location.state as any)?.from?.pathname || "/editor";
      navigate(from, { replace: true });
    }
  };

  const handleGoogleSuccess = () => {
    const from = (location.state as any)?.from?.pathname || "/editor";
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and App Title */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link to="/" className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform">
            <Film className="w-6 h-6 text-zinc-950" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">AutoCut AI</h1>
            <p className="text-xs text-zinc-400">Intelligent Video Editor</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#13131a] border border-white/8 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <h2 className="text-2xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-zinc-400 text-sm mb-6">Sign in to continue editing your videos</p>

          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-5 text-sm text-red-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">{error}</div>
            </div>
          )}

          {/* Google Authentication */}
          <div className="mb-5">
            <GoogleAuthButton
              label="Sign in with Google"
              onSuccess={handleGoogleSuccess}
            />
          </div>

          <div className="relative flex items-center justify-center my-6">
            <div className="border-t border-white/10 w-full" />
            <span className="bg-[#13131a] px-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase shrink-0">
              or continue with email
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-zinc-300">Password</label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your password"
                  className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || isLoading}
              className="w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 mt-2 text-sm"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
            </button>
          </form>

          {/* Security badge */}
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Encrypted Session · Brute-Force Rate Limiting Active</span>
          </div>

          <p className="text-center text-sm text-zinc-400 mt-6">
            Don't have an account?{" "}
            {onSwitchToRegister ? (
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Create one free
              </button>
            ) : (
              <Link
                to="/register"
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Create one free
              </Link>
            )}
          </p>

          <div className="mt-6 pt-5 border-t border-zinc-800/80 flex items-center justify-center gap-4 text-xs text-zinc-500">
            <Link to="/pricing" className="hover:text-zinc-300 transition-colors">Pricing</Link>
            <span>•</span>
            <Link to="/help" className="hover:text-zinc-300 transition-colors">Help & Guides</Link>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6">
          © {new Date().getFullYear()} AutoCut AI · Professional Video Editing Platform
        </p>
      </div>
    </div>
  );
};

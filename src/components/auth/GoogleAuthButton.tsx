import React, { useState } from "react";
import { Loader2, ShieldCheck, AlertCircle, ExternalLink } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { signInWithGoogleReal } from "../../utils/firebaseAuth";

interface GoogleAuthButtonProps {
  label?: string;
  onSuccess?: () => void;
  onError?: (err: string) => void;
}

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  label = "Sign in with Google",
  onSuccess,
  onError,
}) => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleRealGoogleSignIn = async () => {
    setLoading(true);
    setAuthError(null);

    try {
      // 1. Launch real Google OAuth popup via Firebase Auth SDK
      const googleResult = await signInWithGoogleReal();

      // 2. Transmit real Google credentials to backend
      const success = await loginWithGoogle({
        email: googleResult.email,
        name: googleResult.name,
        picture: googleResult.photoUrl || undefined,
        googleId: googleResult.googleId,
        credential: googleResult.idToken,
      });

      setLoading(false);

      if (success) {
        onSuccess?.();
      } else {
        const msg = "Google authentication failed on server.";
        setAuthError(msg);
        onError?.(msg);
      }
    } catch (err: any) {
      setLoading(false);
      console.warn("[GoogleAuth] Popup result:", err);

      let friendlyMessage = "Google Sign-In was cancelled or encountered an error.";

      if (err?.code === "auth/popup-blocked") {
        friendlyMessage =
          "The Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again.";
      } else if (err?.code === "auth/popup-closed-by-user") {
        friendlyMessage = "Sign-in cancelled. The Google popup was closed before completion.";
      } else if (err?.code === "auth/network-request-failed") {
        friendlyMessage = "Network error connecting to Google servers. Please check your internet connection.";
      } else if (err?.message) {
        friendlyMessage = err.message;
      }

      setAuthError(friendlyMessage);
      onError?.(friendlyMessage);
    }
  };

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handleRealGoogleSignIn}
        disabled={loading}
        className="w-full relative flex items-center justify-center gap-3 bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-800 font-medium py-2.5 px-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group disabled:opacity-60 disabled:cursor-not-allowed text-sm border border-zinc-200"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
        ) : (
          <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span className="font-semibold">{loading ? "Connecting to Google…" : label}</span>
      </button>

      {/* Error feedback if popup is blocked or failed */}
      {authError && (
        <div className="flex items-start gap-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <p>{authError}</p>
          </div>
        </div>
      )}

      {/* Verified security tag */}
      <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 pt-0.5">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        <span>Official Google OAuth 2.0 Provider · Secure & Verified</span>
      </div>
    </div>
  );
};

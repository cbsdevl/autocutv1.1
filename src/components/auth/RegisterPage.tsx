import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Film,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  User,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { getDeviceFingerprint } from "../../utils/fingerprint";
import { authFetch } from "../../utils/authClient";

interface RegisterPageProps {
  onSwitchToLogin?: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onSwitchToLogin }) => {
  const {
    register,
    error,
    clearError,
    isLoading,
    currentUser,
    isBlockedByMultiAccount,
    validateEmailAddress,
    sendEmailVerificationCode,
  } = useAuth();
  const navigate = useNavigate();

  // Multi-step state: 1 = Details, 2 = Mandatory Email Code Verification
  const [step, setStep] = useState<1 | 2>(1);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Resend cooldown timer in seconds
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Email validation state
  const [validatingEmail, setValidatingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    checked: boolean;
    valid: boolean;
    domain?: string;
    message?: string;
  }>({ checked: false, valid: false });

  // Device & IP pre-check state
  const [deviceCheck, setDeviceCheck] = useState<{
    checked: boolean;
    isBlocked: boolean;
    reason?: string;
    registeredEmail?: string;
  }>({ checked: false, isBlocked: false });

  // If already authenticated, redirect to editor
  useEffect(() => {
    if (currentUser) {
      navigate("/editor", { replace: true });
    }
  }, [currentUser, navigate]);

  // Handle resend countdown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Pre-check device & IP registration status on mount
  useEffect(() => {
    const checkDevice = async () => {
      try {
        const fp = getDeviceFingerprint();
        const res = await authFetch("/api/auth/device-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceFingerprint: fp }),
        });
        if (res.ok) {
          const data = await res.json();
          setDeviceCheck({
            checked: true,
            isBlocked: data.isBlocked,
            reason: data.reason,
            registeredEmail: data.registeredEmail,
          });
        }
      } catch (e) {
        // Fallback gracefully
      }
    };
    checkDevice();
  }, []);

  // Live real email validation on blur
  const handleEmailBlur = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setEmailStatus({ checked: false, valid: false });
      return;
    }

    setValidatingEmail(true);
    setLocalError(null);

    const result = await validateEmailAddress(trimmed);
    setValidatingEmail(false);

    if (result.valid) {
      setEmailStatus({
        checked: true,
        valid: true,
        domain: result.domain,
        message: result.exists
          ? "Account exists with this email. Please sign in."
          : `✓ Valid email domain (${result.domain}). Ready for verification.`,
      });
      if (result.exists) {
        setLocalError("An account with this email already exists. Please sign in.");
      }
    } else {
      setEmailStatus({
        checked: true,
        valid: false,
        domain: result.domain,
        message: result.error || "Invalid or disposable email address.",
      });
      setLocalError(result.error || "Email domain verification failed.");
    }
  };

  // Password complexity helper
  const passLen = password.length >= 8;
  const passUpper = /[A-Z]/.test(password);
  const passLower = /[a-z]/.test(password);
  const passNumOrSpecial = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const passStrengthScore = [passLen, passUpper, passLower, passNumOrSpecial].filter(Boolean).length;

  // Step 1 Submission: Validate details, send real email code, and advance to Step 2
  const handleProceedToVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (!name.trim()) { setLocalError("Full name is required."); return; }
    if (!email.trim() || !email.includes("@")) { setLocalError("A valid email address is required."); return; }

    if (emailStatus.checked && !emailStatus.valid) {
      setLocalError(emailStatus.message || "Please provide a valid, real email address.");
      return;
    }

    if (password.length < 8) {
      setLocalError("Password must be at least 8 characters long.");
      return;
    }

    if (passStrengthScore < 3) {
      setLocalError("Password is too weak. Please include uppercase, lowercase, and numbers/symbols.");
      return;
    }

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    // Send verification code to the email
    setSendingCode(true);
    const res = await sendEmailVerificationCode(email.trim().toLowerCase(), name.trim());
    setSendingCode(false);

    if (res.success) {
      if (res.desktopMode && res.desktopVerificationCode) {
        setVerificationCode(res.desktopVerificationCode);
        setSuccessNotice(
          `Desktop App Local Backend active. Your studio confirmation code is ${res.desktopVerificationCode} (or use Google Sign-In for instant cloud sync across devices).`
        );
      } else {
        setSuccessNotice(`Verification code sent to ${email.trim()}. Please check your inbox.`);
      }
      setStep(2);
      setResendCooldown(30);
    } else {
      setLocalError(res.error || "Failed to dispatch verification email. Please check the address.");
    }
  };

  // Resend code in Step 2
  const handleResendCode = async () => {
    if (resendCooldown > 0 || sendingCode) return;
    setSendingCode(true);
    setLocalError(null);

    const res = await sendEmailVerificationCode(email.trim().toLowerCase(), name.trim());
    setSendingCode(false);

    if (res.success) {
      if (res.desktopMode && res.desktopVerificationCode) {
        setVerificationCode(res.desktopVerificationCode);
        setSuccessNotice(`Desktop verification code refreshed: ${res.desktopVerificationCode}`);
      } else {
        setSuccessNotice(`A fresh verification code was sent to ${email.trim()}.`);
      }
      setResendCooldown(45);
    } else {
      setLocalError(res.error || "Failed to resend verification code.");
    }
  };

  // Step 2 Submission: Verify code and register account
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanCode = verificationCode.trim().replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setLocalError("Please enter the complete 6-digit code sent to your email.");
      return;
    }

    setSubmitting(true);
    const success = await register(
      name.trim(),
      email.trim().toLowerCase(),
      password,
      cleanCode
    );
    setSubmitting(false);

    if (success) {
      navigate("/editor", { replace: true });
    }
  };

  const handleGoogleSuccess = () => {
    navigate("/editor", { replace: true });
  };

  const displayError = localError || error;
  const isBlocked = isBlockedByMultiAccount || deviceCheck.isBlocked;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-purple-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo and App Title */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Link
            to="/"
            className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 hover:scale-105 transition-transform"
          >
            <Film className="w-6 h-6 text-zinc-950" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white leading-none">AutoCut AI</h1>
            <p className="text-xs text-zinc-400">Intelligent Video Editor</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#13131a] border border-white/8 rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          {/* Multi-Account Blocked Notification */}
          {isBlocked && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-4 mb-6 animate-in fade-in">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="text-xs text-red-300 space-y-2">
                  <p className="font-semibold text-white">Device Registration Limit Reached</p>
                  <p>
                    {deviceCheck.reason ||
                      "An account has already been registered on this device or network address. AutoCut AI strictly enforces one account per device/network to protect trial computing resources."}
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/login"
                      className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors shadow"
                    >
                      Sign In to Your Existing Account
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Standard error banner */}
          {!isBlocked && displayError && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-5 text-xs text-red-400 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{displayError}</div>
            </div>
          )}

          {/* Success / Status Banner */}
          {successNotice && (
            <div className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-5 text-xs text-emerald-400 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successNotice}</div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 1: ACCOUNT DETAILS                                    */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <>
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-2xl font-bold text-white">Create account</h2>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  Step 1 of 2
                </span>
              </div>
              <p className="text-zinc-400 text-sm mb-6">
                Get started with 2 free AI auto-video generations
              </p>

              {/* Real Google Sign-Up Button */}
              <div className="mb-5">
                <GoogleAuthButton
                  label="Sign up with Google"
                  onSuccess={handleGoogleSuccess}
                />
              </div>

              <div className="relative flex items-center justify-center my-6">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#13131a] px-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase shrink-0">
                  or register with email
                </span>
              </div>

              <form onSubmit={handleProceedToVerification} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Rivers"
                      className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                      autoComplete="name"
                      disabled={isBlocked || sendingCode}
                      required
                    />
                  </div>
                </div>

                {/* Email with Live DNS MX Check */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-zinc-300">Email Address</label>
                    {validatingEmail && (
                      <span className="text-[11px] text-amber-400 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Verifying mail server…
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailStatus.checked) setEmailStatus({ checked: false, valid: false });
                      }}
                      onBlur={handleEmailBlur}
                      placeholder="you@example.com"
                      className={`w-full bg-[#1a1a24] border rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-1 transition-colors text-sm ${
                        emailStatus.checked
                          ? emailStatus.valid
                            ? "border-emerald-500/50 focus:border-emerald-400 focus:ring-emerald-400/30"
                            : "border-red-500/50 focus:border-red-400 focus:ring-red-400/30"
                          : "border-white/10 focus:border-amber-400 focus:ring-amber-400/30"
                      }`}
                      autoComplete="email"
                      disabled={isBlocked || sendingCode}
                      required
                    />
                    {emailStatus.checked && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailStatus.valid ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {emailStatus.checked && (
                    <p
                      className={`mt-1.5 text-[11px] leading-tight ${
                        emailStatus.valid ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {emailStatus.message}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-zinc-300">Password</label>
                    <span className="text-[11px] text-zinc-500">Min. 8 characters</span>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Strong password"
                      className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-10 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                      autoComplete="new-password"
                      disabled={isBlocked || sendingCode}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password strength progress bar */}
                  {password.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1 h-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`flex-1 rounded-full transition-all duration-300 ${
                              i <= passStrengthScore
                                ? passStrengthScore <= 1
                                  ? "bg-red-500"
                                  : passStrengthScore <= 2
                                  ? "bg-amber-500"
                                  : passStrengthScore === 3
                                  ? "bg-blue-500"
                                  : "bg-emerald-500"
                                : "bg-white/10"
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500">
                        <span className={passLen ? "text-emerald-400" : ""}>✓ 8+ chars</span>
                        <span className={passUpper ? "text-emerald-400" : ""}>✓ Uppercase</span>
                        <span className={passLower ? "text-emerald-400" : ""}>✓ Lowercase</span>
                        <span className={passNumOrSpecial ? "text-emerald-400" : ""}>✓ Number/Symbol</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-[#1a1a24] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-colors text-sm"
                      autoComplete="new-password"
                      disabled={isBlocked || sendingCode}
                      required
                    />
                  </div>
                </div>

                {/* Continue button */}
                <button
                  type="submit"
                  disabled={sendingCode || isBlocked}
                  className="w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 mt-4 text-sm cursor-pointer"
                >
                  {sendingCode ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending verification code…
                    </>
                  ) : (
                    <>
                      <span>Continue to Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* ─────────────────────────────────────────────────────────── */}
          {/* STEP 2: MANDATORY EMAIL CODE VERIFICATION                   */}
          {/* ─────────────────────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
                  <Mail className="w-7 h-7" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h2 className="text-2xl font-bold text-white">Check your email</h2>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
                    Step 2 of 2
                  </span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed max-w-xs mx-auto">
                  We've sent a 6-digit confirmation code to{" "}
                  <strong className="text-white font-medium block mt-0.5">{email}</strong>
                </p>
              </div>

              <form onSubmit={handleCompleteRegistration} className="space-y-5">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 text-center mb-2">
                    Enter the 6-digit verification code:
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    className="w-full bg-[#181926] border-2 border-amber-400/40 focus:border-amber-400 rounded-xl py-3.5 px-4 text-center text-2xl font-mono tracking-[0.5em] text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all shadow-inner"
                    disabled={submitting}
                    required
                  />
                  <p className="text-[11px] text-zinc-500 text-center mt-2">
                    The code is valid for 15 minutes. Check your inbox and spam folder.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={submitting || verificationCode.trim().length !== 6}
                  className="w-full bg-amber-400 hover:bg-amber-300 active:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying & Creating Account…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify & Complete Registration</span>
                    </>
                  )}
                </button>
              </form>

              {/* Resend and Change Email Options */}
              <div className="pt-2 border-t border-white/8 space-y-3 text-center text-xs text-zinc-400">
                <div className="flex items-center justify-center gap-2">
                  <span>Didn't receive the email?</span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || sendingCode}
                    className="text-amber-400 hover:text-amber-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                  >
                    {sendingCode && <Loader2 className="w-3 h-3 animate-spin" />}
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setVerificationCode("");
                      setLocalError(null);
                      setSuccessNotice(null);
                    }}
                    className="inline-flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Change email address</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security details note */}
          <div className="mt-6 p-3 bg-zinc-900/60 border border-white/8 rounded-xl space-y-1 text-xs text-zinc-400">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Mandatory Inbox Verification</span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              AutoCut AI requires real email verification to protect GPU compute capacity and prevent bot accounts.
            </p>
          </div>

          <p className="text-center text-sm text-zinc-400 mt-5">
            Already have an account?{" "}
            {onSwitchToLogin ? (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Sign in
              </button>
            ) : (
              <Link
                to="/login"
                className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
              >
                Sign in
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

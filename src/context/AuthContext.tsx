// ─────────────────────────────────────────────────────────────
// Auth Context — provides currentUser, login, logout, register,
// Google Auth, and Device/Email Security Verification
// ─────────────────────────────────────────────────────────────
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getDeviceFingerprint } from "../utils/fingerprint";
import { authFetch, setStoredToken, removeStoredToken } from "../utils/authClient";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin";
  plan_slug: string;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  ai_video_limit: number;
  ai_videos_used: number;
  expires_at: string | null;
  google_id?: string | null;
  avatar_url?: string | null;
  email_verified?: number;
}

export interface GoogleAuthPayload {
  credential?: string;
  email?: string;
  name?: string;
  picture?: string;
  googleId?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isLoading: boolean;
  error: string | null;
  isBlockedByMultiAccount: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithGoogle: (payload: GoogleAuthPayload) => Promise<boolean>;
  register: (name: string, email: string, password: string, verificationCode: string) => Promise<boolean>;
  validateEmailAddress: (email: string) => Promise<{ valid: boolean; exists?: boolean; domain?: string; error?: string }>;
  sendEmailVerificationCode: (email: string, name?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  verifyCode: (email: string, code: string) => Promise<{ verified: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBlockedByMultiAccount, setIsBlockedByMultiAccount] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        if (data.token) {
          setStoredToken(data.token);
        }
      } else {
        setCurrentUser(null);
        if (res.status === 401) {
          removeStoredToken();
        }
      }
    } catch {
      setCurrentUser(null);
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const clearError = () => {
    setError(null);
    setIsBlockedByMultiAccount(false);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    setIsBlockedByMultiAccount(false);
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const res = await authFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, deviceFingerprint }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        if (data.token) {
          setStoredToken(data.token);
        }
        return true;
      }
      setError(data.error || "Login failed");
      return false;
    } catch {
      setError("Network error. Please check your connection.");
      return false;
    }
  };

  const loginWithGoogle = async (payload: GoogleAuthPayload): Promise<boolean> => {
    setError(null);
    setIsBlockedByMultiAccount(false);
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const res = await authFetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, deviceFingerprint }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        if (data.token) {
          setStoredToken(data.token);
        }
        return true;
      }
      if (data.blocked) {
        setIsBlockedByMultiAccount(true);
      }
      setError(data.error || "Google sign-in failed.");
      return false;
    } catch {
      setError("Network error during Google authentication.");
      return false;
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    verificationCode: string
  ): Promise<boolean> => {
    setError(null);
    setIsBlockedByMultiAccount(false);
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const res = await authFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          deviceFingerprint,
          verificationCode,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCurrentUser(data.user);
        if (data.token) {
          setStoredToken(data.token);
        }
        return true;
      }
      if (data.blocked) {
        setIsBlockedByMultiAccount(true);
      }
      setError(data.error || "Registration failed");
      return false;
    } catch {
      setError("Network error during registration.");
      return false;
    }
  };

  const validateEmailAddress = async (email: string) => {
    try {
      const res = await authFetch("/api/auth/validate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      return await res.json();
    } catch {
      return { valid: true };
    }
  };

  const sendEmailVerificationCode = async (email: string, name?: string) => {
    try {
      const res = await authFetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || "Failed to send verification code." };
      }
      return { success: true, message: data.message };
    } catch {
      return { success: false, error: "Network error sending verification code." };
    }
  };

  const verifyCode = async (email: string, code: string) => {
    try {
      const res = await authFetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      return await res.json();
    } catch {
      return { verified: false, error: "Network error verifying code." };
    }
  };

  const logout = async () => {
    try {
      const { signOutRealGoogle } = await import("../utils/firebaseAuth");
      await signOutRealGoogle();
    } catch {}
    try {
      await authFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    removeStoredToken();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        error,
        isBlockedByMultiAccount,
        login,
        loginWithGoogle,
        register,
        validateEmailAddress,
        sendEmailVerificationCode,
        verifyCode,
        logout,
        refreshUser,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

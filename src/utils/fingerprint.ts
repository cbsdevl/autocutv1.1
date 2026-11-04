/**
 * Client-side Device Fingerprinting Utility
 * Generates and persists a stable, high-entropy device identifier to prevent
 * multi-accounting and unauthorized trial abuse.
 */

const STORAGE_KEY = "autocut_device_fingerprint_v1";
const COOKIE_KEY = "autocut_dfp";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|;\\s*)(" + name + ")=([^;]*)"));
  return match ? decodeURIComponent(match[3]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function generateRandomUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "dev_" + Math.random().toString(36).substring(2, 15) + "_" + Date.now().toString(36);
}

// Simple fast string hash
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export function getDeviceFingerprint(): string {
  if (typeof window === "undefined") {
    return "server_env";
  }

  try {
    // 1. Check existing storage or cookie
    let storedId = localStorage.getItem(STORAGE_KEY) || getCookie(COOKIE_KEY);

    // 2. Gather device hardware & environment entropy
    const screenInfo = `${window.screen?.width || 0}x${window.screen?.height || 0}x${window.screen?.colorDepth || 0}`;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const lang = navigator.language || "en";
    const cores = navigator.hardwareConcurrency || 4;
    const platform = (navigator as any).userAgentData?.platform || navigator.platform || "web";

    const hardwareHash = hashString(`${screenInfo}-${tz}-${lang}-${cores}-${platform}`);

    if (!storedId) {
      storedId = `${hardwareHash}-${generateRandomUUID()}`;
    }

    // Ensure synced across both localStorage and persistent cookie
    try {
      localStorage.setItem(STORAGE_KEY, storedId);
    } catch {}
    setCookie(COOKIE_KEY, storedId);

    return storedId;
  } catch (err) {
    return "fallback_device_" + Math.random().toString(36).substring(2, 10);
  }
}

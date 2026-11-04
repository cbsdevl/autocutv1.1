import dns from "dns";

// Comprehensive list of known disposable and temporary email domains
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "trashmail.com",
  "yopmail.com",
  "sharklasers.com",
  "getairmail.com",
  "dispostable.com",
  "fakemailgenerator.com",
  "throwawaymail.com",
  "burnermail.io",
  "temp-mail.org",
  "nada.ltd",
  "inboxkitten.com",
  "crazymailing.com",
  "maildrop.cc",
  "generator.email",
  "mohmal.com",
  "mytemp.email",
  "emailondeck.com",
  "getnada.com",
  "tempail.com",
  "dropmail.me",
  "mailsac.com",
  "trashmail.net",
  "tempmailaddress.com",
  "mytempemail.com",
  "disposablemail.com",
  "byom.de",
  "trashmail.org",
  "discard.email",
  "spambog.com",
  "mytempemail.org",
  "guerrillamail.info",
  "grr.la",
  "guerrillamail.biz",
]);

// Standard trusted free email domains where MX is well-known
const TRUSTED_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "zoho.com",
  "fastmail.com",
  "gmx.com",
  "mail.com",
]);

export interface EmailValidationResult {
  valid: boolean;
  error?: string;
  domain?: string;
  mxServers?: string[];
  isDisposable?: boolean;
}

/**
 * Validates an email address against syntax standards, disposable blacklist,
 * and live DNS MX (Mail Exchange) records to verify the address belongs to a real domain.
 */
export async function validateRealEmail(email: string): Promise<EmailValidationResult> {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email address is required." };
  }

  const trimmed = email.trim().toLowerCase();

  // 1. Basic format & length check
  if (trimmed.length > 254) {
    return { valid: false, error: "Email address exceeds maximum allowed length (254 characters)." };
  }

  // Strict RFC 5322 compatible regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Invalid email address format. Please enter a valid address (e.g., name@domain.com)." };
  }

  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "Email address must contain exactly one '@' symbol." };
  }

  const [localPart, domain] = parts;

  if (localPart.length < 1 || localPart.length > 64) {
    return { valid: false, error: "The username portion of the email must be between 1 and 64 characters." };
  }

  // Check top-level domain
  const domainParts = domain.split(".");
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2) {
    return { valid: false, error: "Invalid domain extension. Domain must have a valid top-level domain (e.g. .com, .org)." };
  }

  // 2. Disposable / temporary email shield
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      isDisposable: true,
      domain,
      error: `Disposable and temporary email providers (${domain}) are prohibited. Please use a legitimate personal or work email address.`,
    };
  }

  // Fast path for trusted domains
  if (TRUSTED_DOMAINS.has(domain)) {
    return { valid: true, domain, mxServers: [`verified_${domain}`] };
  }

  // 3. Live DNS MX Record Resolution
  try {
    const mxRecords = await dns.promises.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      // Fallback: check if domain has an A record (some mail servers accept direct IP)
      try {
        const aRecords = await dns.promises.resolve4(domain);
        if (aRecords && aRecords.length > 0) {
          return { valid: true, domain, mxServers: aRecords };
        }
      } catch {}
      return {
        valid: false,
        domain,
        error: `The domain '${domain}' has no active mail server (MX records) configured to receive incoming emails.`,
      };
    }

    const exchanges = mxRecords.map((r) => r.exchange);
    return { valid: true, domain, mxServers: exchanges };
  } catch (err: any) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") {
      return {
        valid: false,
        domain,
        error: `The email domain '${domain}' does not exist on the internet or has no active mail records.`,
      };
    }
    // Network / timeout during DNS lookup: in dev or offline, fallback safely if domain looks well-formed
    console.warn(`[DNS MX Lookup] Warning for ${domain}:`, err?.message || err);
    if (domain.includes(".") && domain.length >= 4) {
      return { valid: true, domain };
    }
    return {
      valid: false,
      domain,
      error: `Unable to verify email domain '${domain}'. Please verify the spelling.`,
    };
  }
}

/**
 * Validates password strength & security requirements
 */
export function validatePasswordSecurity(password: string): { valid: boolean; error?: string } {
  if (!password || typeof password !== "string") {
    return { valid: false, error: "Password is required." };
  }

  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password cannot exceed 128 characters." };
  }

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const criteriaMet = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;

  if (criteriaMet < 3) {
    return {
      valid: false,
      error: "Password is too weak. Please include at least 3 of the following: lowercase letter, uppercase letter, number, and special character.",
    };
  }

  return { valid: true };
}

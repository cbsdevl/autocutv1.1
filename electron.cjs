// Electron Main Process for AutoCut AI Studio Desktop (.EXE)
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const dns = require("dns");

// Hardware & GPU acceleration switches for high-performance WebCodecs video editing
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-webgl");
app.commandLine.appendSwitch("force_high_performance_gpu");

let mainWindow = null;
let splashWindow = null;
let localServer = null;
let serverPort = 0;

const ADMIN_EMAILS = new Set(["admin@autocut.ai", "nizeyimanaplacide2@gmail.com"]);

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "trashmail.com", "yopmail.com", "sharklasers.com", "getairmail.com",
  "dispostable.com", "fakemailgenerator.com", "throwawaymail.com", "burnermail.io",
  "temp-mail.org", "nada.ltd", "inboxkitten.com", "crazymailing.com",
  "maildrop.cc", "generator.email", "mohmal.com", "mytemp.email",
  "emailondeck.com", "getnada.com", "tempail.com", "dropmail.me",
  "mailsac.com", "trashmail.net", "tempmailaddress.com", "mytempemail.com",
]);

const DEFAULT_PLANS = [
  {
    id: 1,
    name: "Free",
    slug: "free",
    price: 0,
    currency: "USD",
    duration_days: 0,
    ai_video_limit: 2,
    is_active: 1,
    description: "2 free AI auto-video edits, timeline studio & local 1080p export",
  },
  {
    id: 2,
    name: "Creator Pro",
    slug: "creator-pro",
    price: 12,
    currency: "USD",
    duration_days: 30,
    ai_video_limit: 50,
    is_active: 1,
    description: "50 AI auto-video edits/month, multi-track effects, cloud project sync & 4K export",
  },
  {
    id: 3,
    name: "Studio Ultra",
    slug: "agency",
    price: 29,
    currency: "USD",
    duration_days: 30,
    ai_video_limit: 999999,
    is_active: 1,
    description: "Unlimited AI auto-cuts, cloud sync across unlimited devices & priority render engine",
  },
];

// Basic MIME type lookup for local file server
const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".webmanifest": "application/manifest+json",
};

// ─────────────────────────────────────────────────────────────────────────
// Embedded Persistent Desktop Database (userData/autocut-desktop-db.json)
// ─────────────────────────────────────────────────────────────────────────

function getDbFilePath() {
  try {
    return path.join(app.getPath("userData"), "autocut-desktop-db.json");
  } catch {
    return path.join(__dirname, "autocut-desktop-db.json");
  }
}

function loadDesktopDb() {
  const dbPath = getDbFilePath();
  const initial = {
    jwtSecret: crypto.randomBytes(32).toString("hex"),
    nextUserId: 1,
    nextPaymentId: 1,
    nextTicketId: 1,
    nextMsgId: 1,
    users: [],
    plans: DEFAULT_PLANS,
    subscriptions: [],
    payments: [],
    tickets: [],
    ticketMessages: [],
    emailVerifications: [],
    deviceRegistrations: [],
    projects: [],
  };
  try {
    if (fs.existsSync(dbPath)) {
      const parsed = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
      return { ...initial, ...parsed, plans: parsed.plans?.length ? parsed.plans : DEFAULT_PLANS };
    }
  } catch (err) {
    console.warn("[DesktopDB] Could not load DB, creating fresh store:", err?.message);
  }
  return initial;
}

let desktopDb = null;
function getDb() {
  if (!desktopDb) desktopDb = loadDesktopDb();
  return desktopDb;
}

function saveDb() {
  try {
    const dbPath = getDbFilePath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const tmpPath = `${dbPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(getDb(), null, 2), "utf-8");
    fs.renameSync(tmpPath, dbPath);
  } catch (err) {
    console.error("[DesktopDB] Failed to persist DB:", err?.message);
  }
}

// Password & JWT helpers using Node built-in crypto
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (storedHash.startsWith("scrypt:")) {
    const [, salt, keyHex] = storedHash.split(":");
    const derived = crypto.scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(keyHex, "hex");
    return derived.length === storedBuf.length && crypto.timingSafeEqual(derived, storedBuf);
  }
  return false;
}

function base64UrlEncode(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signDesktopJwt(userId) {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  const payload = base64UrlEncode(JSON.stringify({ userId, exp }));
  const sig = crypto
    .createHmac("sha256", getDb().jwtSecret)
    .update(`${header}.${payload}`)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${payload}.${sig}`;
}

function verifyDesktopJwt(token) {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expectedSig = crypto
      .createHmac("sha256", getDb().jwtSecret)
      .update(`${header}.${payload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
    if (sig !== expectedSig) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function getRequestToken(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7).trim();
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)autocut_token=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  return null;
}

function getAuthUser(req) {
  const token = getRequestToken(req);
  if (!token) return null;
  const payload = verifyDesktopJwt(token);
  if (!payload || !payload.userId) return null;
  return buildFullUser(payload.userId);
}

function buildFullUser(userId) {
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;

  let sub = db.subscriptions.find((s) => s.user_id === userId && s.is_active === 1);
  if (!sub) {
    sub = {
      id: db.subscriptions.length + 1,
      user_id: userId,
      plan_slug: "free",
      started_at: new Date().toISOString(),
      expires_at: null,
      ai_videos_used: 0,
      is_active: 1,
    };
    db.subscriptions.push(sub);
    saveDb();
  }

  const plan = db.plans.find((p) => p.slug === sub.plan_slug) || db.plans[0];
  const isAdmin = user.role === "admin" || ADMIN_EMAILS.has(user.email.toLowerCase());

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: isAdmin ? "admin" : "user",
    plan_slug: isAdmin && plan.slug === "free" ? "admin" : plan.slug,
    plan_name: isAdmin && plan.slug === "free" ? "Admin (Unlimited)" : plan.name,
    plan_price: plan.price,
    plan_currency: plan.currency,
    ai_video_limit: isAdmin ? 999999 : plan.ai_video_limit,
    ai_videos_used: plan.slug === "free" ? user.free_ai_videos_used || 0 : sub.ai_videos_used || 0,
    expires_at: sub.expires_at || null,
    google_id: user.google_id || null,
    avatar_url: user.avatar_url || null,
    email_verified: user.email_verified ?? 1,
    created_at: user.created_at,
  };
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total <= 50 * 1024 * 1024) chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf-8").trim();
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res, status, data, cookieToken = null) {
  if (cookieToken) {
    res.setHeader("Set-Cookie", `autocut_token=${encodeURIComponent(cookieToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
  }
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function validateEmailDomain(email) {
  const trimmed = String(email || "").trim().toLowerCase();
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!regex.test(trimmed)) return { valid: false, error: "Invalid email address format." };
  const domain = trimmed.split("@")[1];
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { valid: false, domain, error: `Disposable email domain (${domain}) is not allowed.` };
  }
  try {
    const mx = await dns.promises.resolveMx(domain);
    if (mx && mx.length > 0) return { valid: true, domain };
  } catch (err) {
    if (err?.code === "ENOTFOUND" || err?.code === "ENODATA") {
      return { valid: false, domain, error: `Domain '${domain}' does not exist or has no mail records.` };
    }
  }
  return { valid: true, domain };
}

async function handleApiRequest(req, res, urlPath) {
  const method = (req.method || "GET").toUpperCase();
  const db = getDb();

  if (method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health & Desktop Status
  if (urlPath === "/api/health" && method === "GET") {
    return sendJson(res, 200, { status: "ok", mode: "desktop", time: new Date().toISOString() });
  }

  if (urlPath === "/api/desktop/status" && method === "GET") {
    return sendJson(res, 200, { available: true, isDesktopApp: true });
  }

  // Plans
  if (urlPath === "/api/plans" && method === "GET") {
    return sendJson(res, 200, { plans: db.plans });
  }

  // Auth: validate-email
  if (urlPath === "/api/auth/validate-email" && method === "POST") {
    const body = await readJsonBody(req);
    const check = await validateEmailDomain(body.email);
    if (!check.valid) return sendJson(res, 400, check);
    const exists = db.users.some((u) => u.email.toLowerCase() === String(body.email).trim().toLowerCase());
    return sendJson(res, 200, {
      valid: true,
      exists,
      domain: check.domain,
      message: exists ? "An account with this email already exists." : "Email is valid.",
    });
  }

  // Auth: device-check (in desktop mode, inform cleanly without blocking offline registration)
  if (urlPath === "/api/auth/device-check" && method === "POST") {
    return sendJson(res, 200, { isBlocked: false });
  }

  // Auth: send-verification-code (desktop mode returns code safely in local embedded backend)
  if (urlPath === "/api/auth/send-verification-code" && method === "POST") {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) return sendJson(res, 400, { error: "Email address is required." });

    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return sendJson(res, 409, { error: "An account with this email already exists. Please sign in instead." });
    }

    const check = await validateEmailDomain(email);
    if (!check.valid) return sendJson(res, 400, { error: check.error });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    db.emailVerifications = db.emailVerifications.filter((v) => v.email !== email);
    db.emailVerifications.push({
      email,
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
      verified: false,
    });
    saveDb();

    return sendJson(res, 200, {
      success: true,
      desktopMode: true,
      desktopVerificationCode: code,
      message: `Desktop verification code generated for ${email}.`,
    });
  }

  // Auth: verify-code
  if (urlPath === "/api/auth/verify-code" && method === "POST") {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const code = String(body.code || "").trim();
    const entry = db.emailVerifications.find(
      (v) => v.email === email && v.code === code && v.expiresAt > Date.now()
    );
    if (!entry) return sendJson(res, 400, { verified: false, error: "Invalid or expired verification code." });
    entry.verified = true;
    saveDb();
    return sendJson(res, 200, { verified: true });
  }

  // Auth: register
  if (urlPath === "/api/auth/register" && method === "POST") {
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const verificationCode = String(body.verificationCode || "").trim();

    if (!name || !email || !password) {
      return sendJson(res, 400, { error: "Full name, email, and password are required." });
    }
    if (password.length < 8) {
      return sendJson(res, 400, { error: "Password must be at least 8 characters long." });
    }

    const emailCheck = await validateEmailDomain(email);
    if (!emailCheck.valid) return sendJson(res, 400, { error: emailCheck.error });

    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      return sendJson(res, 409, { error: "An account with this email already exists. Please sign in." });
    }

    const codeEntry = db.emailVerifications.find(
      (v) => v.email === email && v.code === verificationCode && v.expiresAt > Date.now()
    );
    if (!codeEntry) {
      return sendJson(res, 400, { error: "Invalid or expired verification code." });
    }
    codeEntry.verified = true;

    const userId = db.nextUserId++;
    const role = ADMIN_EMAILS.has(email) ? "admin" : "user";
    db.users.push({
      id: userId,
      name,
      email,
      password: hashPassword(password),
      role,
      free_ai_videos_used: 0,
      google_id: null,
      avatar_url: null,
      email_verified: 1,
      created_at: new Date().toISOString(),
    });
    db.subscriptions.push({
      id: db.subscriptions.length + 1,
      user_id: userId,
      plan_slug: "free",
      started_at: new Date().toISOString(),
      expires_at: null,
      ai_videos_used: 0,
      is_active: 1,
    });
    saveDb();

    const user = buildFullUser(userId);
    const token = signDesktopJwt(userId);
    return sendJson(res, 200, { user, token }, token);
  }

  // Auth: login
  if (urlPath === "/api/auth/login" && method === "POST") {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const userRow = db.users.find((u) => u.email.toLowerCase() === email);
    if (!userRow || !verifyPassword(password, userRow.password)) {
      return sendJson(res, 401, { error: "Invalid email or password." });
    }
    const user = buildFullUser(userRow.id);
    const token = signDesktopJwt(userRow.id);
    return sendJson(res, 200, { user, token }, token);
  }

  // Auth: Google Sign-In
  if (urlPath === "/api/auth/google" && method === "POST") {
    const body = await readJsonBody(req);
    let resolvedEmail = body.email;
    let resolvedName = body.name;
    let resolvedPicture = body.picture;
    let resolvedGoogleId = body.googleId;

    if (body.credential && typeof body.credential === "string") {
      try {
        const parts = body.credential.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          resolvedEmail = payload.email || resolvedEmail;
          resolvedName = payload.name || resolvedName;
          resolvedPicture = payload.picture || resolvedPicture;
          resolvedGoogleId = payload.sub || resolvedGoogleId;
        }
      } catch {}
    }

    if (!resolvedEmail) {
      return sendJson(res, 400, { error: "Google authentication failed: email missing." });
    }

    const email = String(resolvedEmail).trim().toLowerCase();
    let userRow = db.users.find(
      (u) => (resolvedGoogleId && u.google_id === resolvedGoogleId) || u.email.toLowerCase() === email
    );

    if (userRow) {
      if (resolvedGoogleId && !userRow.google_id) userRow.google_id = resolvedGoogleId;
      if (resolvedPicture) userRow.avatar_url = resolvedPicture;
      if (ADMIN_EMAILS.has(email)) userRow.role = "admin";
      saveDb();
    } else {
      const userId = db.nextUserId++;
      userRow = {
        id: userId,
        name: String(resolvedName || email.split("@")[0] || "Creator"),
        email,
        password: "",
        role: ADMIN_EMAILS.has(email) ? "admin" : "user",
        free_ai_videos_used: 0,
        google_id: resolvedGoogleId || `google_${Date.now()}`,
        avatar_url: resolvedPicture || null,
        email_verified: 1,
        created_at: new Date().toISOString(),
      };
      db.users.push(userRow);
      db.subscriptions.push({
        id: db.subscriptions.length + 1,
        user_id: userId,
        plan_slug: "free",
        started_at: new Date().toISOString(),
        expires_at: null,
        ai_videos_used: 0,
        is_active: 1,
      });
      saveDb();
    }

    const user = buildFullUser(userRow.id);
    const token = signDesktopJwt(userRow.id);
    return sendJson(res, 200, { user, token }, token);
  }

  // Auth: logout
  if (urlPath === "/api/auth/logout" && method === "POST") {
    res.setHeader("Set-Cookie", "autocut_token=; Path=/; Max-Age=0");
    return sendJson(res, 200, { ok: true });
  }

  // Auth: me
  if (urlPath === "/api/auth/me" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized", message: "Please sign in." });
    const token = signDesktopJwt(user.id);
    return sendJson(res, 200, { user, token }, token);
  }

  // Projects API (desktop persistent DB alongside Firestore global sync)
  if (urlPath === "/api/projects" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    const projects = db.projects
      .filter((p) => p.userId === user.id)
      .map(({ snapshotJson, ...summary }) => summary)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return sendJson(res, 200, { projects });
  }

  if (urlPath === "/api/projects" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    const body = await readJsonBody(req);
    if (!body.projectId || !body.snapshotJson) {
      return sendJson(res, 400, { error: "projectId and snapshotJson are required." });
    }
    const now = new Date().toISOString();
    const existing = db.projects.find((p) => p.userId === user.id && p.id === body.projectId);
    if (existing) {
      existing.name = body.name || existing.name;
      existing.aspectRatio = body.aspectRatio || existing.aspectRatio;
      existing.resolution = body.resolution || existing.resolution;
      existing.frameRate = body.frameRate || existing.frameRate;
      existing.mediaCount = body.mediaCount ?? existing.mediaCount;
      existing.thumbnail = body.thumbnail ?? existing.thumbnail;
      existing.snapshotJson = body.snapshotJson;
      existing.updatedAt = now;
      saveDb();
      return sendJson(res, 200, { ok: true, project: existing });
    } else {
      const created = {
        id: body.projectId,
        userId: user.id,
        name: body.name || "Untitled Project",
        aspectRatio: body.aspectRatio || "16:9",
        resolution: body.resolution || "1080p",
        frameRate: body.frameRate || 30,
        mediaCount: body.mediaCount || 0,
        thumbnail: body.thumbnail || undefined,
        snapshotJson: body.snapshotJson,
        createdAt: now,
        updatedAt: now,
      };
      db.projects.push(created);
      saveDb();
      return sendJson(res, 200, { ok: true, project: created });
    }
  }

  if (urlPath.startsWith("/api/projects/")) {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    const projectId = decodeURIComponent(urlPath.slice("/api/projects/".length));
    if (method === "GET") {
      const project = db.projects.find((p) => p.userId === user.id && p.id === projectId);
      if (!project) return sendJson(res, 404, { error: "Project not found." });
      return sendJson(res, 200, { project });
    }
    if (method === "DELETE") {
      db.projects = db.projects.filter((p) => !(p.userId === user.id && p.id === projectId));
      saveDb();
      return sendJson(res, 200, { ok: true });
    }
  }

  // Subscription & Payments
  if (urlPath === "/api/subscription/upgrade" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    const body = await readJsonBody(req);
    const plan = db.plans.find((p) => p.slug === body.planSlug);
    if (!plan) return sendJson(res, 404, { error: "Plan not found." });
    db.subscriptions.forEach((s) => {
      if (s.user_id === user.id) s.is_active = 0;
    });
    const expiresAt = plan.duration_days > 0
      ? new Date(Date.now() + plan.duration_days * 86400000).toISOString()
      : null;
    db.subscriptions.push({
      id: db.subscriptions.length + 1,
      user_id: user.id,
      plan_slug: plan.slug,
      started_at: new Date().toISOString(),
      expires_at: expiresAt,
      ai_videos_used: 0,
      is_active: 1,
    });
    saveDb();
    return sendJson(res, 200, { ok: true, plan: plan.name, expiresAt });
  }

  if (urlPath === "/api/payments/config" && method === "GET") {
    return sendJson(res, 200, {
      environment: "TEST",
      merchantName: "AutoCut AI Studio",
      merchantId: "12345678901234567890",
      gateway: "example",
      gatewayMerchantId: "exampleGatewayMerchantId",
      allowedCardNetworks: ["VISA", "MASTERCARD", "AMEX", "DISCOVER"],
      allowedCardAuthMethods: ["PAN_ONLY", "CRYPTOGRAM_3DS"],
    });
  }

  if (urlPath === "/api/payments/history" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    const payments = db.payments.filter((p) => p.user_id === user.id);
    return sendJson(res, 200, { payments });
  }

  if (urlPath === "/api/ai/consume-generation" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    if (user.role !== "admin" && user.ai_videos_used >= user.ai_video_limit) {
      return sendJson(res, 403, { error: "AI generation quota reached. Please upgrade your plan." });
    }
    const uRow = db.users.find((u) => u.id === user.id);
    if (uRow) uRow.free_ai_videos_used = (uRow.free_ai_videos_used || 0) + 1;
    const sub = db.subscriptions.find((s) => s.user_id === user.id && s.is_active === 1);
    if (sub) sub.ai_videos_used = (sub.ai_videos_used || 0) + 1;
    saveDb();
    return sendJson(res, 200, { ok: true });
  }

  if (urlPath === "/api/support/tickets" && method === "GET") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    const tickets = db.tickets.filter((t) => t.user_id === user.id);
    return sendJson(res, 200, { tickets });
  }

  if (urlPath === "/api/support/tickets" && method === "POST") {
    const user = getAuthUser(req);
    if (!user) return sendJson(res, 401, { error: "unauthorized" });
    const body = await readJsonBody(req);
    const id = db.nextTicketId++;
    const now = new Date().toISOString();
    const ticket = {
      id,
      ticket_number: `TICK-${Date.now().toString().slice(-6)}`,
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      subject: String(body.subject || "Desktop Support"),
      category: String(body.category || "general"),
      priority: String(body.priority || "medium"),
      status: "open",
      plan_tier: user.plan_name || "Free",
      created_at: now,
      updated_at: now,
    };
    db.tickets.push(ticket);
    const msg = {
      id: db.nextMsgId++,
      ticket_id: id,
      sender_role: "user",
      sender_name: user.name,
      message: String(body.message || ""),
      created_at: now,
    };
    db.ticketMessages.push(msg);
    saveDb();
    return sendJson(res, 200, { ok: true, ticket, message: msg });
  }

  // Fallback for unhandled /api/* calls: always return JSON, never HTML!
  return sendJson(res, 404, { error: `Desktop API route not available offline: ${urlPath}` });
}

// ─────────────────────────────────────────────────────────────────────────
// Embedded HTTP Loopback Server (Static dist/ + Desktop Backend /api/*)
// ─────────────────────────────────────────────────────────────────────────

function startLocalServer() {
  return new Promise((resolve) => {
    const distDir = path.join(__dirname, "dist");

    localServer = http.createServer(async (req, res) => {
      const origin = req.headers.origin || "*";
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Range, Accept");

      // WebCodecs & WASM multi-threading headers
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");

      const urlPath = (req.url || "/").split("?")[0];

      // 1. Intercept all /api/* routes with the embedded desktop backend
      if (urlPath.startsWith("/api/")) {
        try {
          await handleApiRequest(req, res, urlPath);
        } catch (err) {
          console.error("[Desktop API Error]:", err);
          if (!res.headersSent) sendJson(res, 500, { error: "Desktop backend error." });
        }
        return;
      }

      // 2. Serve built React SPA assets
      let safePath = path.normalize(path.join(distDir, urlPath === "/" ? "index.html" : urlPath));
      if (!safePath.startsWith(distDir)) {
        res.writeHead(403);
        res.end("Forbidden");
        return;
      }

      fs.stat(safePath, (err, stats) => {
        if (!err && stats.isFile()) {
          const ext = path.extname(safePath).toLowerCase();
          res.setHeader("Content-Type", MIME_TYPES[ext] || "application/octet-stream");
          fs.createReadStream(safePath).pipe(res);
        } else {
          const indexPath = path.join(distDir, "index.html");
          res.setHeader("Content-Type", "text/html");
          fs.createReadStream(indexPath).pipe(res);
        }
      });
    });

    // Bind dual-stack (IPv4 + IPv6) so http://localhost:<port> works on all Windows builds & Firebase OAuth
    localServer.listen(0, () => {
      const address = localServer.address();
      serverPort = typeof address === "object" && address ? address.port : 3000;
      console.log(`[AutoCut Studio] Embedded server & desktop backend running at http://localhost:${serverPort}`);
      resolve(serverPort);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Premiere Pro–Inspired Splash Loader Window
// ─────────────────────────────────────────────────────────────────────────

function createSplashScreen() {
  const iconPath = fs.existsSync(path.join(__dirname, "public", "icon.ico"))
    ? path.join(__dirname, "public", "icon.ico")
    : path.join(__dirname, "public", "pwa-512x512.png");

  splashWindow = new BrowserWindow({
    width: 560,
    height: 340,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    center: true,
    show: true,
    icon: iconPath,
    backgroundColor: "#00000000",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: transparent;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      -webkit-app-region: drag;
    }
    .frame {
      width: 536px;
      height: 316px;
      background: radial-gradient(110% 100% at 88% 12%, rgba(99, 102, 241, 0.24) 0%, rgba(11, 12, 20, 0.98) 55%),
                  linear-gradient(145deg, #141524 0%, #090A10 100%);
      border: 1px solid rgba(129, 140, 248, 0.35);
      border-radius: 14px;
      box-shadow: 0 28px 70px rgba(0, 0, 0, 0.92), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 28px 32px;
      position: relative;
      overflow: hidden;
    }
    .prism-line {
      position: absolute;
      top: -40px;
      right: 46px;
      width: 140px;
      height: 420px;
      background: linear-gradient(180deg, rgba(124, 58, 237, 0.25), rgba(245, 158, 11, 0.08));
      transform: rotate(22deg);
      border-left: 1px solid rgba(167, 139, 250, 0.3);
      pointer-events: none;
    }
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 2;
    }
    .app-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #A5B4FC;
    }
    .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #F59E0B;
      box-shadow: 0 0 8px #F59E0B;
    }
    .ver {
      font-size: 10px;
      color: #6B7280;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .hero {
      display: flex;
      align-items: center;
      gap: 18px;
      z-index: 2;
    }
    .nle-badge {
      width: 64px;
      height: 64px;
      border-radius: 12px;
      background: linear-gradient(135deg, #312E81 0%, #1E1B4B 100%);
      border: 1.5px solid #818CF8;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 28px rgba(79, 70, 229, 0.35);
      flex-shrink: 0;
    }
    .nle-badge span {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #E0E7FF 0%, #F59E0B 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .title-col h1 {
      color: #FFFFFF;
      font-size: 25px;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.1;
    }
    .title-col p {
      color: #9CA3AF;
      font-size: 12px;
      margin-top: 5px;
    }
    .timeline-preview {
      display: flex;
      flex-direction: column;
      gap: 5px;
      z-index: 2;
      margin: 4px 0;
    }
    .track {
      height: 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      gap: 4px;
      overflow: hidden;
      padding: 1px;
    }
    .clip-v { width: 42%; background: linear-gradient(90deg, #6366F1, #818CF8); border-radius: 2px; }
    .clip-v2 { width: 28%; background: linear-gradient(90deg, #4F46E5, #7C3AED); border-radius: 2px; }
    .clip-a { width: 65%; background: linear-gradient(90deg, #F59E0B, #FBBF24); border-radius: 2px; opacity: 0.85; }
    .bottom {
      z-index: 2;
    }
    .progress-rail {
      width: 100%;
      height: 3px;
      background: rgba(255, 255, 255, 0.09);
      border-radius: 99px;
      overflow: hidden;
      position: relative;
      margin-bottom: 10px;
    }
    .progress-bar {
      position: absolute;
      top: 0; left: 0; height: 100%; width: 42%;
      background: linear-gradient(90deg, #6366F1, #F59E0B);
      border-radius: 99px;
      animation: slide 1.25s cubic-bezier(0.65, 0.815, 0.735, 0.395) infinite;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      color: #D1D5DB;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .status-row .right { color: #FBBF24; }
    @keyframes slide {
      0% { left: -42%; width: 42%; }
      50% { left: 35%; width: 58%; }
      100% { left: 100%; width: 42%; }
    }
  </style>
</head>
<body>
  <div class="frame">
    <div class="prism-line"></div>
    <div class="top-bar">
      <div class="app-tag"><span class="dot"></span>AUTOCUT AI STUDIO PRO</div>
      <div class="ver">NLE ENGINE · CLOUD SYNC</div>
    </div>
    <div class="hero">
      <div class="nle-badge"><span>Ac</span></div>
      <div class="title-col">
        <h1>AutoCut AI Studio</h1>
        <p>Non-Linear AI Video Editor · WebCodecs GPU Engine</p>
      </div>
    </div>
    <div class="timeline-preview">
      <div class="track"><div class="clip-v"></div><div class="clip-v2"></div></div>
      <div class="track"><div class="clip-a"></div></div>
    </div>
    <div class="bottom">
      <div class="progress-rail"><div class="progress-bar"></div></div>
      <div class="status-row">
        <span>Loading Hardware Codecs & Cloud Workspace...</span>
        <span class="right">GPU READY</span>
      </div>
    </div>
  </div>
</body>
</html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

async function createWindow() {
  const iconPath = fs.existsSync(path.join(__dirname, "public", "icon.ico"))
    ? path.join(__dirname, "public", "icon.ico")
    : path.join(__dirname, "public", "pwa-512x512.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "AutoCut AI Studio — Professional Video Editor",
    icon: iconPath,
    backgroundColor: "#090A10",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
      webSecurity: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  let startUrl = process.env.ELECTRON_START_URL;
  if (!startUrl) {
    if (!serverPort) {
      await startLocalServer();
    }
    startUrl = `http://localhost:${serverPort}`;
  }

  mainWindow.loadURL(startUrl);

  const showMain = () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };

  mainWindow.once("ready-to-show", () => {
    setTimeout(showMain, 450);
  });

  setTimeout(showMain, 4500);

  // Allow Google / Firebase OAuth popups inside Electron; open other external URLs in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isOAuthPopup =
      url.startsWith("about:blank") ||
      url.includes("accounts.google.com") ||
      url.includes("firebaseapp.com") ||
      url.includes("googleapis.com") ||
      url.includes("localhost") ||
      url.includes("127.0.0.1");

    if (isOAuthPopup) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 660,
          autoHideMenuBar: true,
          backgroundColor: "#0B0C14",
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
          },
        },
      };
    }

    if (url.startsWith("https:") || url.startsWith("http:")) {
      shell.openExternal(url);
      return { action: "deny" };
    }

    return { action: "allow" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  createSplashScreen();
  await startLocalServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (localServer) {
    try {
      localServer.close();
    } catch (_) {}
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

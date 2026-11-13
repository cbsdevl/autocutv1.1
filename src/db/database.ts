import { eq, and, desc, asc, sql, or, gte } from 'drizzle-orm';
import { db } from './index.ts';
import {
  users,
  pricingPlans,
  userSubscriptions,
  payments,
  supportTickets,
  supportMessages,
  deviceRegistrations,
  emailVerifications,
  authAuditLogs,
  loginAttempts,
  cloudProjects,
} from './schema.ts';

// ─────────────────────────────────────────
// Typed Interfaces
// ─────────────────────────────────────────

export interface DBUser {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: "user" | "admin";
  created_at: string;
  free_ai_videos_used?: number;
  google_id?: string | null;
  avatar_url?: string | null;
  email_verified?: number;
  registration_ip?: string | null;
  registration_device_id?: string | null;
}

export interface DBPricingPlan {
  id: number;
  name: string;
  slug: string;
  price: number;
  currency: string;
  duration_days: number;
  ai_video_limit: number;
  is_active: number;
  description: string;
  updated_at: string;
}

export interface DBSubscription {
  id: number;
  user_id: number;
  plan_id: number;
  started_at: string;
  expires_at: string | null;
  ai_videos_used: number;
  is_active: number;
}

export interface UserWithSubscription extends DBUser {
  plan_slug: string;
  plan_name: string;
  plan_price: number;
  plan_currency: string;
  ai_video_limit: number;
  ai_videos_used: number;
  subscription_id: number;
  expires_at: string | null;
}

export interface CreateUserOptions {
  googleId?: string | null;
  avatarUrl?: string | null;
  emailVerified?: number;
  registrationIp?: string | null;
  registrationDeviceId?: string | null;
}

export interface DeviceCheckResult {
  isBlocked: boolean;
  reason?: string;
  existingUserId?: number;
  registeredEmail?: string;
}

export interface DBPayment {
  id: number;
  user_id: number;
  plan_id: number;
  plan_slug: string;
  plan_name: string;
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id: string;
  google_pay_token?: string;
  card_network?: string;
  card_last4?: string;
  status: string;
  created_at: string;
  user_name?: string;
  user_email?: string;
}

export interface DBSupportTicket {
  id: number;
  ticket_number: string;
  user_id: number;
  user_name: string;
  user_email: string;
  subject: string;
  category: string;
  priority: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  plan_tier: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string;
}

export interface DBSupportMessage {
  id: number;
  ticket_id: number;
  sender_role: "user" | "admin" | "system";
  sender_name: string;
  message: string;
  created_at: string;
}

// ─────────────────────────────────────────
// User Operations
// ─────────────────────────────────────────

export const getUserByEmail = async (email: string): Promise<DBUser | undefined> => {
  const rows = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = LOWER(${email.trim()})`)
    .limit(1);

  if (!rows[0]) return undefined;
  const u = rows[0];
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password: u.password,
    role: u.role as "user" | "admin",
    free_ai_videos_used: u.freeAiVideosUsed,
    google_id: u.googleId,
    avatar_url: u.avatarUrl,
    email_verified: u.emailVerified,
    registration_ip: u.registrationIp,
    registration_device_id: u.registrationDeviceId,
    created_at: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
  };
};

export const getUserByGoogleId = async (googleId: string): Promise<DBUser | undefined> => {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleId))
    .limit(1);

  if (!rows[0]) return undefined;
  const u = rows[0];
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password: u.password,
    role: u.role as "user" | "admin",
    free_ai_videos_used: u.freeAiVideosUsed,
    google_id: u.googleId,
    avatar_url: u.avatarUrl,
    email_verified: u.emailVerified,
    registration_ip: u.registrationIp,
    registration_device_id: u.registrationDeviceId,
    created_at: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
  };
};

export const getUserById = async (id: number): Promise<DBUser | undefined> => {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!rows[0]) return undefined;
  const u = rows[0];
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    password: u.password,
    role: u.role as "user" | "admin",
    free_ai_videos_used: u.freeAiVideosUsed,
    google_id: u.googleId,
    avatar_url: u.avatarUrl,
    email_verified: u.emailVerified,
    registration_ip: u.registrationIp,
    registration_device_id: u.registrationDeviceId,
    created_at: u.createdAt ? new Date(u.createdAt).toISOString() : new Date().toISOString(),
  };
};

export const getFirstAdminUser = async (): Promise<{ id: number } | undefined> => {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .orderBy(desc(sql`${users.role} = 'admin'`), desc(users.id))
    .limit(1);
  return rows[0];
};

export const getUserWithSubscription = async (userId: number): Promise<UserWithSubscription | undefined> => {
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return undefined;

  const subRows = await db
    .select({
      subId: userSubscriptions.id,
      planId: userSubscriptions.planId,
      expiresAt: userSubscriptions.expiresAt,
      aiVideosUsed: userSubscriptions.aiVideosUsed,
      isActive: userSubscriptions.isActive,
      planSlug: pricingPlans.slug,
      planName: pricingPlans.name,
      planPrice: pricingPlans.price,
      planCurrency: pricingPlans.currency,
      aiVideoLimit: pricingPlans.aiVideoLimit,
    })
    .from(userSubscriptions)
    .innerJoin(pricingPlans, eq(pricingPlans.id, userSubscriptions.planId))
    .where(and(eq(userSubscriptions.userId, userId), eq(userSubscriptions.isActive, 1)))
    .limit(1);

  let activeSub = subRows[0];

  if (!activeSub) {
    const freePlanRows = await db.select().from(pricingPlans).where(eq(pricingPlans.slug, 'free')).limit(1);
    if (freePlanRows[0]) {
      await db.insert(userSubscriptions).values({
        userId,
        planId: freePlanRows[0].id,
        aiVideosUsed: 0,
        isActive: 1,
      });
      return getUserWithSubscription(userId);
    }
  }

  if (activeSub && activeSub.expiresAt && activeSub.planSlug !== 'free') {
    const isExpired = new Date(activeSub.expiresAt).getTime() < Date.now();
    if (isExpired) {
      await db.update(userSubscriptions).set({ isActive: 0 }).where(eq(userSubscriptions.id, activeSub.subId));
      const freePlanRows = await db.select().from(pricingPlans).where(eq(pricingPlans.slug, 'free')).limit(1);
      if (freePlanRows[0]) {
        await db.insert(userSubscriptions).values({
          userId,
          planId: freePlanRows[0].id,
          aiVideosUsed: 0,
          isActive: 1,
        });
      }
      return getUserWithSubscription(userId);
    }
  }

  const isAdmin = user.role === "admin";

  const ai_videos_used = activeSub?.planSlug === 'free'
    ? user.freeAiVideosUsed
    : (activeSub?.aiVideosUsed ?? 0);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    password: user.password,
    role: user.role as "user" | "admin",
    created_at: user.createdAt ? new Date(user.createdAt).toISOString() : new Date().toISOString(),
    free_ai_videos_used: user.freeAiVideosUsed,
    google_id: user.googleId,
    avatar_url: user.avatarUrl,
    email_verified: user.emailVerified,
    registration_ip: user.registrationIp,
    registration_device_id: user.registrationDeviceId,
    plan_slug: isAdmin ? (activeSub?.planSlug === 'free' ? 'admin' : (activeSub?.planSlug || 'admin')) : (activeSub?.planSlug || 'free'),
    plan_name: isAdmin ? (activeSub?.planSlug === 'free' ? 'Admin (Unlimited)' : (activeSub?.planName || 'Admin (Unlimited)')) : (activeSub?.planName || 'Free'),
    plan_price: activeSub?.planPrice ?? 0,
    plan_currency: activeSub?.planCurrency || 'USD',
    ai_video_limit: isAdmin ? 999999 : (activeSub?.aiVideoLimit ?? 2),
    ai_videos_used,
    subscription_id: activeSub?.subId ?? 0,
    expires_at: activeSub?.expiresAt ? new Date(activeSub.expiresAt).toISOString() : null,
  };
};

export const getAllUsers = async (): Promise<UserWithSubscription[]> => {
  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const results: UserWithSubscription[] = [];
  for (const u of allUsers) {
    const full = await getUserWithSubscription(u.id);
    if (full) results.push(full);
  }
  return results;
};

export const createUser = async (
  name: string,
  email: string,
  passwordHash: string,
  options: CreateUserOptions = {}
): Promise<number> => {
  const insertUser = await db
    .insert(users)
    .values({
      name,
      email: email.toLowerCase().trim(),
      password: passwordHash,
      googleId: options.googleId || null,
      avatarUrl: options.avatarUrl || null,
      emailVerified: options.emailVerified ?? 0,
      registrationIp: options.registrationIp || null,
      registrationDeviceId: options.registrationDeviceId || null,
    })
    .returning({ id: users.id });

  const userId = insertUser[0].id;

  const freePlan = await db.select().from(pricingPlans).where(eq(pricingPlans.slug, 'free')).limit(1);
  if (freePlan[0]) {
    await db.insert(userSubscriptions).values({
      userId,
      planId: freePlan[0].id,
      aiVideosUsed: 0,
      isActive: 1,
    });
  }

  if (options.registrationIp && options.registrationDeviceId) {
    await recordDeviceRegistration(userId, options.registrationIp, options.registrationDeviceId, email);
  }

  return userId;
};

export const linkGoogleAccount = async (userId: number, googleId: string, avatarUrl?: string) => {
  if (avatarUrl) {
    await db.update(users).set({
      googleId,
      avatarUrl,
      emailVerified: 1,
    }).where(eq(users.id, userId));
  } else {
    await db.update(users).set({
      googleId,
      emailVerified: 1,
    }).where(eq(users.id, userId));
  }
};

export const updateUserRole = async (userId: number, role: "user" | "admin") => {
  await db.update(users).set({ role }).where(eq(users.id, userId));
};

export const deleteUser = async (userId: number) => {
  await db.delete(users).where(eq(users.id, userId));
};

// ── Multi-Account & Device Registration Restrictions ──

export const checkDeviceOrIpRegistration = async (
  ipAddress: string,
  deviceFingerprint: string
): Promise<DeviceCheckResult> => {
  if (deviceFingerprint && deviceFingerprint !== "server_env") {
    const existing = await db
      .select()
      .from(deviceRegistrations)
      .where(eq(deviceRegistrations.deviceFingerprint, deviceFingerprint))
      .orderBy(asc(deviceRegistrations.id))
      .limit(1);

    if (existing[0]) {
      const maskedEmail = existing[0].registeredEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3");
      return {
        isBlocked: true,
        reason: `An account (${maskedEmail}) has already been registered on this device. AutoCut AI restricts registration to 1 account per device to ensure fair system capacity and prevent trial abuse. Please sign in to your existing account.`,
        existingUserId: existing[0].userId,
        registeredEmail: existing[0].registeredEmail,
      };
    }
  }

  const isLocalhost = ipAddress === "127.0.0.1" || ipAddress === "::1" || ipAddress === "localhost";
  if (!isLocalhost && ipAddress) {
    const ipRows = await db
      .select({ count: sql<number>`count(distinct ${deviceRegistrations.registeredEmail})` })
      .from(deviceRegistrations)
      .where(eq(deviceRegistrations.ipAddress, ipAddress));

    const count = Number(ipRows[0]?.count || 0);
    if (count >= 2) {
      return {
        isBlocked: true,
        reason: `Registration limit reached for this network address (${ipAddress}). Multiple accounts from the same IP address are restricted to protect platform resources. Please sign in to your existing account.`,
      };
    }
  }

  return { isBlocked: false };
};

export const recordDeviceRegistration = async (
  userId: number,
  ipAddress: string,
  deviceFingerprint: string,
  registeredEmail: string,
  userAgent?: string
) => {
  await db.insert(deviceRegistrations).values({
    userId,
    ipAddress,
    deviceFingerprint,
    registeredEmail,
    userAgent: userAgent || "",
  });
};

// ── Email Verification Codes ──

export const saveEmailVerificationCode = async (email: string, code: string, durationMinutes = 15) => {
  await db.delete(emailVerifications).where(eq(emailVerifications.email, email.toLowerCase()));
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  await db.insert(emailVerifications).values({
    email: email.toLowerCase(),
    code,
    expiresAt,
  });
};

export const verifyEmailCode = async (email: string, code: string): Promise<boolean> => {
  const rows = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email.toLowerCase()),
        eq(emailVerifications.code, code.trim()),
        eq(emailVerifications.verified, 0)
      )
    )
    .orderBy(desc(emailVerifications.id))
    .limit(1);

  const row = rows[0];
  if (!row) return false;
  if (new Date(row.expiresAt).getTime() < Date.now()) return false;

  await db.update(emailVerifications).set({ verified: 1 }).where(eq(emailVerifications.id, row.id));
  await db.update(users).set({ emailVerified: 1 }).where(eq(users.email, email.toLowerCase()));
  return true;
};

// ── Security & Login Attempt Auditing ──

export const recordAuthAudit = async (
  eventType: string,
  data: {
    userId?: number;
    email?: string;
    ipAddress?: string;
    deviceFingerprint?: string;
    details?: string;
  }
) => {
  try {
    await db.insert(authAuditLogs).values({
      userId: data.userId || null,
      email: data.email || "",
      eventType,
      ipAddress: data.ipAddress || "",
      deviceFingerprint: data.deviceFingerprint || "",
      details: data.details || "",
    });
  } catch (e) {
    console.error("[AuthAudit] Error:", e);
  }
};

export const getRecentFailedLogins = async (email: string, ipAddress: string, windowMinutes = 15): Promise<number> => {
  const windowTime = new Date(Date.now() - windowMinutes * 60 * 1000);
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        or(eq(loginAttempts.email, email.toLowerCase()), eq(loginAttempts.ipAddress, ipAddress)),
        eq(loginAttempts.success, 0),
        gte(loginAttempts.createdAt, windowTime)
      )
    );
  return Number(rows[0]?.count || 0);
};

export const recordLoginAttempt = async (email: string, ipAddress: string, success: boolean) => {
  await db.insert(loginAttempts).values({
    email: email.toLowerCase(),
    ipAddress,
    success: success ? 1 : 0,
  });
};

// ── Subscriptions ──────────────────────

export const consumeAiVideoUsage = async (userId: number): Promise<boolean> => {
  const userSub = await getUserWithSubscription(userId);
  if (!userSub) return false;

  // Admins always have unlimited AI video generations
  if (userSub.role === "admin" || userSub.plan_slug === "admin") {
    if (userSub.subscription_id) {
      await db
        .update(userSubscriptions)
        .set({ aiVideosUsed: sql`${userSubscriptions.aiVideosUsed} + 1` })
        .where(eq(userSubscriptions.id, userSub.subscription_id));
    }
    return true;
  }

  if (userSub.plan_slug === "agency" || (userSub.ai_video_limit && userSub.ai_video_limit >= 9999)) {
    if (userSub.subscription_id) {
      await db
        .update(userSubscriptions)
        .set({ aiVideosUsed: sql`${userSubscriptions.aiVideosUsed} + 1` })
        .where(eq(userSubscriptions.id, userSub.subscription_id));
    }
    return true;
  }

  if (userSub.plan_slug === "free") {
    const limit = userSub.ai_video_limit || 2;
    if ((userSub.free_ai_videos_used || 0) >= limit) {
      return false;
    }
    await db
      .update(users)
      .set({ freeAiVideosUsed: sql`${users.freeAiVideosUsed} + 1` })
      .where(eq(users.id, userId));
    if (userSub.subscription_id) {
      await db
        .update(userSubscriptions)
        .set({ aiVideosUsed: sql`${userSubscriptions.aiVideosUsed} + 1` })
        .where(eq(userSubscriptions.id, userSub.subscription_id));
    }
    return true;
  }

  const paidLimit = userSub.ai_video_limit || 50;
  if ((userSub.ai_videos_used || 0) >= paidLimit) {
    return false;
  }

  if (userSub.subscription_id) {
    await db
      .update(userSubscriptions)
      .set({ aiVideosUsed: sql`${userSubscriptions.aiVideosUsed} + 1` })
      .where(eq(userSubscriptions.id, userSub.subscription_id));
  }
  return true;
};

export const upgradeUserPlan = async (userId: number, planSlug: string, expiresAt: string | null) => {
  const planRows = await db.select().from(pricingPlans).where(eq(pricingPlans.slug, planSlug)).limit(1);
  const plan = planRows[0];
  if (!plan) throw new Error("Plan not found");

  await db.update(userSubscriptions).set({ isActive: 0 }).where(eq(userSubscriptions.userId, userId));
  await db.insert(userSubscriptions).values({
    userId,
    planId: plan.id,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    aiVideosUsed: 0,
    isActive: 1,
  });
};

// ── Pricing Plans ──────────────────────

export const getAllPlans = async (): Promise<DBPricingPlan[]> => {
  const rows = await db
    .select()
    .from(pricingPlans)
    .where(eq(pricingPlans.isActive, 1))
    .orderBy(asc(pricingPlans.price));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    price: r.price,
    currency: r.currency,
    duration_days: r.durationDays,
    ai_video_limit: r.aiVideoLimit,
    is_active: r.isActive,
    description: r.description,
    updated_at: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
  }));
};

export const createPlan = async (data: {
  name: string;
  slug?: string;
  price: number;
  currency?: string;
  duration_days?: number;
  ai_video_limit?: number;
  description?: string;
  is_active?: number;
}): Promise<DBPricingPlan> => {
  const name = data.name.trim();
  if (!name) throw new Error("Plan name is required.");

  let slug = (data.slug || data.name).toLowerCase().trim().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (!slug) slug = `plan-${Date.now()}`;

  const existingSlug = await db.select({ id: pricingPlans.id }).from(pricingPlans).where(eq(pricingPlans.slug, slug)).limit(1);
  if (existingSlug[0]) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  const existingName = await db.select({ id: pricingPlans.id }).from(pricingPlans).where(sql`LOWER(${pricingPlans.name}) = LOWER(${name})`).limit(1);
  if (existingName[0]) {
    throw new Error(`A pricing plan with the name "${name}" already exists.`);
  }

  const inserted = await db
    .insert(pricingPlans)
    .values({
      name,
      slug,
      price: Math.max(0, Number(data.price) || 0),
      currency: (data.currency || "USD").toUpperCase(),
      durationDays: Math.max(0, parseInt(String(data.duration_days ?? 30), 10) || 0),
      aiVideoLimit: Math.max(0, parseInt(String(data.ai_video_limit ?? 10), 10) || 0),
      description: data.description?.trim() || "",
      isActive: data.is_active ?? 1,
    })
    .returning();

  const r = inserted[0];
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    price: r.price,
    currency: r.currency,
    duration_days: r.durationDays,
    ai_video_limit: r.aiVideoLimit,
    is_active: r.isActive,
    description: r.description,
    updated_at: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
  };
};

export const deletePlan = async (id: number): Promise<{ success: boolean; plan: DBPricingPlan }> => {
  const existing = await db.select().from(pricingPlans).where(eq(pricingPlans.id, id)).limit(1);
  const plan = existing[0];
  if (!plan) throw new Error("Pricing plan not found.");
  if (plan.slug === "free") throw new Error("The default Free plan cannot be deleted as it is required for user accounts.");

  const freePlanRows = await db.select().from(pricingPlans).where(eq(pricingPlans.slug, "free")).limit(1);
  const freePlanId = freePlanRows[0]?.id;

  if (freePlanId) {
    await db.update(userSubscriptions).set({ planId: freePlanId }).where(eq(userSubscriptions.planId, id));
    await db.update(payments).set({ planId: freePlanId }).where(eq(payments.planId, id));
  }

  await db.delete(pricingPlans).where(eq(pricingPlans.id, id));

  return {
    success: true,
    plan: {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      price: plan.price,
      currency: plan.currency,
      duration_days: plan.durationDays,
      ai_video_limit: plan.aiVideoLimit,
      is_active: plan.isActive,
      description: plan.description,
      updated_at: plan.updatedAt ? new Date(plan.updatedAt).toISOString() : new Date().toISOString(),
    },
  };
};

export const updatePlan = async (
  id: number,
  updates: Partial<Pick<DBPricingPlan, "price" | "currency" | "ai_video_limit" | "description" | "name" | "duration_days" | "slug" | "is_active">>
) => {
  const setValues: Record<string, any> = { updatedAt: new Date() };
  if (updates.price !== undefined) setValues.price = parseFloat(String(updates.price));
  if (updates.currency !== undefined) setValues.currency = updates.currency;
  if (updates.ai_video_limit !== undefined) setValues.aiVideoLimit = parseInt(String(updates.ai_video_limit), 10);
  if (updates.duration_days !== undefined) setValues.durationDays = parseInt(String(updates.duration_days), 10);
  if (updates.description !== undefined) setValues.description = updates.description;
  if (updates.name !== undefined) setValues.name = updates.name;
  if (updates.slug !== undefined) setValues.slug = updates.slug;
  if (updates.is_active !== undefined) setValues.isActive = updates.is_active;

  await db.update(pricingPlans).set(setValues).where(eq(pricingPlans.id, id));
};

// ── Google Pay & Payments ─────────────

export const recordPayment = async (data: {
  userId: number;
  planId: number;
  planSlug: string;
  planName: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  transactionId: string;
  googlePayToken?: string;
  cardNetwork?: string;
  cardLast4?: string;
  status?: string;
  expiresAt: string | null;
}): Promise<DBPayment> => {
  const inserted = await db
    .insert(payments)
    .values({
      userId: data.userId,
      planId: data.planId,
      planSlug: data.planSlug,
      planName: data.planName,
      amount: data.amount,
      currency: data.currency || "USD",
      paymentMethod: data.paymentMethod || "google_pay",
      transactionId: data.transactionId,
      googlePayToken: data.googlePayToken || null,
      cardNetwork: data.cardNetwork || "VISA",
      cardLast4: data.cardLast4 || "4242",
      status: data.status || "completed",
    })
    .returning();

  await upgradeUserPlan(data.userId, data.planSlug, data.expiresAt);

  const p = inserted[0];
  return {
    id: p.id,
    user_id: p.userId,
    plan_id: p.planId,
    plan_slug: p.planSlug,
    plan_name: p.planName,
    amount: p.amount,
    currency: p.currency,
    payment_method: p.paymentMethod,
    transaction_id: p.transactionId,
    google_pay_token: p.googlePayToken || undefined,
    card_network: p.cardNetwork || undefined,
    card_last4: p.cardLast4 || undefined,
    status: p.status,
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
  };
};

export const getUserPayments = async (userId: number): Promise<DBPayment[]> => {
  const rows = await db
    .select()
    .from(payments)
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt));

  return rows.map((p) => ({
    id: p.id,
    user_id: p.userId,
    plan_id: p.planId,
    plan_slug: p.planSlug,
    plan_name: p.planName,
    amount: p.amount,
    currency: p.currency,
    payment_method: p.paymentMethod,
    transaction_id: p.transactionId,
    google_pay_token: p.googlePayToken || undefined,
    card_network: p.cardNetwork || undefined,
    card_last4: p.cardLast4 || undefined,
    status: p.status,
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
  }));
};

export const getAllPayments = async (): Promise<DBPayment[]> => {
  const rows = await db
    .select({
      payment: payments,
      userName: users.name,
      userEmail: users.email,
    })
    .from(payments)
    .innerJoin(users, eq(users.id, payments.userId))
    .orderBy(desc(payments.createdAt));

  return rows.map(({ payment: p, userName, userEmail }) => ({
    id: p.id,
    user_id: p.userId,
    plan_id: p.planId,
    plan_slug: p.planSlug,
    plan_name: p.planName,
    amount: p.amount,
    currency: p.currency,
    payment_method: p.paymentMethod,
    transaction_id: p.transactionId,
    google_pay_token: p.googlePayToken || undefined,
    card_network: p.cardNetwork || undefined,
    card_last4: p.cardLast4 || undefined,
    status: p.status,
    created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
    user_name: userName,
    user_email: userEmail,
  }));
};

export const getPaymentStats = async () => {
  const totalRevResult = await db
    .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(eq(payments.status, "completed"));

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(payments)
    .where(eq(payments.status, "completed"));

  const recentPayments = (await getAllPayments()).slice(0, 15);

  return {
    totalRevenue: Number(totalRevResult[0]?.total || 0),
    totalTransactions: Number(countResult[0]?.count || 0),
    recentPayments,
  };
};

// ── Support Tickets & Messages ────────

export const createSupportTicket = async (data: {
  userId: number;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  priority?: string;
  planTier?: string;
  initialMessage: string;
}): Promise<{ ticket: DBSupportTicket; message: DBSupportMessage }> => {
  const ticketNumber = `TICK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

  const insertTicket = await db
    .insert(supportTickets)
    .values({
      ticketNumber,
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
      subject: data.subject,
      category: data.category || 'general',
      priority: data.priority || 'medium',
      status: 'open',
      planTier: data.planTier || 'free',
    })
    .returning();

  const ticketRow = insertTicket[0];

  const insertMsg = await db
    .insert(supportMessages)
    .values({
      ticketId: ticketRow.id,
      senderRole: 'user',
      senderName: data.userName,
      message: data.initialMessage,
    })
    .returning();

  const msgRow = insertMsg[0];

  const systemAck = data.category === 'billing'
    ? `Hello ${data.userName}, thank you for contacting Billing & Google Pay Support. Your ticket ${ticketNumber} has been logged in our priority payment queue. An agent will verify your transaction details and reply here shortly.`
    : `Hello ${data.userName}, thank you for contacting AutoCut AI Customer Support. Your inquiry ${ticketNumber} has been received by our technical desk. We typically review and respond within 1-2 hours.`;

  await db.insert(supportMessages).values({
    ticketId: ticketRow.id,
    senderRole: 'system',
    senderName: 'AutoCut Support Bot',
    message: systemAck,
  });

  return {
    ticket: {
      id: ticketRow.id,
      ticket_number: ticketRow.ticketNumber,
      user_id: ticketRow.userId,
      user_name: ticketRow.userName,
      user_email: ticketRow.userEmail,
      subject: ticketRow.subject,
      category: ticketRow.category,
      priority: ticketRow.priority,
      status: ticketRow.status as any,
      plan_tier: ticketRow.planTier,
      created_at: ticketRow.createdAt ? new Date(ticketRow.createdAt).toISOString() : new Date().toISOString(),
      updated_at: ticketRow.updatedAt ? new Date(ticketRow.updatedAt).toISOString() : new Date().toISOString(),
    },
    message: {
      id: msgRow.id,
      ticket_id: msgRow.ticketId,
      sender_role: msgRow.senderRole as any,
      sender_name: msgRow.senderName,
      message: msgRow.message,
      created_at: msgRow.createdAt ? new Date(msgRow.createdAt).toISOString() : new Date().toISOString(),
    },
  };
};

export const getUserTickets = async (userId: number): Promise<DBSupportTicket[]> => {
  const rows = await db
    .select({
      ticket: supportTickets,
      messageCount: sql<number>`count(${supportMessages.id})`,
    })
    .from(supportTickets)
    .leftJoin(supportMessages, eq(supportMessages.ticketId, supportTickets.id))
    .where(eq(supportTickets.userId, userId))
    .groupBy(supportTickets.id)
    .orderBy(desc(supportTickets.updatedAt));

  return rows.map(({ ticket, messageCount }) => ({
    id: ticket.id,
    ticket_number: ticket.ticketNumber,
    user_id: ticket.userId,
    user_name: ticket.userName,
    user_email: ticket.userEmail,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status as any,
    plan_tier: ticket.planTier,
    created_at: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : new Date().toISOString(),
    updated_at: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : new Date().toISOString(),
    message_count: Number(messageCount || 0),
  }));
};

export const getTicketById = async (ticketId: number): Promise<DBSupportTicket | undefined> => {
  const rows = await db.select().from(supportTickets).where(eq(supportTickets.id, ticketId)).limit(1);
  const ticket = rows[0];
  if (!ticket) return undefined;
  return {
    id: ticket.id,
    ticket_number: ticket.ticketNumber,
    user_id: ticket.userId,
    user_name: ticket.userName,
    user_email: ticket.userEmail,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status as any,
    plan_tier: ticket.planTier,
    created_at: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : new Date().toISOString(),
    updated_at: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : new Date().toISOString(),
  };
};

export const getTicketMessages = async (ticketId: number): Promise<DBSupportMessage[]> => {
  const rows = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.ticketId, ticketId))
    .orderBy(asc(supportMessages.createdAt));

  return rows.map((m) => ({
    id: m.id,
    ticket_id: m.ticketId,
    sender_role: m.senderRole as any,
    sender_name: m.senderName,
    message: m.message,
    created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
  }));
};

export const addTicketMessage = async (data: {
  ticketId: number;
  senderRole: "user" | "admin" | "system";
  senderName: string;
  message: string;
}): Promise<DBSupportMessage> => {
  const inserted = await db
    .insert(supportMessages)
    .values({
      ticketId: data.ticketId,
      senderRole: data.senderRole,
      senderName: data.senderName,
      message: data.message,
    })
    .returning();

  const m = inserted[0];

  if (data.senderRole === 'admin') {
    await db
      .update(supportTickets)
      .set({
        updatedAt: new Date(),
        status: sql`CASE WHEN ${supportTickets.status} = 'resolved' THEN 'in_progress' ELSE ${supportTickets.status} END`,
      })
      .where(eq(supportTickets.id, data.ticketId));
  } else {
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, data.ticketId));
  }

  return {
    id: m.id,
    ticket_id: m.ticketId,
    sender_role: m.senderRole as any,
    sender_name: m.senderName,
    message: m.message,
    created_at: m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString(),
  };
};

export const updateTicketStatus = async (ticketId: number, status: string, priority?: string) => {
  const updateData: Record<string, any> = { updatedAt: new Date(), status };
  if (priority) updateData.priority = priority;
  await db.update(supportTickets).set(updateData).where(eq(supportTickets.id, ticketId));
};

export const getAllSupportTickets = async (filterStatus?: string): Promise<DBSupportTicket[]> => {
  const condition = filterStatus && filterStatus !== 'all' ? eq(supportTickets.status, filterStatus) : undefined;

  const rows = await db
    .select({
      ticket: supportTickets,
      messageCount: sql<number>`count(${supportMessages.id})`,
    })
    .from(supportTickets)
    .leftJoin(supportMessages, eq(supportMessages.ticketId, supportTickets.id))
    .where(condition)
    .groupBy(supportTickets.id)
    .orderBy(desc(supportTickets.updatedAt));

  return rows.map(({ ticket, messageCount }) => ({
    id: ticket.id,
    ticket_number: ticket.ticketNumber,
    user_id: ticket.userId,
    user_name: ticket.userName,
    user_email: ticket.userEmail,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status as any,
    plan_tier: ticket.planTier,
    created_at: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : new Date().toISOString(),
    updated_at: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : new Date().toISOString(),
    message_count: Number(messageCount || 0),
  }));
};

export const getSupportStats = async () => {
  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(supportTickets);
  const openRows = await db.select({ count: sql<number>`count(*)` }).from(supportTickets).where(eq(supportTickets.status, 'open'));
  const inProgressRows = await db.select({ count: sql<number>`count(*)` }).from(supportTickets).where(eq(supportTickets.status, 'in_progress'));
  const resolvedRows = await db.select({ count: sql<number>`count(*)` }).from(supportTickets).where(or(eq(supportTickets.status, 'resolved'), eq(supportTickets.status, 'closed')));

  return {
    total: Number(totalRows[0]?.count || 0),
    open: Number(openRows[0]?.count || 0),
    inProgress: Number(inProgressRows[0]?.count || 0),
    resolved: Number(resolvedRows[0]?.count || 0),
  };
};

// ── Cloud Projects (Global Cross-Device Persistence) ──

export interface DBCloudProjectSummary {
  id: string;
  name: string;
  aspectRatio: string;
  resolution: string;
  frameRate: number;
  mediaCount: number;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DBCloudProject extends DBCloudProjectSummary {
  userId: number;
  snapshotJson: string;
}

export const upsertCloudProject = async (data: {
  userId: number;
  projectId: string;
  name: string;
  aspectRatio?: string;
  resolution?: string;
  frameRate?: number;
  mediaCount: number;
  thumbnail?: string | null;
  snapshotJson: string;
}): Promise<DBCloudProjectSummary> => {
  const now = new Date();
  const existing = await db
    .select({ id: cloudProjects.id })
    .from(cloudProjects)
    .where(and(eq(cloudProjects.userId, data.userId), eq(cloudProjects.projectId, data.projectId)))
    .limit(1);

  if (existing[0]) {
    const updated = await db
      .update(cloudProjects)
      .set({
        name: data.name,
        aspectRatio: data.aspectRatio || '16:9',
        resolution: data.resolution || '1080p',
        frameRate: data.frameRate || 30,
        mediaCount: data.mediaCount || 0,
        thumbnail: data.thumbnail ?? null,
        snapshotJson: data.snapshotJson,
        updatedAt: now,
      })
      .where(eq(cloudProjects.id, existing[0].id))
      .returning();

    const row = updated[0];
    return {
      id: row.projectId,
      name: row.name,
      aspectRatio: row.aspectRatio,
      resolution: row.resolution,
      frameRate: row.frameRate,
      mediaCount: row.mediaCount,
      thumbnail: row.thumbnail || undefined,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : now.toISOString(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : now.toISOString(),
    };
  }

  const inserted = await db
    .insert(cloudProjects)
    .values({
      userId: data.userId,
      projectId: data.projectId,
      name: data.name,
      aspectRatio: data.aspectRatio || '16:9',
      resolution: data.resolution || '1080p',
      frameRate: data.frameRate || 30,
      mediaCount: data.mediaCount || 0,
      thumbnail: data.thumbnail ?? null,
      snapshotJson: data.snapshotJson,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = inserted[0];
  return {
    id: row.projectId,
    name: row.name,
    aspectRatio: row.aspectRatio,
    resolution: row.resolution,
    frameRate: row.frameRate,
    mediaCount: row.mediaCount,
    thumbnail: row.thumbnail || undefined,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : now.toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : now.toISOString(),
  };
};

export const listCloudProjectsByUser = async (userId: number): Promise<DBCloudProjectSummary[]> => {
  const rows = await db
    .select({
      projectId: cloudProjects.projectId,
      name: cloudProjects.name,
      aspectRatio: cloudProjects.aspectRatio,
      resolution: cloudProjects.resolution,
      frameRate: cloudProjects.frameRate,
      mediaCount: cloudProjects.mediaCount,
      thumbnail: cloudProjects.thumbnail,
      createdAt: cloudProjects.createdAt,
      updatedAt: cloudProjects.updatedAt,
    })
    .from(cloudProjects)
    .where(eq(cloudProjects.userId, userId))
    .orderBy(desc(cloudProjects.updatedAt));

  return rows.map((row) => ({
    id: row.projectId,
    name: row.name,
    aspectRatio: row.aspectRatio,
    resolution: row.resolution,
    frameRate: row.frameRate,
    mediaCount: row.mediaCount,
    thumbnail: row.thumbnail || undefined,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  }));
};

export const getCloudProjectByUser = async (userId: number, projectId: string): Promise<DBCloudProject | null> => {
  const rows = await db
    .select()
    .from(cloudProjects)
    .where(and(eq(cloudProjects.userId, userId), eq(cloudProjects.projectId, projectId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.projectId,
    userId: row.userId,
    name: row.name,
    aspectRatio: row.aspectRatio,
    resolution: row.resolution,
    frameRate: row.frameRate,
    mediaCount: row.mediaCount,
    thumbnail: row.thumbnail || undefined,
    snapshotJson: row.snapshotJson,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
  };
};

export const deleteCloudProjectByUser = async (userId: number, projectId: string): Promise<void> => {
  await db
    .delete(cloudProjects)
    .where(and(eq(cloudProjects.userId, userId), eq(cloudProjects.projectId, projectId)));
};

export default db;

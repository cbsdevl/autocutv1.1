import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
} from 'drizzle-orm/pg-core';

// ── Users Table ──────────────────────────
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull().default(''),
  role: text('role').notNull().default('user'),
  freeAiVideosUsed: integer('free_ai_videos_used').notNull().default(0),
  googleId: text('google_id'),
  avatarUrl: text('avatar_url'),
  emailVerified: integer('email_verified').notNull().default(0),
  registrationIp: text('registration_ip'),
  registrationDeviceId: text('registration_device_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Pricing Plans Table ──────────────────
export const pricingPlans = pgTable('pricing_plans', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  price: doublePrecision('price').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  durationDays: integer('duration_days').notNull().default(0),
  aiVideoLimit: integer('ai_video_limit').notNull().default(2),
  isActive: integer('is_active').notNull().default(1),
  description: text('description').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── User Subscriptions Table ─────────────
export const userSubscriptions = pgTable('user_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planId: integer('plan_id')
    .notNull()
    .references(() => pricingPlans.id),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  aiVideosUsed: integer('ai_videos_used').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
});

// ── Payments Table ───────────────────────
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  planId: integer('plan_id')
    .notNull()
    .references(() => pricingPlans.id),
  planSlug: text('plan_slug').notNull(),
  planName: text('plan_name').notNull(),
  amount: doublePrecision('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  paymentMethod: text('payment_method').notNull().default('google_pay'),
  transactionId: text('transaction_id').notNull().unique(),
  googlePayToken: text('google_pay_token'),
  cardNetwork: text('card_network'),
  cardLast4: text('card_last4'),
  status: text('status').notNull().default('completed'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Support Tickets Table ────────────────
export const supportTickets = pgTable('support_tickets', {
  id: serial('id').primaryKey(),
  ticketNumber: text('ticket_number').notNull().unique(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  userName: text('user_name').notNull(),
  userEmail: text('user_email').notNull(),
  subject: text('subject').notNull(),
  category: text('category').notNull().default('general'),
  priority: text('priority').notNull().default('medium'),
  status: text('status').notNull().default('open'),
  planTier: text('plan_tier').notNull().default('free'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ── Support Messages Table ───────────────
export const supportMessages = pgTable('support_messages', {
  id: serial('id').primaryKey(),
  ticketId: integer('ticket_id')
    .notNull()
    .references(() => supportTickets.id, { onDelete: 'cascade' }),
  senderRole: text('sender_role').notNull(),
  senderName: text('sender_name').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Device Registrations Table ───────────
export const deviceRegistrations = pgTable('device_registrations', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address').notNull(),
  deviceFingerprint: text('device_fingerprint').notNull(),
  registeredEmail: text('registered_email').notNull(),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Email Verifications Table ────────────
export const emailVerifications = pgTable('email_verifications', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  code: text('code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  verified: integer('verified').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Auth Audit Logs Table ────────────────
export const authAuditLogs = pgTable('auth_audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  email: text('email'),
  eventType: text('event_type').notNull(),
  ipAddress: text('ip_address'),
  deviceFingerprint: text('device_fingerprint'),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Login Attempts Table ─────────────────
export const loginAttempts = pgTable('login_attempts', {
  id: serial('id').primaryKey(),
  email: text('email').notNull(),
  ipAddress: text('ip_address').notNull(),
  success: integer('success').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── Relations ────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(userSubscriptions),
  payments: many(payments),
  tickets: many(supportTickets),
  devices: many(deviceRegistrations),
}));

export const pricingPlansRelations = relations(pricingPlans, ({ many }) => ({
  subscriptions: many(userSubscriptions),
  payments: many(payments),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  plan: one(pricingPlans, {
    fields: [userSubscriptions.planId],
    references: [pricingPlans.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  plan: one(pricingPlans, {
    fields: [payments.planId],
    references: [pricingPlans.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one, many }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
  messages: many(supportMessages),
}));

export const supportMessagesRelations = relations(supportMessages, ({ one }) => ({
  ticket: one(supportTickets, {
    fields: [supportMessages.ticketId],
    references: [supportTickets.id],
  }),
}));

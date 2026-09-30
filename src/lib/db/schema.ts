import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const adminRole = pgEnum("admin_role", ["super_admin", "admin", "hr", "viewer"]);

export const employmentStatus = pgEnum("employment_status", [
  "active",
  "on_leave",
  "suspended",
  "left",
]);

/**
 * Stored card status. "expired" is only written when a card is superseded by a
 * renewal after its expiry; an `active` card past its expiry date is always
 * treated as expired at read time (see lib/cards/status.ts).
 */
export const cardStatus = pgEnum("card_status", [
  "active",
  "expired",
  "disabled",
  "replaced",
  "lost",
  "revoked",
]);

export const cardIssueReason = pgEnum("card_issue_reason", [
  "new",
  "renewal",
  "lost",
  "damaged",
  "details_changed",
  "role_changed",
  "photo_changed",
  "other",
]);

/** Physical orientation of a card layout. Existing cards default to portrait. */
export const cardOrientation = pgEnum("card_orientation", ["portrait", "landscape"]);

/** Layout keys must name their orientation, e.g. fxt-portrait-v1 / fxt-landscape-v2. */
const layoutChecks = (layout: AnyPgColumn, orientation: AnyPgColumn) =>
  sql`${layout} ~ '^[a-z0-9]+-(portrait|landscape)-v[0-9]+$' and position(${orientation}::text in ${layout}) > 0`;

/** Monotonic source for auto-generated employee numbers. Never reused. */
export const employeeNumberSeq = pgSequence("employee_number_seq", { startWith: 1, increment: 1 });

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

/* ------------------------------------------------------------------ */
/* Administrators & sessions                                           */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    role: adminRole("role").notNull().default("viewer"),
    passwordHash: text("password_hash").notNull(),
    active: boolean("active").notNull().default(true),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_lower_uq").on(sql`lower(${t.email})`),
    check("users_email_format_ck", sql`position('@' in ${t.email}) > 1`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the session token. The raw token only ever lives in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/* ------------------------------------------------------------------ */
/* Organisation structure                                              */
/* ------------------------------------------------------------------ */

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [uniqueIndex("departments_name_lower_uq").on(sql`lower(${t.name})`)],
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    /** Optional default department this job title belongs to. */
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("positions_name_lower_uq").on(sql`lower(${t.name})`),
    index("positions_department_idx").on(t.departmentId),
  ],
);

/* ------------------------------------------------------------------ */
/* Employees                                                           */
/* ------------------------------------------------------------------ */

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeNumber: text("employee_number").notNull(),
    fullName: text("full_name").notNull(),
    displayName: text("display_name"),
    /** Storage key of the current photo (never a public URL). */
    photoKey: text("photo_key"),
    photoUpdatedAt: timestamp("photo_updated_at", { withTimezone: true }),
    email: text("email"),
    phone: text("phone"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "restrict" }),
    positionId: uuid("position_id").references(() => positions.id, { onDelete: "restrict" }),
    employmentStatus: employmentStatus("employment_status").notNull().default("active"),
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes"),
    /** Demo/seed records are flagged so they can never be mistaken for real staff. */
    isDemo: boolean("is_demo").notNull().default(false),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("employees_number_upper_uq").on(sql`upper(${t.employeeNumber})`),
    index("employees_full_name_idx").on(sql`lower(${t.fullName})`),
    index("employees_department_idx").on(t.departmentId),
    index("employees_position_idx").on(t.positionId),
    index("employees_status_idx").on(t.employmentStatus),
    index("employees_created_idx").on(t.createdAt),
    check("employees_number_format_ck", sql`${t.employeeNumber} ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'`),
    check("employees_full_name_ck", sql`length(trim(${t.fullName})) between 2 and 120`),
    check(
      "employees_dates_ck",
      sql`${t.endDate} is null or ${t.startDate} is null or ${t.endDate} >= ${t.startDate}`,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* Card templates                                                      */
/* ------------------------------------------------------------------ */

export const cardTemplates = pgTable(
  "card_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    /** Renderer layout key, e.g. "fxt-portrait-v1". Must exist in lib/cards/templates. */
    layout: text("layout").notNull(),
    /** Derived from the layout; stored for querying/display and checked for consistency. */
    orientation: cardOrientation("orientation").notNull().default("portrait"),
    /** Layout options (banner text, accent, etc.) validated by cardTemplateConfigSchema. */
    config: jsonb("config").notNull().default({}),
    isDefault: boolean("is_default").notNull().default(false),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("card_templates_slug_uq").on(t.slug),
    uniqueIndex("card_templates_single_default_uq").on(t.isDefault).where(sql`${t.isDefault} = true`),
    check("card_templates_layout_ck", layoutChecks(t.layout, t.orientation)),
  ],
);

/* ------------------------------------------------------------------ */
/* Employee cards (full history retained)                              */
/* ------------------------------------------------------------------ */

export type CardSnapshot = {
  employeeNumber: string;
  fullName: string;
  displayName: string | null;
  positionName: string | null;
  departmentName: string | null;
  photoKey: string | null;
  /** Template options in effect when the card was issued (reprints stay identical). */
  templateConfig?: Record<string, unknown>;
};

export const employeeCards = pgTable(
  "employee_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    cardNumber: text("card_number").notNull(),
    /** 128-bit URL-safe random token used in the QR verification URL. */
    verificationToken: text("verification_token").notNull(),
    templateId: uuid("template_id").references(() => cardTemplates.id, { onDelete: "set null" }),
    /**
     * Layout + orientation captured at issue time (immutable). Cards issued before
     * orientation support default to the original portrait layout.
     */
    layout: text("layout").notNull().default("fxt-portrait-v1"),
    orientation: cardOrientation("orientation").notNull().default("portrait"),
    version: integer("version").notNull(),
    issuedAt: date("issued_at", { mode: "string" }).notNull(),
    expiresAt: date("expires_at", { mode: "string" }).notNull(),
    status: cardStatus("status").notNull().default("active"),
    issueReason: cardIssueReason("issue_reason").notNull().default("new"),
    issueNote: text("issue_note"),
    /** Details printed on the card at the moment of issue. */
    snapshot: jsonb("snapshot").$type<CardSnapshot>().notNull(),
    issuedBy: uuid("issued_by").references(() => users.id, { onDelete: "set null" }),
    /** The card this one superseded (if any). */
    replacedCardId: uuid("replaced_card_id").references((): AnyPgColumn => employeeCards.id, {
      onDelete: "set null",
    }),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    statusChangedBy: uuid("status_changed_by").references(() => users.id, { onDelete: "set null" }),
    statusReason: text("status_reason"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("employee_cards_number_uq").on(t.cardNumber),
    uniqueIndex("employee_cards_token_uq").on(t.verificationToken),
    uniqueIndex("employee_cards_employee_version_uq").on(t.employeeId, t.version),
    /** At most one active card per employee. */
    uniqueIndex("employee_cards_one_active_uq").on(t.employeeId).where(sql`${t.status} = 'active'`),
    index("employee_cards_employee_idx").on(t.employeeId),
    index("employee_cards_expires_idx").on(t.expiresAt),
    index("employee_cards_status_idx").on(t.status),
    check("employee_cards_dates_ck", sql`${t.expiresAt} > ${t.issuedAt}`),
    check("employee_cards_version_ck", sql`${t.version} >= 1`),
    check("employee_cards_token_ck", sql`length(${t.verificationToken}) >= 22`),
    check("employee_cards_layout_ck", layoutChecks(t.layout, t.orientation)),
  ],
);

/* ------------------------------------------------------------------ */
/* Settings, audit & verification log                                  */
/* ------------------------------------------------------------------ */

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** Snapshot so the log stays readable if the admin account is later removed. */
    actorEmail: text("actor_email"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary"),
    metadata: jsonb("metadata").notNull().default({}),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_created_idx").on(t.createdAt),
    index("audit_logs_entity_idx").on(t.entityType, t.entityId),
    index("audit_logs_actor_idx").on(t.actorId),
  ],
);

export const verificationEvents = pgTable(
  "verification_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cardId: uuid("card_id").references(() => employeeCards.id, { onDelete: "cascade" }),
    /** Outcome shown to the person scanning: valid / expired / invalid / not_found. */
    result: text("result").notNull(),
    /** Short random reference printed on the verification page. */
    reference: text("reference").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("verification_events_card_idx").on(t.cardId),
    index("verification_events_created_idx").on(t.createdAt),
  ],
);

/**
 * Fixed-window rate-limit counters shared by all server instances (serverless-safe).
 * Keys are SHA-256 hashes of "<scope>:<subject>" so no raw IPs or emails are stored.
 */
export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("rate_limit_buckets_reset_idx").on(t.resetAt), check("rate_limit_buckets_count_ck", sql`${t.count} >= 0`)],
);

CREATE TYPE "public"."admin_role" AS ENUM('super_admin', 'admin', 'hr', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."card_issue_reason" AS ENUM('new', 'renewal', 'lost', 'damaged', 'details_changed', 'role_changed', 'photo_changed', 'other');--> statement-breakpoint
CREATE TYPE "public"."card_status" AS ENUM('active', 'expired', 'disabled', 'replaced', 'lost', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."employment_status" AS ENUM('active', 'on_leave', 'suspended', 'left');--> statement-breakpoint
CREATE SEQUENCE "public"."employee_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"layout" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"card_number" text NOT NULL,
	"verification_token" text NOT NULL,
	"template_id" uuid,
	"version" integer NOT NULL,
	"issued_at" date NOT NULL,
	"expires_at" date NOT NULL,
	"status" "card_status" DEFAULT 'active' NOT NULL,
	"issue_reason" "card_issue_reason" DEFAULT 'new' NOT NULL,
	"issue_note" text,
	"snapshot" jsonb NOT NULL,
	"issued_by" uuid,
	"replaced_card_id" uuid,
	"status_changed_at" timestamp with time zone,
	"status_changed_by" uuid,
	"status_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_cards_dates_ck" CHECK ("employee_cards"."expires_at" > "employee_cards"."issued_at"),
	CONSTRAINT "employee_cards_version_ck" CHECK ("employee_cards"."version" >= 1),
	CONSTRAINT "employee_cards_token_ck" CHECK (length("employee_cards"."verification_token") >= 22)
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_number" text NOT NULL,
	"full_name" text NOT NULL,
	"display_name" text,
	"photo_key" text,
	"photo_updated_at" timestamp with time zone,
	"email" text,
	"phone" text,
	"department_id" uuid,
	"position_id" uuid,
	"employment_status" "employment_status" DEFAULT 'active' NOT NULL,
	"start_date" date,
	"end_date" date,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"updated_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_number_format_ck" CHECK ("employees"."employee_number" ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
	CONSTRAINT "employees_full_name_ck" CHECK (length(trim("employees"."full_name")) between 2 and 120),
	CONSTRAINT "employees_dates_ck" CHECK ("employees"."end_date" is null or "employees"."start_date" is null or "employees"."end_date" >= "employees"."start_date")
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"department_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"full_name" text NOT NULL,
	"role" "admin_role" DEFAULT 'viewer' NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"password_changed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_format_ck" CHECK (position('@' in "users"."email") > 1)
);
--> statement-breakpoint
CREATE TABLE "verification_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"card_id" uuid,
	"result" text NOT NULL,
	"reference" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_template_id_card_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."card_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_issued_by_users_id_fk" FOREIGN KEY ("issued_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_replaced_card_id_employee_cards_id_fk" FOREIGN KEY ("replaced_card_id") REFERENCES "public"."employee_cards"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_status_changed_by_users_id_fk" FOREIGN KEY ("status_changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_events" ADD CONSTRAINT "verification_events_card_id_employee_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."employee_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "card_templates_slug_uq" ON "card_templates" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "card_templates_single_default_uq" ON "card_templates" USING btree ("is_default") WHERE "card_templates"."is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "departments_name_lower_uq" ON "departments" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "employee_cards_number_uq" ON "employee_cards" USING btree ("card_number");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_cards_token_uq" ON "employee_cards" USING btree ("verification_token");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_cards_employee_version_uq" ON "employee_cards" USING btree ("employee_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_cards_one_active_uq" ON "employee_cards" USING btree ("employee_id") WHERE "employee_cards"."status" = 'active';--> statement-breakpoint
CREATE INDEX "employee_cards_employee_idx" ON "employee_cards" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_cards_expires_idx" ON "employee_cards" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "employee_cards_status_idx" ON "employee_cards" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_number_upper_uq" ON "employees" USING btree (upper("employee_number"));--> statement-breakpoint
CREATE INDEX "employees_full_name_idx" ON "employees" USING btree (lower("full_name"));--> statement-breakpoint
CREATE INDEX "employees_department_idx" ON "employees" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "employees_position_idx" ON "employees" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("employment_status");--> statement-breakpoint
CREATE INDEX "employees_created_idx" ON "employees" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_name_lower_uq" ON "positions" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "positions_department_idx" ON "positions" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verification_events_card_idx" ON "verification_events" USING btree ("card_id");--> statement-breakpoint
CREATE INDEX "verification_events_created_idx" ON "verification_events" USING btree ("created_at");
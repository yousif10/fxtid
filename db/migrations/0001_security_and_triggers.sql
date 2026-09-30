-- Keep updated_at accurate regardless of which code path writes a row.
CREATE OR REPLACE FUNCTION fxt_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION fxt_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER departments_set_updated_at BEFORE UPDATE ON "departments" FOR EACH ROW EXECUTE FUNCTION fxt_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER positions_set_updated_at BEFORE UPDATE ON "positions" FOR EACH ROW EXECUTE FUNCTION fxt_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER employees_set_updated_at BEFORE UPDATE ON "employees" FOR EACH ROW EXECUTE FUNCTION fxt_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER card_templates_set_updated_at BEFORE UPDATE ON "card_templates" FOR EACH ROW EXECUTE FUNCTION fxt_set_updated_at();
--> statement-breakpoint
CREATE TRIGGER employee_cards_set_updated_at BEFORE UPDATE ON "employee_cards" FOR EACH ROW EXECUTE FUNCTION fxt_set_updated_at();
--> statement-breakpoint

-- Card history is immutable in the fields that identify a physical card.
CREATE OR REPLACE FUNCTION fxt_protect_card_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.card_number IS DISTINCT FROM OLD.card_number
     OR NEW.verification_token IS DISTINCT FROM OLD.verification_token
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot THEN
    RAISE EXCEPTION 'Issued card identity fields are immutable (card %)', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  -- A card that has been replaced/lost/revoked can never become active again.
  IF OLD.status IN ('replaced', 'lost', 'revoked', 'expired') AND NEW.status = 'active' THEN
    RAISE EXCEPTION 'Card % cannot be reactivated from status %', OLD.id, OLD.status
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER employee_cards_protect_identity BEFORE UPDATE ON "employee_cards" FOR EACH ROW EXECUTE FUNCTION fxt_protect_card_identity();
--> statement-breakpoint

-- Audit log is append-only.
CREATE OR REPLACE FUNCTION fxt_audit_append_only() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON "audit_logs" FOR EACH ROW EXECUTE FUNCTION fxt_audit_append_only();
--> statement-breakpoint

-- Row Level Security: deny-by-default for every role except the table owner.
-- The application connects as the owner (server-side only). If this database is
-- hosted on Supabase, this prevents the auto-generated Data API (anon /
-- authenticated roles) from reading or writing any table directly. Public card
-- verification is served exclusively by the application's server route.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "departments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "positions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employees" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "card_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "employee_cards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "system_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "verification_events" ENABLE ROW LEVEL SECURITY;

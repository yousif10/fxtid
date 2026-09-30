CREATE TYPE "public"."card_orientation" AS ENUM('portrait', 'landscape');--> statement-breakpoint
ALTER TABLE "card_templates" ADD COLUMN "orientation" "card_orientation" DEFAULT 'portrait' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD COLUMN "layout" text DEFAULT 'fxt-portrait-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_cards" ADD COLUMN "orientation" "card_orientation" DEFAULT 'portrait' NOT NULL;--> statement-breakpoint
ALTER TABLE "card_templates" ADD CONSTRAINT "card_templates_layout_ck" CHECK ("card_templates"."layout" ~ '^[a-z0-9]+-(portrait|landscape)-v[0-9]+$' and position("card_templates"."orientation"::text in "card_templates"."layout") > 0);--> statement-breakpoint
ALTER TABLE "employee_cards" ADD CONSTRAINT "employee_cards_layout_ck" CHECK ("employee_cards"."layout" ~ '^[a-z0-9]+-(portrait|landscape)-v[0-9]+$' and position("employee_cards"."orientation"::text in "employee_cards"."layout") > 0);--> statement-breakpoint
-- An issued card's layout and orientation are part of its printed identity: immutable.
CREATE OR REPLACE FUNCTION fxt_protect_card_identity() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.card_number IS DISTINCT FROM OLD.card_number
     OR NEW.verification_token IS DISTINCT FROM OLD.verification_token
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.snapshot IS DISTINCT FROM OLD.snapshot
     OR NEW.layout IS DISTINCT FROM OLD.layout
     OR NEW.orientation IS DISTINCT FROM OLD.orientation THEN
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

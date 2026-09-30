import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { SettingsForms } from "@/components/admin/settings-forms";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePagePermission("settings:read");
  const settings = await getSettings();
  const canEdit = can(user.role, "settings:manage");
  return (
    <>
      <PageHeader
        eyebrow="System"
        title="Settings"
        description={canEdit ? "Company details, card numbering and branding." : "Read-only - only a Super Admin can change settings."}
        actions={
          can(user.role, "users:manage") ? (
            <LinkButton href="/settings/users" variant="outline">
              <ShieldCheck /> Administrators
            </LinkButton>
          ) : null
        }
      />
      <SettingsForms settings={settings} canEdit={canEdit} />
    </>
  );
}

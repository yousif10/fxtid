import { AdminShell } from "@/components/admin/admin-shell";
import { requireUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { logoutAction } from "../(auth)/login/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  return (
    <AdminShell user={{ fullName: user.fullName, email: user.email, role: user.role }} companyName={settings.company.displayName} logoutAction={logoutAction}>
      {children}
    </AdminShell>
  );
}

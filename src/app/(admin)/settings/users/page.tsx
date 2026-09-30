import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { UserManager } from "@/components/admin/user-manager";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/misc";
import { requirePagePermission } from "@/lib/auth/session";
import { formatRelative } from "@/lib/dates";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ADMIN_ROLES } from "@/lib/permissions";

export const metadata: Metadata = { title: "Administrators" };

export default async function UsersPage() {
  const me = await requirePagePermission("users:manage");
  const rows = await db
    .select({ id: users.id, email: users.email, fullName: users.fullName, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt })
    .from(users)
    .orderBy(asc(users.fullName));
  return (
    <>
      <PageHeader eyebrow="Settings" title="Administrators" description="Accounts that can sign in to the ID card system. Permissions are enforced on the server for every action." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <UserManager users={rows.map((r) => ({ ...r, lastLoginAt: r.lastLoginAt ? formatRelative(r.lastLoginAt) : null, isSelf: r.id === me.id }))} />
        </Card>
        <Card className="h-fit p-5">
          <h2 className="font-semibold">Roles</h2>
          <dl className="mt-3 space-y-3 text-sm">
            {ADMIN_ROLES.map((r) => (
              <div key={r}>
                <dt className="font-semibold">{ROLE_LABELS[r]}</dt>
                <dd className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}

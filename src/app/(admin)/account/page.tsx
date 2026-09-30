import type { Metadata } from "next";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DescriptionList, PageHeader } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/permissions";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "My account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader eyebrow="Account" title="My account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody>
            <DescriptionList
              items={[
                { label: "Name", value: user.fullName },
                { label: "Email", value: user.email },
                { label: "Role", value: ROLE_LABELS[user.role] },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Change password" description="Other signed-in sessions will be signed out." />
          <CardBody>
            <ChangePasswordForm />
          </CardBody>
        </Card>
      </div>
    </>
  );
}

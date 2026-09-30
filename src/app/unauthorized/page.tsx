import type { Metadata } from "next";
import { StatusPage } from "@/components/admin/status-page";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied" };

export default function UnauthorizedPage() {
  return (
    <StatusPage code="403 · Access denied" title="You don't have permission" description="Your administrator role does not allow access to this page. Ask a Super Admin if you need access.">
      <LinkButton href="/dashboard">Back to dashboard</LinkButton>
    </StatusPage>
  );
}

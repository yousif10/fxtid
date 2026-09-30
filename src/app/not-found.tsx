import { StatusPage } from "@/components/admin/status-page";
import { LinkButton } from "@/components/ui/button";

export default function NotFound() {
  return (
    <StatusPage code="404" title="Page not found" description="The page you were looking for does not exist or may have been moved.">
      <LinkButton href="/dashboard">Go to dashboard</LinkButton>
    </StatusPage>
  );
}

import { StatusPage } from "@/components/admin/status-page";

export default function VerifyNotFound() {
  return <StatusPage code="Verification" title="Card not recognised" description="This verification link does not match any card issued by Fast Express Transport. Do not accept the card." />;
}

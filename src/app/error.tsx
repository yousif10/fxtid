"use client";

import { useEffect } from "react";
import { StatusPage } from "@/components/admin/status-page";
import { Button, LinkButton } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <StatusPage code="Error" title="Something went wrong" description={`An unexpected error occurred. Please try again.${error.digest ? ` Reference: ${error.digest}` : ""}`}>
      <Button onClick={reset}>Try again</Button>
      <LinkButton href="/dashboard" variant="outline">
        Dashboard
      </LinkButton>
    </StatusPage>
  );
}

import type { ReactNode } from "react";
import { FxtLogo } from "./brand";

/** Full-screen branded status page (404, 403, errors). */
export function StatusPage({ code, title, description, children }: { code: string; title: string; description: string; children?: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <FxtLogo className="h-20" />
      <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-accent">{code}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-3 max-w-md text-muted-foreground">{description}</p>
      {children ? <div className="mt-8 flex flex-wrap justify-center gap-3">{children}</div> : null}
    </main>
  );
}

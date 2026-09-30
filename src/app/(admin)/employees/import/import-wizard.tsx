"use client";

import { useRef, useState, startTransition, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/form";
import { commitImportAction, previewImportAction } from "./actions";

const SAMPLE = `employee_number,full_name,display_name,department,position,email,phone,start_date,employment_status
,Jane Example,,Operations,Transport Planner,jane.example@example.invalid,07000 000000,2026-01-05,active
`;

export function ImportWizard({ columns }: { columns: string[] }) {
  const router = useRouter();
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [preview, runPreview, previewing] = useActionState(previewImportAction, null);
  const [commit, runCommit, committing] = useActionState(commitImportAction, null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fd = () => {
    const f = new FormData();
    f.set("csv", csv ?? "");
    if (createMissing) f.set("createMissing", "on");
    return f;
  };

  useEffect(() => {
    if (preview && !preview.ok) toast.error(preview.message);
  }, [preview]);
  useEffect(() => {
    if (!commit) return;
    if (commit.ok) {
      toast.success(commit.message);
      router.push("/employees?sort=created&dir=desc");
    } else toast.error(commit.message);
  }, [commit, router]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("CSV file is too large (max 2 MB).");
    const text = await file.text();
    setCsv(text);
    setFileName(file.name);
    const f = new FormData();
    f.set("csv", text);
    if (createMissing) f.set("createMissing", "on");
    startTransition(() => runPreview(f));
  };

  const p = preview?.ok ? preview.data : null;
  const blocking = p?.headerErrors.filter((e) => !e.startsWith("Unknown column")) ?? [];
  const canImport = p && p.errorCount === 0 && blocking.length === 0 && p.rows.length > 0;
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`;

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader title="1. Upload file" />
        <CardBody className="space-y-4">
          <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" id="csv-file" onChange={(e) => onFile(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-8 text-center hover:border-ring hover:bg-muted/40"
          >
            <FileSpreadsheet className="size-8 text-muted-foreground" />
            <span className="text-sm font-semibold">{fileName ?? "Choose CSV file"}</span>
            <span className="text-xs text-muted-foreground">UTF-8 CSV, max 2,000 rows</span>
          </button>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={createMissing}
              onChange={(e) => {
                setCreateMissing(e.target.checked);
                if (csv) {
                  const f = new FormData();
                  f.set("csv", csv);
                  if (e.target.checked) f.set("createMissing", "on");
                  startTransition(() => runPreview(f));
                }
              }}
              className="mt-0.5"
            />
            Create departments and positions that don&apos;t exist yet
          </label>
          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Columns</p>
            <p className="mt-1 font-mono">{columns.join(", ")}</p>
            <p className="mt-2">
              Only <span className="font-mono">full_name</span> is required. Leave <span className="font-mono">employee_number</span> blank to auto-assign. Dates as YYYY-MM-DD.
            </p>
          </div>
          <a href={templateHref} download="fxt-employee-import-template.csv" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline dark:text-ring">
            <Download className="size-4" /> Download template
          </a>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="2. Review"
          description={p ? `${p.rows.length} rows · ${p.validCount} valid · ${p.errorCount} with errors` : "Upload a file to validate it."}
          actions={
            <Button onClick={() => startTransition(() => runCommit(fd()))} disabled={!canImport || committing}>
              {committing ? <Loader2 className="animate-spin" /> : <Upload />} Import {p?.validCount ?? ""} employees
            </Button>
          }
        />
        {previewing ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Validating…
          </div>
        ) : p ? (
          <div>
            {p.headerErrors.length ? (
              <div className="space-y-1 border-b border-border bg-warning-soft px-5 py-3 text-sm text-warning">
                {p.headerErrors.map((e) => (
                  <p key={e}>{e}</p>
                ))}
              </div>
            ) : null}
            {canImport ? (
              <div className="flex items-center gap-2 border-b border-border bg-success-soft px-5 py-3 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" /> All rows are valid and ready to import.
              </div>
            ) : p.errorCount ? (
              <div className="flex items-center gap-2 border-b border-border bg-danger-soft px-5 py-3 text-sm font-medium text-danger">
                <AlertTriangle className="size-4" /> Fix the {p.errorCount} row(s) with errors and upload the file again. Nothing has been saved.
              </div>
            ) : null}
            <div className="relative max-h-[60vh] overflow-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 border-b border-border bg-card text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-5 py-2.5">Line</th>
                    <th scope="col" className="px-3 py-2.5">Name</th>
                    <th scope="col" className="px-3 py-2.5">Employee ID</th>
                    <th scope="col" className="px-3 py-2.5">Department / position</th>
                    <th scope="col" className="px-3 py-2.5">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {p.rows.map((r) => (
                    <tr key={r.line} className={r.errors.length ? "bg-danger-soft/40" : undefined}>
                      <td className="px-5 py-2.5 tabular-nums text-muted-foreground">{r.line}</td>
                      <td className="px-3 py-2.5 font-medium">{r.data.full_name ?? "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.data.employee_number ?? <span className="text-muted-foreground">auto</span>}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{[r.data.department, r.data.position].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-2.5">
                        {r.errors.length ? (
                          <ul className="space-y-0.5 text-xs text-danger">
                            {r.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge tone="success">OK</Badge>
                            {r.warnings.map((w) => (
                              <span key={w} className="text-xs text-warning">
                                {w}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">No file selected.</div>
        )}
      </Card>
    </div>
  );
}

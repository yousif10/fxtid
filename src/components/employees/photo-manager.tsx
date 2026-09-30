"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area } from "react-easy-crop";
import { Camera, Loader2, Trash2, Upload, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { removePhotoAction, uploadPhotoAction } from "@/app/(admin)/employees/actions";
import { preparePhotoForUpload, UPLOAD_PAYLOAD_LIMIT } from "@/lib/client/prepare-photo";
import { EmployeeAvatar } from "./employee-avatar";

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export function PhotoManager({
  employeeId,
  name,
  hasPhoto,
  version,
  canEdit,
}: {
  employeeId: string;
  name: string;
  hasPhoto: boolean;
  version: Date | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return toast.error("Choose a JPG, PNG or WEBP image.");
    if (f.size > MAX_BYTES) return toast.error("Photo must be 8 MB or smaller.");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  };

  const onCropComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const close = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const save = () => {
    if (!file) return;
    startTransition(async () => {
      // Crop + downscale in the browser so the request fits serverless body limits;
      // the server re-validates and re-encodes whatever it receives.
      const prepared = await preparePhotoForUpload(file, area);
      if (prepared.file.size > UPLOAD_PAYLOAD_LIMIT) {
        toast.error("This photo is too large to upload. Please choose a smaller image.");
        return;
      }
      const fd = new FormData();
      fd.set("id", employeeId);
      fd.set("photo", prepared.file);
      if (area && !prepared.cropApplied) fd.set("crop", JSON.stringify(area));
      const res = await uploadPhotoAction(fd);
      if (res?.ok) {
        toast.success(res.message);
        close();
        router.refresh();
      } else toast.error(res?.message ?? "Upload failed.");
    });
  };

  const remove = () =>
    startTransition(async () => {
      const res = await removePhotoAction(employeeId);
      setConfirmRemove(false);
      if (res?.ok) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res?.message ?? "Could not remove photo.");
    });

  return (
    <div className="flex flex-col items-center">
      <EmployeeAvatar employeeId={employeeId} name={name} hasPhoto={hasPhoto} version={version} size="xl" />
      {canEdit ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id={`photo-${employeeId}`}
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {hasPhoto ? <Camera /> : <Upload />} {hasPhoto ? "Replace photo" : "Upload photo"}
          </Button>
          {hasPhoto ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(true)} aria-label="Remove photo">
              <Trash2 />
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 max-w-[15rem] text-center text-xs text-muted-foreground">
        Passport-style, plain background, face clearly visible. JPG/PNG/WEBP up to 8 MB.
      </p>

      <Dialog open={!!preview} onClose={close} title="Position photo" description="Drag to reposition and zoom to frame the head and shoulders. The photo is not retouched." size="lg">
        <div className="relative h-[min(60vh,420px)] overflow-hidden rounded-xl bg-[#0b1220]">
          {preview ? (
            <Cropper
              image={preview}
              crop={crop}
              zoom={zoom}
              aspect={3 / 4}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              objectFit="contain"
              showGrid
              restrictPosition
            />
          ) : null}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <ZoomIn className="size-4 text-muted-foreground" aria-hidden />
          <label htmlFor="photo-zoom" className="sr-only">
            Zoom
          </label>
          <input id="photo-zoom" type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !area}>
            {pending ? <Loader2 className="animate-spin" /> : null} Save photo
          </Button>
        </div>
      </Dialog>

      <Dialog open={confirmRemove} onClose={() => setConfirmRemove(false)} title="Remove photo?" description="Cards already issued keep the photo they were printed with." size="sm">
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmRemove(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={remove} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null} Remove
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

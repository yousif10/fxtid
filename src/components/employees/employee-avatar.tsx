/* eslint-disable @next/next/no-img-element -- photos are served by an authenticated route, which next/image cannot fetch */
import { cn, initials } from "@/lib/utils";

const SIZES = {
  sm: "size-9 text-xs rounded-lg",
  md: "size-11 text-sm rounded-xl",
  lg: "size-16 text-lg rounded-2xl",
  xl: "w-36 h-48 text-3xl rounded-2xl",
} as const;

export function EmployeeAvatar({
  employeeId,
  name,
  hasPhoto,
  version,
  size = "md",
  className,
}: {
  employeeId: string;
  name: string;
  hasPhoto: boolean;
  version?: Date | string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const v = version ? new Date(version).getTime() : 0;
  const variant = size === "xl" ? "full" : "thumb";
  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-info-soft font-semibold text-primary ring-1 ring-border dark:text-ring",
        SIZES[size],
        className,
      )}
    >
      {hasPhoto ? (
        <img
          src={`/api/employees/${employeeId}/photo?variant=${variant}&v=${v}`}
          alt={`Photo of ${name}`}
          className="size-full object-cover"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="grid size-full place-items-center" aria-label={`No photo for ${name}`}>
          {initials(name)}
        </span>
      )}
    </div>
  );
}

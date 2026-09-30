// Role -> permission matrix. This file is safe to import on the client (for
// showing/hiding controls) but every mutation re-checks on the server via
// requirePermission() in lib/auth/session.ts.

export const ADMIN_ROLES = ["super_admin", "admin", "hr", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR / Employee Manager",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  super_admin: "Full access, including administrator accounts and system settings.",
  admin: "Manage employees, cards, departments, positions and templates.",
  hr: "Add and edit employees, upload photos and issue cards.",
  viewer: "Read-only access to employees and cards.",
};

export type Permission =
  | "employees:read"
  | "employees:write"
  | "employees:delete"
  | "employees:import"
  | "employees:set_number" // manually define / change employee numbers
  | "cards:read"
  | "cards:issue"
  | "cards:manage" // disable / mark lost / revoke / reactivate
  | "catalog:manage" // departments & positions
  | "templates:manage"
  | "audit:read"
  | "settings:read"
  | "settings:manage"
  | "users:manage";

const ALL: Permission[] = [
  "employees:read",
  "employees:write",
  "employees:delete",
  "employees:import",
  "employees:set_number",
  "cards:read",
  "cards:issue",
  "cards:manage",
  "catalog:manage",
  "templates:manage",
  "audit:read",
  "settings:read",
  "settings:manage",
  "users:manage",
];

const MATRIX: Record<AdminRole, ReadonlySet<Permission>> = {
  super_admin: new Set(ALL),
  admin: new Set<Permission>([
    "employees:read",
    "employees:write",
    "employees:delete",
    "employees:import",
    "employees:set_number",
    "cards:read",
    "cards:issue",
    "cards:manage",
    "catalog:manage",
    "templates:manage",
    "audit:read",
    "settings:read",
  ]),
  hr: new Set<Permission>(["employees:read", "employees:write", "employees:import", "cards:read", "cards:issue"]),
  viewer: new Set<Permission>(["employees:read", "cards:read"]),
};

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role]?.has(permission) ?? false;
}

export function isAdminRole(v: unknown): v is AdminRole {
  return typeof v === "string" && (ADMIN_ROLES as readonly string[]).includes(v);
}

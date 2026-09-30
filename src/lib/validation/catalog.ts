import { z } from "zod";
import { checkbox, optionalString, optionalUuid } from "./common";

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Enter a department name").max(80),
  description: optionalString(300),
  active: checkbox,
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const positionSchema = z.object({
  name: z.string().trim().min(2, "Enter a job title").max(80),
  description: optionalString(300),
  departmentId: optionalUuid,
  active: checkbox,
});
export type PositionInput = z.infer<typeof positionSchema>;

import { z } from "zod";

export const DiningTableShapeSchema = z.enum(["SQUARE", "RECTANGLE", "CIRCLE", "VIP"]);
export const DiningTableStatusSchema = z.enum([
  "AVAILABLE",
  "OCCUPIED",
  "RESERVED",
  "SOON_OCCUPIED",
]);

export const DiningTableInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  seats: z.number().int().min(1).max(99),
  shape: DiningTableShapeSchema.default("RECTANGLE"),
  description: z.string().trim().max(280).optional().default(""),
  posX: z.number().min(0).max(1).optional(),
  posY: z.number().min(0).max(1).optional(),
  width: z.number().min(0.06).max(0.5).optional(),
  height: z.number().min(0.06).max(0.5).optional(),
  status: DiningTableStatusSchema.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export const DiningTablePatchSchema = DiningTableInputSchema.partial();

export const DiningTableLayoutItemSchema = z.object({
  id: z.number().int().positive(),
  posX: z.number().min(0).max(1),
  posY: z.number().min(0).max(1),
  width: z.number().min(0.06).max(0.5),
  height: z.number().min(0.06).max(0.5),
});

export const DiningTableLayoutPatchSchema = z.object({
  tables: z.array(DiningTableLayoutItemSchema).max(80),
});

export type DiningTableShape = z.infer<typeof DiningTableShapeSchema>;
export type DiningTableStatus = z.infer<typeof DiningTableStatusSchema>;
export type DiningTableInput = z.infer<typeof DiningTableInputSchema>;
export type DiningTableLayoutPatch = z.infer<typeof DiningTableLayoutPatchSchema>;

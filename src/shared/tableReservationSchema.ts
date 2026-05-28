import { z } from "zod";

export const TableReservationStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
]);

export const CreateTableReservationSchema = z.object({
  tableId: z.number().int().positive(),
  reservedAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  partySize: z.number().int().min(1).max(40),
  guestName: z.string().trim().min(1).max(80),
  guestPhone: z.string().trim().min(5).max(32),
  guestNote: z.string().trim().max(500).optional(),
  durationMinutes: z.number().int().min(30).max(240).optional(),
});

export const PatchTableReservationSchema = z.object({
  status: TableReservationStatusSchema,
});

export const TableSlotsQuerySchema = z.object({
  tableId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type CreateTableReservationInput = z.infer<typeof CreateTableReservationSchema>;
export type PatchTableReservationInput = z.infer<typeof PatchTableReservationSchema>;

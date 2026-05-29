import { z } from "zod";

export const CreateWaitlistEntrySchema = z.object({
  partySize: z.number().int().min(1).max(40),
  guestName: z.string().trim().min(1).max(80),
  guestPhone: z.string().trim().min(5).max(32),
  guestNote: z.string().trim().max(500).optional(),
  preferredAt: z.string().datetime({ offset: true }).or(z.string().min(10)).optional(),
});

export type CreateWaitlistEntryInput = z.infer<typeof CreateWaitlistEntrySchema>;

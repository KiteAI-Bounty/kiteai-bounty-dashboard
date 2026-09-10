import { z } from "zod";
export const reviewInput = z.object({
  revisionId: z.string().min(1),
  version: z.number().int().positive(),
  decision: z.enum(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]),
  note: z.string().trim().min(1).max(4000),
});

import { z } from "zod";
import { contributionDirections } from "@/modules/directions/catalog";

const directionValues = contributionDirections.map((item) => item.value) as [string, ...string[]];

export const submissionInput = z.object({
  repositoryId: z.string().min(1),
  weekId: z.string().min(1),
  summary: z.string().trim().min(20).max(4000),
  direction: z.enum(directionValues).default("x402-service"),
  evidenceUrls: z
    .array(
      z.url().refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          url.hostname === "github.com" &&
          !url.username &&
          !url.password
        );
      }, "只支持 GitHub HTTPS 贡献链接"),
    )
    .min(1)
    .max(20),
});

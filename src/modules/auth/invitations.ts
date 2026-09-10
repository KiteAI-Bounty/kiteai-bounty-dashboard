import "server-only";
import { ApiError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { parseParticipantCsv } from "./invitation-contracts";

export async function importParticipants(csv: string, actorId: string) {
  let rows;
  try {
    rows = parseParticipantCsv(csv);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "CSV_INVALID";
    throw new ApiError(
      "CSV_INVALID",
      `白名单 CSV 无法读取（${detail}）。`,
      400,
    );
  }
  return getDb().$transaction(async (tx) => {
    const output: Array<{
      displayName: string;
      contact: string;
      wallet: string;
      result: "created" | "updated";
    }> = [];
    for (const row of rows) {
      const existing = await tx.participantInvite.findUnique({
        where: { contact: row.contact },
      });
      if (existing?.status === "ACTIVE") {
        if (row.wallet && row.wallet !== existing.wallet)
          throw new ApiError(
            "ACTIVE_INVITE_LOCKED",
            `${row.displayName} 已激活，不能通过导入修改钱包。`,
            409,
          );
        await tx.participantInvite.update({
          where: { id: existing.id },
          data: { displayName: row.displayName, githubLogin: row.githubLogin },
        });
        output.push({ ...row, wallet: existing.wallet, result: "updated" });
        continue;
      }
      const data = {
        displayName: row.displayName,
        githubLogin: row.githubLogin,
        wallet: row.wallet,
        status: "PENDING" as const,
      };
      if (existing)
        await tx.participantInvite.update({ where: { id: existing.id }, data });
      else
        await tx.participantInvite.create({
          data: { ...data, contact: row.contact },
        });
      output.push({ ...row, result: existing ? "updated" : "created" });
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: "participants.import",
        entityType: "ParticipantInvite",
        entityId: `batch:${Date.now()}`,
        after: { count: output.length },
      },
    });
    return output;
  });
}

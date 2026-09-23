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
  return getDb().$transaction(
    async (tx) => {
      const existingInvites = await tx.participantInvite.findMany({
        where: {
          OR: [
            { contact: { in: rows.map((row) => row.contact) } },
            { wallet: { in: rows.map((row) => row.wallet) } },
          ],
        },
      });
      const byContact = new Map(
        existingInvites.map((invite) => [invite.contact, invite]),
      );
      const byWallet = new Map(
        existingInvites.map((invite) => [invite.wallet, invite]),
      );
      const output: Array<{
        displayName: string;
        contact: string;
        wallet: string;
        result: "created" | "updated";
      }> = [];
      const creates: Array<{
        displayName: string;
        contact: string;
        githubLogin: string | null;
        wallet: string;
        status: "PENDING";
      }> = [];
      const updates: Array<Promise<unknown>> = [];
      for (const row of rows) {
        const existing = byContact.get(row.contact);
        const walletOwner = byWallet.get(row.wallet);
        if (walletOwner && walletOwner.id !== existing?.id)
          throw new ApiError(
            "WALLET_ALREADY_INVITED",
            `${row.displayName} 的钱包已属于其他白名单记录。`,
            409,
          );
        if (existing?.status === "ACTIVE") {
          if (row.wallet && row.wallet !== existing.wallet)
            throw new ApiError(
              "ACTIVE_INVITE_LOCKED",
              `${row.displayName} 已激活，不能通过导入修改钱包。`,
              409,
            );
          updates.push(
            tx.participantInvite.update({
              where: { id: existing.id },
              data: {
                displayName: row.displayName,
                githubLogin: row.githubLogin,
              },
            }),
          );
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
          updates.push(
            tx.participantInvite.update({ where: { id: existing.id }, data }),
          );
        else creates.push({ ...data, contact: row.contact });
        output.push({ ...row, result: existing ? "updated" : "created" });
      }
      if (creates.length)
        await tx.participantInvite.createMany({ data: creates });
      await Promise.all(updates);
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
    },
    { timeout: 30_000 },
  );
}

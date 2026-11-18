import { eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { activities, maintenanceContracts, proposals } from "@/db/schema";

export type DeleteProposalFamilyResult = {
  deletedCount: number;
  deletedIds: string[];
  preservedContractCount: number;
};

/** Remove uma proposta e toda a sua família de revisões sem apagar contratos históricos. */
export async function deleteProposalFamily(id: string): Promise<DeleteProposalFamilyResult | null> {
  const [target] = await db.select().from(proposals).where(eq(proposals.id, id)).limit(1);
  if (!target) return null;
  const groupId = target.revisionGroupId ?? target.id;
  const family = await db.select({ id: proposals.id }).from(proposals).where(
    or(eq(proposals.id, groupId), eq(proposals.revisionGroupId, groupId)),
  );
  const ids = [...new Set([target.id, ...family.map((row) => row.id)])];

  return db.transaction(async (tx) => {
    // Keep the proposal snapshot, number, price and signed draft in the contract.
    const preserved = await tx.update(maintenanceContracts)
      .set({ proposalId: null, updatedAt: new Date() })
      .where(inArray(maintenanceContracts.proposalId, ids))
      .returning({ id: maintenanceContracts.id });
    await tx.delete(activities).where(inArray(activities.proposalId, ids));
    const deleted = await tx.delete(proposals).where(inArray(proposals.id, ids)).returning({ id: proposals.id });
    return { deletedCount: deleted.length, deletedIds: deleted.map((row) => row.id), preservedContractCount: preserved.length };
  });
}

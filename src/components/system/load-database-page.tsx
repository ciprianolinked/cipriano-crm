import type { ReactElement } from "react";
import { getDatabaseDiagnostics } from "@/lib/database-diagnostics";
import { DatabaseRecovery } from "@/components/system/DatabaseRecovery";

/** Recover from setup/database failures without masking unrelated application bugs. */
export async function loadDatabasePage<T>(
  load: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; recovery: ReactElement }> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    const diagnostics = await getDatabaseDiagnostics();
    if (diagnostics.ok) throw error;
    return { ok: false, recovery: <DatabaseRecovery diagnostics={diagnostics} /> };
  }
}

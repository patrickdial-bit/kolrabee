import { createAdminClient } from '@/lib/supabase/admin'

// Write a tenant-scoped audit event (spec §9). Best-effort: never throw — auditing
// must not break the user action it records.
export async function logAuditEvent(params: {
  tenantId: string
  userId: string | null
  action: string
  entityId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const adminClient = createAdminClient()
    await adminClient.from('audit_events').insert({
      tenant_id: params.tenantId,
      user_id: params.userId,
      action: params.action,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    })
  } catch (err) {
    console.error('audit_events insert failed', err)
  }
}

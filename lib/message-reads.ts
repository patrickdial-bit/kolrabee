'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function markMessagesRead(userId: string, projectId: string) {
  const adminClient = createAdminClient()
  await adminClient
    .from('message_reads')
    .upsert(
      { user_id: userId, project_id: projectId, last_read_at: new Date().toISOString() },
      { onConflict: 'user_id,project_id' }
    )
  return { success: true }
}

export async function getUnreadCounts(userId: string, projectIds: string[]) {
  if (projectIds.length === 0) return {}

  const adminClient = createAdminClient()

  // Get last read times for this user
  const { data: reads } = await adminClient
    .from('message_reads')
    .select('project_id, last_read_at')
    .eq('user_id', userId)
    .in('project_id', projectIds)

  const readMap: Record<string, string> = {}
  for (const r of reads ?? []) {
    readMap[r.project_id] = r.last_read_at
  }

  // Get message counts per project after last read
  const counts: Record<string, number> = {}
  for (const pid of projectIds) {
    let query = adminClient
      .from('job_messages')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', pid)
      .neq('sender_id', userId)

    if (readMap[pid]) {
      query = query.gt('created_at', readMap[pid])
    }

    const { count } = await query
    if (count && count > 0) {
      counts[pid] = count
    }
  }

  return counts
}

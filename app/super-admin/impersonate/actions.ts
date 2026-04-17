'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/helpers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function startImpersonation(tenantId: string) {
  await requireSuperAdmin()
  const cookieStore = await cookies()
  cookieStore.set('impersonate_tenant_id', tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 4, // 4 hours
  })
  cookieStore.delete('impersonate_sub_id')
  redirect('/admin/dashboard')
}

export async function startSubImpersonation(subId: string) {
  await requireSuperAdmin()
  const adminClient = createAdminClient()

  const { data: sub } = await adminClient
    .from('users')
    .select('id, tenant_id, role, status')
    .eq('id', subId)
    .eq('role', 'subcontractor')
    .single()

  if (!sub || sub.status === 'deleted') {
    redirect('/super-admin')
  }

  const { data: tenant } = await adminClient
    .from('tenants')
    .select('slug')
    .eq('id', sub.tenant_id)
    .single()

  if (!tenant) {
    redirect('/super-admin')
  }

  const cookieStore = await cookies()
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 4, // 4 hours
  }
  cookieStore.set('impersonate_tenant_id', sub.tenant_id, cookieOpts)
  cookieStore.set('impersonate_sub_id', sub.id, cookieOpts)
  redirect(`/${tenant.slug}/profile`)
}

export async function stopImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete('impersonate_tenant_id')
  cookieStore.delete('impersonate_sub_id')
  redirect('/super-admin')
}

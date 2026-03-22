'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/helpers'

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
  redirect('/admin/dashboard')
}

export async function stopImpersonation() {
  const cookieStore = await cookies()
  cookieStore.delete('impersonate_tenant_id')
  redirect('/super-admin')
}

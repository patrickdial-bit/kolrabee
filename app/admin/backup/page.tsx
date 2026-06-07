import { getCurrentUser } from '@/lib/helpers'
import { getIntegrationStatus } from '@/lib/integrations/backup'
import BackupSettingsClient from './BackupSettingsClient'

export default async function BackupSettingsPage() {
  const { tenant } = await getCurrentUser()
  const status = await getIntegrationStatus(tenant.id)

  return <BackupSettingsClient tenantName={tenant.name} status={status} />
}

import { getCurrentSub } from '@/lib/helpers'
import ProfileClient from './ProfileClient'

export default async function SubProfilePage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const { appUser, tenant } = await getCurrentSub(slug)

  const notifPrefs = appUser.notification_preferences ?? {
    project_invites: true,
    project_updates: true,
    project_accepted: true,
    project_cancelled: true,
  }

  return (
    <ProfileClient
      slug={slug}
      tenantName={tenant.name}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      notificationPreferences={notifPrefs}
      initialValues={{
        firstName: appUser.first_name,
        lastName: appUser.last_name,
        email: appUser.email,
        phone: appUser.phone || '',
        companyName: appUser.company_name || '',
        address: appUser.address || '',
        crewSize: appUser.crew_size?.toString() || '1',
        yearsInBusiness: appUser.years_in_business?.toString() || '',
        insuranceProvider: appUser.insurance_provider || '',
        insuranceExpiration: appUser.insurance_expiration || '',
        w9FileUrl: appUser.w9_file_url || '',
        coiFileUrl: appUser.coi_file_url || '',
      }}
    />
  )
}

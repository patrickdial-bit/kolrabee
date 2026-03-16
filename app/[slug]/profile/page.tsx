import { getCurrentSub } from '@/lib/helpers'
import ProfileClient from './ProfileClient'

export default async function SubProfilePage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const { appUser, tenant } = await getCurrentSub(slug)

  return (
    <ProfileClient
      slug={slug}
      tenantName={tenant.name}
      subName={`${appUser.first_name} ${appUser.last_name}`}
      initialValues={{
        firstName: appUser.first_name,
        lastName: appUser.last_name,
        email: appUser.email,
        phone: appUser.phone || '',
      }}
    />
  )
}

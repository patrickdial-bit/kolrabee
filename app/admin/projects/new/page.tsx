import { getCurrentUser } from '@/lib/helpers'
import AppShell from '@/components/AppShell'
import NewProjectForm from './NewProjectForm'

export default async function NewProjectPage() {
  const { appUser, tenant } = await getCurrentUser()

  return (
    <AppShell variant="admin" companyName={tenant.name}>
      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        <NewProjectForm />
      </main>
    </AppShell>
  )
}

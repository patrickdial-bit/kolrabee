'use client'

import { useState, useTransition } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import SubNav from '@/components/SubNav'
import Tooltip from '@/components/Tooltip'
import { useI18n } from '@/lib/i18n'
import { updateProfile, changePassword, uploadDocument } from './actions'
import { createBrowserClient } from '@supabase/ssr'

function SaveButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
    >
      {pending ? pendingLabel : label}
    </button>
  )
}

interface Props {
  slug: string
  tenantName: string
  subName: string
  initialValues: {
    firstName: string
    lastName: string
    email: string
    phone: string
    companyName: string
    address: string
    crewSize: string
    yearsInBusiness: string
    insuranceProvider: string
    insuranceExpiration: string
    w9FileUrl: string
    coiFileUrl: string
  }
}

export default function ProfileClient({ slug, tenantName, subName, initialValues }: Props) {
  const { t } = useI18n()
  const [profileState, profileAction] = useFormState(updateProfile, null as any)
  const [passwordState, passwordAction] = useFormState(changePassword, null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const values = profileState?.values ?? initialValues
  const hasW9 = !!(values.w9FileUrl || profileState?.values?.w9FileUrl)
  const hasCoi = !!(values.coiFileUrl || profileState?.values?.coiFileUrl)

  async function handleFileUpload(docType: 'w9' | 'coi', file: File) {
    setUploadError(null)
    setUploadSuccess(null)
    setUploading(docType)

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const ext = file.name.split('.').pop()
      const path = `${slug}/${docType}/${Date.now()}.${ext}`

      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true })

      if (storageError) {
        setUploadError(`Failed to upload ${docType.toUpperCase()}: ${storageError.message}`)
        return
      }

      startTransition(async () => {
        const result = await uploadDocument(slug, docType, path)
        if (result?.error) {
          setUploadError(result.error)
        } else {
          setUploadSuccess(`${docType.toUpperCase()} uploaded successfully.`)
          router.refresh()
        }
      })
    } catch {
      setUploadError('Upload failed. Please try again.')
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SubNav slug={slug} tenantName={tenantName} subName={subName} />

      <main className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('profile.title')}</h1>

        {/* Compliance Status Banner */}
        {(!hasW9 || !hasCoi) && (
          <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h3 className="text-sm font-semibold text-amber-800">{t('profile.docs_required')}</h3>
            <p className="mt-1 text-sm text-amber-700">
              {t('profile.docs_warning')}
            </p>
            <ul className="mt-2 text-sm text-amber-700 list-disc list-inside">
              {!hasW9 && <li>{t('profile.w9_missing')}</li>}
              {!hasCoi && <li>{t('profile.coi_missing')}</li>}
            </ul>
          </div>
        )}

        {/* Document Uploads */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('profile.documents')}</h2>
            <p className="mt-1 text-sm text-gray-500">{t('profile.docs_subtitle')}</p>
          </div>
          <div className="px-6 py-5 space-y-5">
            {uploadError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{uploadError}</p>
              </div>
            )}
            {uploadSuccess && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-700">{uploadSuccess}</p>
              </div>
            )}

            {/* W-9 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${hasW9 ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {hasW9 ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('profile.w9')}</p>
                  <p className="text-xs text-gray-500">{hasW9 ? t('profile.uploaded') : t('profile.not_uploaded')}</p>
                </div>
              </div>
              <Tooltip text={t('tip.upload_w9')} position="left">
                <label className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                  uploading === 'w9' ? 'opacity-50 cursor-not-allowed' : ''
                } ${hasW9 ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-ember text-white hover:bg-primary-700'}`}>
                  {uploading === 'w9' ? t('profile.uploading') : hasW9 ? t('profile.replace') : t('profile.upload_w9')}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={uploading === 'w9'}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload('w9', file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </Tooltip>
            </div>

            {/* COI */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${hasCoi ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {hasCoi ? (
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('profile.coi')}</p>
                  <p className="text-xs text-gray-500">{hasCoi ? t('profile.uploaded') : t('profile.not_uploaded')}</p>
                </div>
              </div>
              <Tooltip text={t('tip.upload_coi')} position="left">
                <label className={`inline-flex items-center rounded-md px-3 py-2 text-sm font-medium cursor-pointer transition-colors ${
                  uploading === 'coi' ? 'opacity-50 cursor-not-allowed' : ''
                } ${hasCoi ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-ember text-white hover:bg-primary-700'}`}>
                  {uploading === 'coi' ? t('profile.uploading') : hasCoi ? t('profile.replace') : t('profile.upload_coi')}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    disabled={uploading === 'coi'}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload('coi', file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Profile Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('profile.company_info')}</h2>
          </div>
          <form action={profileAction} className="px-6 py-5 space-y-5">
            <input type="hidden" name="slug" value={slug} />

            {profileState?.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{profileState.error}</p>
              </div>
            )}
            {profileState?.success && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-700">{t('profile.saved')}</p>
              </div>
            )}

            <div>
              <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">{t('profile.company_name')}</label>
              <input id="companyName" name="companyName" type="text"
                defaultValue={values.companyName}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm" />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">{t('profile.first_name')}</label>
                <input id="firstName" name="firstName" type="text" required
                  defaultValue={values.firstName}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm" />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">{t('profile.last_name')}</label>
                <input id="lastName" name="lastName" type="text" required
                  defaultValue={values.lastName}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm" />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">{t('profile.email')}</label>
              <input id="email" name="email" type="email" disabled
                defaultValue={values.email}
                className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500 sm:text-sm cursor-not-allowed" />
              <p className="mt-1 text-xs text-gray-500">{t('profile.email_locked')}</p>
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">{t('profile.phone')}</label>
              <input id="phone" name="phone" type="tel"
                defaultValue={values.phone}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm"
                placeholder="(555) 123-4567" />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700">{t('profile.address')}</label>
              <input id="address" name="address" type="text"
                defaultValue={values.address}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm"
                placeholder="123 Main St, Columbus, OH 43215" />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="crewSize" className="block text-sm font-medium text-gray-700">{t('profile.crew')}</label>
                <input id="crewSize" name="crewSize" type="number" min="1"
                  defaultValue={values.crewSize}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm" />
              </div>
              <div>
                <label htmlFor="yearsInBusiness" className="block text-sm font-medium text-gray-700">{t('profile.years')}</label>
                <input id="yearsInBusiness" name="yearsInBusiness" type="number" min="0"
                  defaultValue={values.yearsInBusiness}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm" />
              </div>
              <div>
                <label htmlFor="insuranceProvider" className="block text-sm font-medium text-gray-700">{t('profile.insurance_provider')}</label>
                <input id="insuranceProvider" name="insuranceProvider" type="text"
                  defaultValue={values.insuranceProvider}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm"
                  placeholder="e.g. Progressive" />
              </div>
            </div>

            <div>
              <Tooltip text={t('tip.insurance_exp')} position="top">
                <label htmlFor="insuranceExpiration" className="block text-sm font-medium text-gray-700">{t('profile.insurance_exp')}</label>
              </Tooltip>
              <input id="insuranceExpiration" name="insuranceExpiration" type="date"
                defaultValue={values.insuranceExpiration}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm" />
            </div>

            <div className="flex justify-end">
              <SaveButton label={t('profile.save')} pendingLabel={t('profile.saving')} />
            </div>
          </form>
        </div>

        {/* Password Change */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">{t('profile.change_password')}</h2>
          </div>
          <form action={passwordAction} className="px-6 py-5 space-y-5">
            <input type="hidden" name="slug" value={slug} />

            {passwordState?.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4">
                <p className="text-sm text-red-700">{passwordState.error}</p>
              </div>
            )}
            {passwordState?.success && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <p className="text-sm text-green-700">{t('profile.password_changed')}</p>
              </div>
            )}

            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">{t('profile.new_password')}</label>
              <input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm"
                placeholder="Min. 8 characters" />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">{t('profile.confirm_password')}</label>
              <input id="confirmPassword" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-ember focus:ring-2 focus:ring-ember sm:text-sm"
                placeholder="Repeat new password" />
            </div>

            <div className="flex justify-end">
              <SaveButton label={t('profile.change_btn')} pendingLabel={t('profile.changing')} />
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}

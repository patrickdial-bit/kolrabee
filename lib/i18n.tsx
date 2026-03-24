'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type Locale = 'en' | 'es'

const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Nav
    'nav.dashboard': 'Dashboard',
    'nav.profile': 'Profile',
    'nav.logout': 'Log out',
    'nav.tips_on': 'Tips On',
    'nav.tips_off': 'Tips Off',
    'nav.toggle_menu': 'Toggle menu',

    // Dashboard
    'dash.title': 'Subcontractor Dashboard',
    'dash.paid_ytd': 'Paid YTD',
    'dash.all_time': 'All-Time',
    'dash.available': 'Available Projects',
    'dash.accepted': 'Accepted Projects',
    'dash.paid': 'Paid Projects',
    'dash.no_available': 'No available projects. New projects will appear here when you are invited.',
    'dash.no_accepted': 'No active jobs. Accept an available project to see it here.',
    'dash.no_paid': 'No paid projects yet. Completed and paid projects will appear here.',
    'dash.no_in_progress': 'No jobs in progress. Start an accepted job to see it here.',
    'dash.no_completed': 'No completed jobs yet. Jobs you mark as complete will appear here.',
    'dash.jobs_in_queue': 'Jobs in Queue',
    'dash.sub_available': 'Subcontractor Available Projects',
    'dash.sub_accepted': 'Subcontractor Accepted Projects',
    'dash.all_paid': 'All Paid Projects',

    // Table headers
    'th.project_id': 'Project ID',
    'th.work_order': 'Work Order Link',
    'th.project_start': 'Project Start',
    'th.est_hours': 'Est. Hours',
    'th.payout': 'Payout',
    'th.address': 'Address',
    'th.action': 'Action',
    'th.status': 'Status',
    'th.photos': 'Photos',

    // Actions
    'action.accept': 'Accept Project',
    'action.cancel': 'Cancel',
    'action.confirm': 'Confirm',
    'action.no': 'No',
    'action.accepting': 'Accepting...',
    'action.link': 'Link',

    // Accept modal
    'modal.accept_title': 'Accept Project',
    'modal.accept_body': 'I accept the WO as written and agree to produce the full scope of the project for the payment listed, and will return after walk through for touch ups on the work that I performed, as necessary. I also agree that my required insurance is up to date.',
    'modal.cancel': 'Cancel',
    'modal.confirm': 'Confirm',

    // Profile
    'profile.title': 'Profile',
    'profile.docs_required': 'Documents Required',
    'profile.docs_warning': 'You must upload your W-9 and Certificate of Insurance (COI) before you can receive job invitations.',
    'profile.w9_missing': 'W-9 form — not uploaded',
    'profile.coi_missing': 'Certificate of Insurance (COI) — not uploaded',
    'profile.documents': 'Documents',
    'profile.docs_subtitle': 'Upload your W-9 and Certificate of Insurance.',
    'profile.w9': 'W-9 Form',
    'profile.coi': 'Certificate of Insurance (COI)',
    'profile.uploaded': 'Uploaded',
    'profile.not_uploaded': 'Not uploaded',
    'profile.upload_w9': 'Upload W-9',
    'profile.upload_coi': 'Upload COI',
    'profile.replace': 'Replace',
    'profile.uploading': 'Uploading...',
    'profile.company_info': 'Company & Personal Information',
    'profile.company_name': 'Company Name',
    'profile.first_name': 'First name',
    'profile.last_name': 'Last name',
    'profile.email': 'Email address',
    'profile.email_locked': 'Email cannot be changed.',
    'profile.phone': 'Phone number',
    'profile.address': 'Business Address',
    'profile.crew': 'Crew Members',
    'profile.years': 'Years in Business',
    'profile.insurance_provider': 'Insurance Provider',
    'profile.insurance_exp': 'Insurance Expiration Date',
    'profile.save': 'Save changes',
    'profile.saving': 'Saving...',
    'profile.saved': 'Profile updated successfully.',
    'profile.change_password': 'Change Password',
    'profile.new_password': 'New password',
    'profile.confirm_password': 'Confirm new password',
    'profile.change_btn': 'Change password',
    'profile.changing': 'Changing...',
    'profile.password_changed': 'Password changed successfully.',

    // Project detail
    'project.back': 'Back to dashboard',
    'project.location': 'LOCATION',
    'project.start_date': 'START DATE',
    'project.payout': 'PAYOUT',
    'project.accepted_date': 'ACCEPTED',
    'project.paid_date': 'PAID',
    'project.notes': 'NOTES',
    'project.photos': 'PHOTOS',
    'project.view_photos': 'View Photos',
    'project.accept_job': 'Accept Job',
    'project.decline': 'Decline',
    'project.declining': 'Declining...',
    'project.confirm_accept': 'Are you sure you want to accept this job?',
    'project.yes_accept': 'Yes, Accept',
    'project.go_back': 'Go Back',
    'project.cancel_acceptance': 'Cancel Acceptance',
    'project.confirm_cancel': 'Are you sure? This will return the project to available status.',
    'project.yes_cancel': 'Yes, Cancel',
    'project.cancelling': 'Cancelling...',

    // Tooltips
    'tip.paid_ytd': 'Total paid to you this calendar year. Resets January 1st.',
    'tip.all_time': 'Total paid to you across all years.',
    'tip.accept_project': 'Accept this project to add it to your active jobs.',
    'tip.cancel_project': 'Cancel your acceptance and return this project to available status.',
    'tip.sort_columns': 'Click any column header to sort the table.',
    'tip.work_order': 'Open the work order in a new tab.',
    'tip.photos_link': 'Open the photo repository in a new tab.',
    'tip.upload_w9': 'Upload your W-9 tax form (PDF, JPG, or PNG).',
    'tip.upload_coi': 'Upload your Certificate of Insurance (PDF, JPG, or PNG).',
    'tip.insurance_exp': 'Your insurance must be current to receive project invitations.',
    'tip.queue_count': 'Jobs you have accepted or started.',

    // Tour
    'tour.sub_stats_title': 'Your Stats',
    'tour.sub_stats_content': 'Track your earnings and jobs in queue at a glance.',
    'tour.sub_kanban_title': 'Your Job Board',
    'tour.sub_kanban_content': 'Jobs flow left to right: Available, Accepted, In Progress, Completed, Paid. Use the buttons on each card to advance.',
  },
  es: {
    // Nav
    'nav.dashboard': 'Tablero',
    'nav.profile': 'Perfil',
    'nav.logout': 'Cerrar sesion',
    'nav.tips_on': 'Ayuda On',
    'nav.tips_off': 'Ayuda Off',
    'nav.toggle_menu': 'Abrir menu',

    // Dashboard
    'dash.title': 'Tablero del Subcontratista',
    'dash.paid_ytd': 'Pagado este ano',
    'dash.all_time': 'Total historico',
    'dash.available': 'Proyectos Disponibles',
    'dash.accepted': 'Proyectos Aceptados',
    'dash.paid': 'Proyectos Pagados',
    'dash.no_available': 'No hay proyectos disponibles. Los nuevos proyectos apareceran aqui cuando seas invitado.',
    'dash.no_accepted': 'No tienes trabajos activos. Acepta un proyecto disponible para verlo aqui.',
    'dash.no_paid': 'No hay proyectos pagados aun. Los proyectos completados y pagados apareceran aqui.',
    'dash.no_in_progress': 'No hay trabajos en progreso. Inicia un trabajo aceptado para verlo aqui.',
    'dash.no_completed': 'No hay trabajos completados aun. Los trabajos que marques como completos apareceran aqui.',
    'dash.jobs_in_queue': 'Trabajos en Cola',
    'dash.sub_available': 'Proyectos Disponibles del Subcontratista',
    'dash.sub_accepted': 'Proyectos Aceptados del Subcontratista',
    'dash.all_paid': 'Todos los Proyectos Pagados',

    // Table headers
    'th.project_id': 'ID del Proyecto',
    'th.work_order': 'Orden de Trabajo',
    'th.project_start': 'Inicio del Proyecto',
    'th.est_hours': 'Horas Est.',
    'th.payout': 'Pago',
    'th.address': 'Direccion',
    'th.action': 'Accion',
    'th.status': 'Estado',
    'th.photos': 'Fotos',

    // Actions
    'action.accept': 'Aceptar Proyecto',
    'action.cancel': 'Cancelar',
    'action.confirm': 'Confirmar',
    'action.no': 'No',
    'action.accepting': 'Aceptando...',
    'action.link': 'Enlace',

    // Accept modal
    'modal.accept_title': 'Aceptar Proyecto',
    'modal.accept_body': 'Acepto la orden de trabajo tal como esta escrita y me comprometo a realizar el alcance completo del proyecto por el pago indicado. Regresare despues de la inspeccion para retoques en el trabajo que realice, segun sea necesario. Tambien confirmo que mi seguro requerido esta al dia.',
    'modal.cancel': 'Cancelar',
    'modal.confirm': 'Confirmar',

    // Profile
    'profile.title': 'Perfil',
    'profile.docs_required': 'Documentos Requeridos',
    'profile.docs_warning': 'Debes subir tu W-9 y Certificado de Seguro (COI) antes de poder recibir invitaciones a proyectos.',
    'profile.w9_missing': 'Formulario W-9 — no subido',
    'profile.coi_missing': 'Certificado de Seguro (COI) — no subido',
    'profile.documents': 'Documentos',
    'profile.docs_subtitle': 'Sube tu W-9 y Certificado de Seguro.',
    'profile.w9': 'Formulario W-9',
    'profile.coi': 'Certificado de Seguro (COI)',
    'profile.uploaded': 'Subido',
    'profile.not_uploaded': 'No subido',
    'profile.upload_w9': 'Subir W-9',
    'profile.upload_coi': 'Subir COI',
    'profile.replace': 'Reemplazar',
    'profile.uploading': 'Subiendo...',
    'profile.company_info': 'Informacion de la Empresa y Personal',
    'profile.company_name': 'Nombre de la Empresa',
    'profile.first_name': 'Nombre',
    'profile.last_name': 'Apellido',
    'profile.email': 'Correo electronico',
    'profile.email_locked': 'El correo no se puede cambiar.',
    'profile.phone': 'Numero de telefono',
    'profile.address': 'Direccion de la Empresa',
    'profile.crew': 'Miembros del Equipo',
    'profile.years': 'Anos en el Negocio',
    'profile.insurance_provider': 'Proveedor de Seguro',
    'profile.insurance_exp': 'Fecha de Vencimiento del Seguro',
    'profile.save': 'Guardar cambios',
    'profile.saving': 'Guardando...',
    'profile.saved': 'Perfil actualizado exitosamente.',
    'profile.change_password': 'Cambiar Contrasena',
    'profile.new_password': 'Nueva contrasena',
    'profile.confirm_password': 'Confirmar nueva contrasena',
    'profile.change_btn': 'Cambiar contrasena',
    'profile.changing': 'Cambiando...',
    'profile.password_changed': 'Contrasena cambiada exitosamente.',

    // Project detail
    'project.back': 'Volver al tablero',
    'project.location': 'UBICACION',
    'project.start_date': 'FECHA DE INICIO',
    'project.payout': 'PAGO',
    'project.accepted_date': 'ACEPTADO',
    'project.paid_date': 'PAGADO',
    'project.notes': 'NOTAS',
    'project.photos': 'FOTOS',
    'project.view_photos': 'Ver Fotos',
    'project.accept_job': 'Aceptar Trabajo',
    'project.decline': 'Rechazar',
    'project.declining': 'Rechazando...',
    'project.confirm_accept': 'Estas seguro de que quieres aceptar este trabajo?',
    'project.yes_accept': 'Si, Aceptar',
    'project.go_back': 'Volver',
    'project.cancel_acceptance': 'Cancelar Aceptacion',
    'project.confirm_cancel': 'Estas seguro? Esto devolvera el proyecto al estado disponible.',
    'project.yes_cancel': 'Si, Cancelar',
    'project.cancelling': 'Cancelando...',

    // Tooltips
    'tip.paid_ytd': 'Total pagado este ano calendario. Se reinicia el 1 de enero.',
    'tip.all_time': 'Total pagado a lo largo de todos los anos.',
    'tip.accept_project': 'Acepta este proyecto para agregarlo a tus trabajos activos.',
    'tip.cancel_project': 'Cancela tu aceptacion y devuelve este proyecto al estado disponible.',
    'tip.sort_columns': 'Haz clic en cualquier encabezado de columna para ordenar la tabla.',
    'tip.work_order': 'Abrir la orden de trabajo en una nueva pestana.',
    'tip.photos_link': 'Abrir el repositorio de fotos en una nueva pestana.',
    'tip.upload_w9': 'Sube tu formulario de impuestos W-9 (PDF, JPG o PNG).',
    'tip.upload_coi': 'Sube tu Certificado de Seguro (PDF, JPG o PNG).',
    'tip.insurance_exp': 'Tu seguro debe estar vigente para recibir invitaciones a proyectos.',
    'tip.queue_count': 'Trabajos que has aceptado o iniciado.',

    // Tour
    'tour.sub_stats_title': 'Tus Estadisticas',
    'tour.sub_stats_content': 'Revisa tus ganancias y trabajos en cola de un vistazo.',
    'tour.sub_kanban_title': 'Tu Tablero de Trabajos',
    'tour.sub_kanban_content': 'Los trabajos fluyen de izquierda a derecha: Disponible, Aceptado, En Progreso, Completado, Pagado. Usa los botones en cada tarjeta para avanzar.',
  },
}

interface I18nContextValue {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en')

  useEffect(() => {
    const stored = localStorage.getItem('locale') as Locale | null
    if (stored === 'es') setLocaleState('es')
  }, [])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('locale', l)
  }, [])

  const t = useCallback((key: string): string => {
    return translations[locale][key] ?? translations['en'][key] ?? key
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

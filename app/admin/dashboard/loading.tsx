export default function AdminDashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Nav skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <div className="h-8 w-56 bg-gray-200 rounded" />
            <div className="h-4 w-72 bg-gray-100 rounded" />
          </div>
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-gray-200 rounded-md" />
            <div className="h-10 w-32 bg-gray-300 rounded-md" />
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-white rounded-lg border border-gray-200" />
          ))}
        </div>

        {/* Pipeline */}
        <div className="h-40 bg-white rounded-lg border border-gray-200 mb-6" />

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-white rounded-lg border border-gray-200" />
          <div className="space-y-6">
            <div className="h-40 bg-white rounded-lg border border-gray-200" />
            <div className="h-40 bg-white rounded-lg border border-gray-200" />
          </div>
        </div>
      </main>
    </div>
  )
}

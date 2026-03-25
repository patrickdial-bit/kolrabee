export default function AdminDashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Nav skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <main className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="flex gap-3">
            <div className="h-10 w-48 bg-gray-200 rounded-md" />
            <div className="h-10 w-28 bg-gray-300 rounded-md" />
          </div>
        </div>

        {/* Usage stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="h-20 bg-white rounded-lg border border-gray-200" />
          <div className="h-20 bg-white rounded-lg border border-gray-200" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <div className="h-10 w-28 bg-gray-200 rounded-md" />
          <div className="h-10 w-28 bg-gray-200 rounded-md" />
          <div className="h-10 w-28 bg-gray-200 rounded-md" />
        </div>

        {/* Table */}
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="h-12 bg-gray-700" />
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 border-b border-gray-100 px-4 flex items-center gap-4">
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
              <div className="h-4 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

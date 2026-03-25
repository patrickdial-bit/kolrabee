export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Nav skeleton */}
      <div className="h-16 bg-white border-b border-gray-200" />

      <main className="mx-auto max-w-full px-4 sm:px-6 lg:px-8 py-6">
        {/* Title */}
        <div className="h-8 w-64 bg-gray-200 rounded mb-4" />

        {/* Stats row */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="h-12 w-40 bg-gray-200 rounded-lg" />
          <div className="h-12 w-40 bg-gray-200 rounded-lg" />
          <div className="h-12 w-40 bg-gray-200 rounded-lg" />
        </div>

        {/* Kanban columns */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-72">
              <div className="h-10 bg-gray-300 rounded-t-lg" />
              <div className="bg-gray-100 rounded-b-lg p-3 space-y-3 min-h-[200px]">
                <div className="h-32 bg-white rounded-lg border border-gray-200" />
                {i <= 2 && <div className="h-32 bg-white rounded-lg border border-gray-200" />}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

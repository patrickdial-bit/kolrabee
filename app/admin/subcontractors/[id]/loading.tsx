export default function SubDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-16 bg-white border-b border-gray-200" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <div className="h-5 w-40 bg-gray-200 rounded mb-6" />

        {/* Info card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-8 w-48 bg-gray-200 rounded" />
            <div className="h-6 w-16 bg-gray-200 rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-8">
            <div className="h-12 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
            <div className="h-12 bg-gray-100 rounded" />
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
          <div className="h-24 bg-white rounded-lg border border-gray-200" />
          <div className="h-24 bg-white rounded-lg border border-gray-200" />
          <div className="h-24 bg-white rounded-lg border border-gray-200" />
          <div className="h-24 bg-white rounded-lg border border-gray-200" />
        </div>

        {/* Compliance */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 mb-8">
          <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-3 gap-6">
            <div className="h-28 bg-gray-100 rounded-lg" />
            <div className="h-28 bg-gray-100 rounded-lg" />
            <div className="h-28 bg-gray-100 rounded-lg" />
          </div>
        </div>

        {/* Project history */}
        <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 border-b border-gray-100 px-6 flex items-center gap-4">
              <div className="h-4 w-24 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

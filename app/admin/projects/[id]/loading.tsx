export default function ProjectDetailLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      <div className="h-16 bg-white border-b border-gray-200" />

      <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-5 w-36 bg-gray-200 rounded mb-6" />

        <div className="bg-white rounded-lg border border-gray-200 p-6 sm:p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-8 w-48 bg-gray-200 rounded" />
            </div>
            <div className="h-8 w-24 bg-gray-200 rounded-full" />
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div className="h-14 bg-gray-100 rounded" />
            <div className="h-14 bg-gray-100 rounded" />
            <div className="h-14 bg-gray-100 rounded" />
            <div className="h-14 bg-gray-100 rounded" />
          </div>

          <div className="flex gap-3">
            <div className="h-10 w-24 bg-gray-200 rounded-md" />
            <div className="h-10 w-28 bg-gray-200 rounded-md" />
          </div>
        </div>
      </main>
    </div>
  )
}

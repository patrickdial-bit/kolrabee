"use client";

import Link from "next/link";

interface JobStats {
  available: number;
  assigned: number;
  completed: number;
  paid: number;
}

interface ProjectCardProps {
  id: string;
  name: string;
  address: string;
  status: string;
  jobStats: JobStats;
}

const statBadges: { key: keyof JobStats; label: string; color: string }[] = [
  { key: "available", label: "Available", color: "bg-blue-100 text-blue-700" },
  { key: "assigned", label: "Assigned", color: "bg-yellow-100 text-yellow-700" },
  { key: "completed", label: "Completed", color: "bg-green-100 text-green-700" },
  { key: "paid", label: "Paid", color: "bg-gray-100 text-gray-600" },
];

export default function ProjectCard({
  id,
  name,
  address,
  status,
  jobStats,
}: ProjectCardProps) {
  const totalJobs =
    jobStats.available + jobStats.assigned + jobStats.completed + jobStats.paid;

  return (
    <Link href={`/admin/projects/${id}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-primary-200 transition-all cursor-pointer h-full flex flex-col">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
            {name}
          </h3>
          <span
            className={`ml-2 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              status === "active"
                ? "bg-green-100 text-green-700"
                : status === "completed"
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {status}
          </span>
        </div>

        {address && (
          <p className="text-sm text-gray-500 mb-4 line-clamp-2">{address}</p>
        )}

        <div className="mt-auto">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {totalJobs} {totalJobs === 1 ? "Job" : "Jobs"}
          </p>
          <div className="flex flex-wrap gap-2">
            {statBadges.map(
              (badge) =>
                jobStats[badge.key] > 0 && (
                  <span
                    key={badge.key}
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
                  >
                    {jobStats[badge.key]} {badge.label}
                  </span>
                )
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

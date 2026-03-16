"use client";

import { useTransition } from "react";
import { updateJobStatus, deleteJob } from "@/app/admin/projects/[id]/actions";

interface JobCardProps {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  payAmount: number;
  status: string;
  version: number;
  assignedToName: string | null;
}

export default function JobCard({
  id,
  projectId,
  title,
  description,
  payAmount,
  status,
  version,
  assignedToName,
}: JobCardProps) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      const result = await updateJobStatus(projectId, id, newStatus, version);
      if (result?.error) {
        alert(result.error);
      }
    });
  };

  const handleDelete = () => {
    if (!confirm("Delete this job?")) return;
    startTransition(async () => {
      const result = await deleteJob(projectId, id);
      if (result?.error) {
        alert(result.error);
      }
    });
  };

  const statusColors: Record<string, string> = {
    available: "bg-blue-100 text-blue-700",
    assigned: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    paid: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-base font-semibold text-gray-900 line-clamp-1">
          {title}
        </h4>
        <span
          className={`ml-2 shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
            statusColors[status] || "bg-gray-100 text-gray-600"
          }`}
        >
          {status}
        </span>
      </div>

      {description && (
        <p className="text-sm text-gray-500 mb-3 line-clamp-3">{description}</p>
      )}

      <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100">
        <span className="text-lg font-bold text-gray-900">
          ${payAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
        </span>
        {assignedToName && (
          <span className="text-sm text-gray-500 truncate ml-2">
            {assignedToName}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mt-3">
        {status === "assigned" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStatusChange("completed")}
            className="inline-flex items-center rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Updating..." : "Mark Completed"}
          </button>
        )}
        {status === "completed" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleStatusChange("paid")}
            className="inline-flex items-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Updating..." : "Mark Paid"}
          </button>
        )}
        {status === "available" && (
          <button
            type="button"
            disabled={isPending}
            onClick={handleDelete}
            className="inline-flex items-center rounded-md bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
}

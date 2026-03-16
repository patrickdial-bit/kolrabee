"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import StatusTabs from "@/components/StatusTabs";
import JobCard from "@/components/JobCard";
import { updateProject, createJob } from "./actions";

interface Project {
  id: string;
  name: string;
  address: string;
  status: string;
}

interface Job {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  payAmount: number;
  status: string;
  version: number;
  assignedToName: string | null;
}

interface ProjectDetailContentProps {
  project: Project;
  jobs: Job[];
}

const jobTabs = ["Available", "Assigned", "Completed", "Paid"];
const projectStatuses = ["active", "completed", "archived"];

export default function ProjectDetailContent({
  project,
  jobs,
}: ProjectDetailContentProps) {
  const [activeTab, setActiveTab] = useState("Available");
  const [editing, setEditing] = useState(false);
  const [showAddJob, setShowAddJob] = useState(false);
  const [editPending, startEditTransition] = useTransition();
  const [jobPending, startJobTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const filteredJobs = jobs.filter(
    (j) => j.status === activeTab.toLowerCase()
  );

  const counts: Record<string, number> = {};
  for (const tab of jobTabs) {
    counts[tab] = jobs.filter((j) => j.status === tab.toLowerCase()).length;
  }

  const handleEditSubmit = (formData: FormData) => {
    setError(null);
    startEditTransition(async () => {
      const result = await updateProject(project.id, formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setEditing(false);
      }
    });
  };

  const handleAddJob = (formData: FormData) => {
    setJobError(null);
    startJobTransition(async () => {
      const result = await createJob(project.id, formData);
      if (result?.error) {
        setJobError(result.error);
      } else {
        setShowAddJob(false);
      }
    });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg
            className="mr-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {/* Project header */}
      {editing ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Edit Project
          </h2>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          <form action={handleEditSubmit} className="space-y-4">
            <div>
              <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                id="edit-name"
                name="name"
                defaultValue={project.name}
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-address" className="block text-sm font-medium text-gray-700 mb-1">
                Address
              </label>
              <input
                type="text"
                id="edit-address"
                name="address"
                defaultValue={project.address}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="edit-status"
                name="status"
                defaultValue={project.status}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm"
              >
                {projectStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={editPending}
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {editPending ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">
                  {project.name}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    project.status === "active"
                      ? "bg-green-100 text-green-700"
                      : project.status === "completed"
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {project.status}
                </span>
              </div>
              {project.address && (
                <p className="text-sm text-gray-500">{project.address}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <svg
                className="mr-1.5 h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
                />
              </svg>
              Edit Project
            </button>
          </div>
        </div>
      )}

      {/* Jobs section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Jobs</h2>
        <button
          type="button"
          onClick={() => setShowAddJob(!showAddJob)}
          className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
        >
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Job
        </button>
      </div>

      {/* Add job form */}
      {showAddJob && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            New Job
          </h3>
          {jobError && (
            <div className="mb-4 rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{jobError}</p>
            </div>
          )}
          <form action={handleAddJob} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="job-title"
                  name="title"
                  required
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm"
                  placeholder="e.g. Electrical Rough-In"
                />
              </div>
              <div>
                <label htmlFor="job-pay" className="block text-sm font-medium text-gray-700 mb-1">
                  Pay Amount ($) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="job-pay"
                  name="pay_amount"
                  required
                  min="0"
                  step="0.01"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <label htmlFor="job-desc" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="job-desc"
                name="description"
                rows={3}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 sm:text-sm"
                placeholder="Describe the scope of work..."
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={jobPending}
                className="inline-flex items-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                {jobPending ? "Adding..." : "Add Job"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddJob(false);
                  setJobError(null);
                }}
                className="inline-flex items-center rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Job tabs */}
      <StatusTabs
        tabs={jobTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
      />

      {/* Job cards */}
      {filteredJobs.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard
              key={job.id}
              id={job.id}
              projectId={job.projectId}
              title={job.title}
              description={job.description}
              payAmount={job.payAmount}
              status={job.status}
              version={job.version}
              assignedToName={job.assignedToName}
            />
          ))}
        </div>
      ) : (
        <div className="mt-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">
            No {activeTab.toLowerCase()} jobs
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === "Available"
              ? "Add a job to get started."
              : `No jobs with ${activeTab.toLowerCase()} status.`}
          </p>
        </div>
      )}
    </main>
  );
}

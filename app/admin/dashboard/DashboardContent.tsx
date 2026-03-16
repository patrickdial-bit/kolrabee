"use client";

import { useState } from "react";
import Link from "next/link";
import StatusTabs from "@/components/StatusTabs";
import ProjectCard from "@/components/ProjectCard";

interface ProjectWithStats {
  id: string;
  name: string;
  address: string;
  status: string;
  jobStats: {
    available: number;
    assigned: number;
    completed: number;
    paid: number;
  };
}

interface DashboardContentProps {
  projects: ProjectWithStats[];
}

const tabs = ["Active", "Completed", "Archived"];

export default function DashboardContent({ projects }: DashboardContentProps) {
  const [activeTab, setActiveTab] = useState("Active");

  const filtered = projects.filter(
    (p) => p.status === activeTab.toLowerCase()
  );

  const counts: Record<string, number> = {};
  for (const tab of tabs) {
    counts[tab] = projects.filter(
      (p) => p.status === tab.toLowerCase()
    ).length;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your construction projects and jobs.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
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
          New Project
        </Link>
      </div>

      {/* Tabs */}
      <StatusTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        counts={counts}
      />

      {/* Project grid */}
      {filtered.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              name={project.name}
              address={project.address}
              status={project.status}
              jobStats={project.jobStats}
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
              d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008V7.5Z"
            />
          </svg>
          <h3 className="mt-3 text-sm font-semibold text-gray-900">
            No {activeTab.toLowerCase()} projects
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === "Active"
              ? "Get started by creating a new project."
              : `You don't have any ${activeTab.toLowerCase()} projects yet.`}
          </p>
          {activeTab === "Active" && (
            <Link
              href="/admin/projects/new"
              className="mt-4 inline-flex items-center rounded-md bg-primary-600 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-colors"
            >
              New Project
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

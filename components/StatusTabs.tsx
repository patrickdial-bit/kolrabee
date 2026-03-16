"use client";

interface StatusTabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts?: Record<string, number>;
}

export default function StatusTabs({
  tabs,
  activeTab,
  onTabChange,
  counts,
}: StatusTabsProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {tab}
              {counts && counts[tab] !== undefined && (
                <span
                  className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    isActive
                      ? "bg-primary-100 text-primary-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {counts[tab]}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

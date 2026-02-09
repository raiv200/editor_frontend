// src/components/layout/AppHeader.tsx

"use client";

import { useAuth } from "@/context/AuthContext";
import { Search, Bell } from "lucide-react";

interface AppHeaderProps {
  // Optional: hide search bar on certain pages
  showSearch?: boolean;
  // Notification count
  notificationCount?: number;
}

export default function AppHeader({
  showSearch = true,
  notificationCount = 3,
}: AppHeaderProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        {showSearch && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFPs, documents, or people... (Ctrl+K)"
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all"
            />
          </div>
        )}
      </div>

      {/* Right Side - Notifications & User */}
      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={20} />
          {notificationCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
              {notificationCount > 9 ? "9+" : notificationCount}
            </span>
          )}
        </button>

        {/* User Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium cursor-pointer hover:ring-2 hover:ring-blue-200 transition-all"
          style={{ backgroundColor: user?.color || "#3B82F6" }}
          title={user?.name}
        >
          {user?.name?.charAt(0).toUpperCase() || "U"}
        </div>
      </div>
    </header>
  );
}
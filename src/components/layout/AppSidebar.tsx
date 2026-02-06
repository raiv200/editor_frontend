// src/components/layout/AppSidebar.tsx

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  FileText,
  LayoutDashboard,
  FolderOpen,
  Library,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

interface AppSidebarProps {
  activePage?: "dashboard" | "rfps" | "content-library" | "team" | "settings";
}

export default function AppSidebar({ activePage }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Auto-detect active page from pathname if not provided
  const getActivePage = () => {
    if (activePage) return activePage;
    if (pathname === "/") return "dashboard";
    if (pathname.startsWith("/rfp") || pathname.startsWith("/preview")) return "rfps";
    if (pathname.startsWith("/content-library")) return "content-library";
    if (pathname.startsWith("/team")) return "team";
    if (pathname.startsWith("/settings")) return "settings";
    return "dashboard";
  };

  const active = getActivePage();

  return (
    <aside className="w-64 h-screen bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Logo - Fixed height */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-gray-200 flex-shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-lg text-gray-900">Raspond</span>
      </div>

      {/* Navigation - Takes remaining space but doesn't scroll */}
      <nav className="flex-1 p-4 space-y-1 overflow-hidden">
        <NavItem
          icon={<LayoutDashboard size={20} />}
          label="Dashboard"
          active={active === "dashboard"}
          onClick={() => router.push("/")}
        />
        <NavItem
          icon={<FolderOpen size={20} />}
          label="RFPs"
          active={active === "rfps"}
          onClick={() => router.push("/")}
        />
        <NavItem
          icon={<Library size={20} />}
          label="Content Library"
          active={active === "content-library"}
          onClick={() => {}}
        />
        <NavItem
          icon={<Users size={20} />}
          label="Team & Workflow"
          active={active === "team"}
          onClick={() => {}}
        />
        <NavItem
          icon={<Settings size={20} />}
          label="Settings"
          active={active === "settings"}
          onClick={() => {}}
        />
      </nav>

      {/* User Section - Fixed at bottom */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
            style={{ backgroundColor: user?.color || "#3B82F6" }}
          >
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-gray-600 rounded flex-shrink-0"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-blue-50 text-blue-600" : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
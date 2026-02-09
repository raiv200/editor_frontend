// src/components/layout/AppSidebar.tsx

"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  Zap,
  LayoutDashboard,
  FileText,
  Globe,
  Users,
  Settings,
  LogOut,
} from "lucide-react";

export default function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // Auto-detect active page from pathname
  const getActivePage = () => {
    if (pathname === "/") return "dashboard";
    if (pathname.startsWith("/rfp") || pathname.startsWith("/review") || pathname.startsWith("/export") || pathname.startsWith("/success")) return "rfps";
    if (pathname.startsWith("/content-library")) return "content-library";
    if (pathname.startsWith("/team")) return "team";
    if (pathname.startsWith("/settings")) return "settings";
    return "dashboard";
  };

  const active = getActivePage();

  return (
    <aside className="w-[220px] h-screen bg-white border-r border-gray-200 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-5 border-b border-gray-100">
        <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-lg text-gray-900">Raspond</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-hidden">
        <NavItem
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          active={active === "dashboard"}
          onClick={() => router.push("/")}
        />
        <NavItem
          icon={<FileText size={18} />}
          label="RFPs"
          active={active === "rfps"}
          onClick={() => router.push("/")}
        />
        <NavItem
          icon={<Globe size={18} />}
          label="Content Library"
          active={active === "content-library"}
          onClick={() => {}}
        />
        <NavItem
          icon={<Users size={18} />}
          label="Team & Workflow"
          active={active === "team"}
          onClick={() => {}}
        />
        <NavItem
          icon={<Settings size={18} />}
          label="Settings"
          active={active === "settings"}
          onClick={() => {}}
        />
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
            style={{ backgroundColor: user?.color || "#3B82F6" }}
          >
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.name || "User"}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {user?.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            title="Logout"
          >
            <LogOut size={16} />
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
        active 
          ? "bg-blue-50 text-blue-600" 
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
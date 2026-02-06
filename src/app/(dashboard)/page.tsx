// src/app/(dashboard)/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import type { Rfp } from "@/types";
import {
  FileText,
  Plus,
  Loader2,
  MoreVertical,
  Trash2,
  Calendar,
  Search,
  Bell,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchRfps = async () => {
      try {
        const { rfps } = await api.rfps.list();
        setRfps(rfps);
      } catch (error) {
        console.error("Failed to fetch RFPs:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRfps();
  }, []);

  const handleCreateRfp = async () => {
    setIsCreating(true);
    try {
      const { rfp } = await api.rfps.create({
        title: "New RFP",
        company: "Company Name",
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      router.push(`/rfp/${rfp.id}`);
    } catch (error) {
      console.error("Failed to create RFP:", error);
      setIsCreating(false);
    }
  };

  const handleDeleteRfp = async (id: string) => {
    if (!confirm("Delete this RFP?")) return;
    try {
      await api.rfps.delete(id);
      setRfps((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      alert("Failed to delete");
    }
    setMenuOpen(null);
  };

  // Dashboard header actions
  const headerActions = (
    <div className="flex items-center gap-4">
      <button className="relative p-2 text-gray-400 hover:text-gray-600">
        <Bell size={20} />
        <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
      </button>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium"
        style={{ backgroundColor: user?.color || "#3B82F6" }}
      >
        {user?.name?.charAt(0).toUpperCase()}
      </div>
    </div>
  );

  return (
    <>
      {/* Fixed Header */}
      <AppHeader
        title=""
        actions={
          <div className="flex items-center gap-4 w-full">
            {/* Search bar */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search RFPs, documents, or people... (Ctrl+K)"
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {headerActions}
          </div>
        }
      />

      {/* Scrollable Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Your RFPs</h1>
            <p className="text-gray-500">
              Manage and collaborate on RFP responses
            </p>
          </div>
          <button
            onClick={handleCreateRfp}
            disabled={isCreating}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus size={20} />
            )}
            New RFP
          </button>
        </div>

        {/* RFP Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : rfps.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-lg border border-gray-200">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No RFPs yet
            </h3>
            <p className="text-gray-500 mb-6">
              Create your first RFP to get started
            </p>
            <button
              onClick={handleCreateRfp}
              disabled={isCreating}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Plus size={20} />
              Create RFP
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rfps.map((rfp) => (
              <div
                key={rfp.id}
                className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded ${
                        rfp.status === "IN_PROGRESS"
                          ? "bg-blue-100 text-blue-700"
                          : rfp.status === "DRAFT"
                          ? "bg-gray-100 text-gray-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {rfp.status.replace("_", " ")}
                    </span>
                    <div className="relative">
                      <button
                        onClick={() =>
                          setMenuOpen(menuOpen === rfp.id ? null : rfp.id)
                        }
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuOpen === rfp.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpen(null)}
                          />
                          <div className="absolute right-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20">
                            <button
                              onClick={() => handleDeleteRfp(rfp.id)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <h3
                    onClick={() => router.push(`/rfp/${rfp.id}`)}
                    className="font-semibold text-gray-900 mb-1 cursor-pointer hover:text-blue-600"
                  >
                    {rfp.title}
                  </h3>
                  {rfp.company && (
                    <p className="text-sm text-gray-500 mb-4">{rfp.company}</p>
                  )}

                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress</span>
                      <span>0%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: "0%" }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <FileText size={14} />
                      <span>0/{rfp.totalQuestions || 0}</span>
                    </div>
                    {rfp.dueDate && (
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>
                          {new Date(rfp.dueDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-lg">
                  <button
                    onClick={() => router.push(`/rfp/${rfp.id}`)}
                    className="w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    Open RFP →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
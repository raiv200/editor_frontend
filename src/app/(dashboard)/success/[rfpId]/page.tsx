"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import type { Rfp } from "@/types";
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  Sparkles,
  Plus,
  Loader2,
  Check,
} from "lucide-react";

interface PageProps {
  params: Promise<{ rfpId: string }>;
}

export default function SuccessPage({ params }: PageProps) {
  const { rfpId } = use(params);
  const router = useRouter();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!rfpId) return;

    const fetchRfp = async () => {
      try {
        const { rfp: data } = await api.rfps.get(rfpId);
        setRfp(data);
      } catch (err) {
        console.error("Failed to load RFP:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRfp();
  }, [rfpId]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <>
      <AppHeader />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className=" mx-auto py-16 px-6">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              RFP Submitted Successfully!
            </h1>
            <p className="text-lg text-gray-500">
              Your response to {rfp?.title || "the RFP"} has been submitted to{" "}
              {rfp?.company || "the client"}.
            </p>
          </div>

          {/* Journey Summary Card */}
          <div className="max-w-5xl  mx-auto bg-white rounded-2xl border border-gray-200 p-8 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 text-center mb-8">
              Journey Summary
            </h2>

            <div className="grid grid-cols-4 gap-6">
              {/* Time */}
              <div className="text-center">
                <div className="w-16 h-16 bg-pink-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Clock size={28} className="text-pink-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">18 minutes</p>
                <p className="text-sm text-gray-500">Total Time</p>
              </div>

              {/* Speed */}
              <div className="text-center">
                <div className="w-16 h-16 bg-rose-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <TrendingUp size={28} className="text-rose-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">70% Faster</p>
                <p className="text-sm text-gray-500">Than manual process</p>
              </div>

              {/* Team */}
              <div className="text-center">
                <div className="w-16 h-16 bg-cyan-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Users size={28} className="text-cyan-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">4 Team members</p>
                <p className="text-sm text-gray-500">Collaborated</p>
              </div>

              {/* AI */}
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Sparkles size={28} className="text-amber-600" />
                </div>
                <p className="text-2xl font-bold text-gray-900">72 AI Suggestions</p>
                <p className="text-sm text-gray-500">Generated</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Start Another RFP
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
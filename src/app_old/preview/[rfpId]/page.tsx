// src/app/preview/[rfpId]/page.tsx

"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { Rfp, Section, Question } from "@/types";
import  AppSidebar  from "@/components/layout/AppSidebar";
import ExportOptionsPanel from "@/components/ExportOptionsPanel";
import DocumentPreview from "@/components/DocumentPreview";
import { useExport } from "@/hooks/useExport";
import {
  ArrowLeft,
  FileText,
  Eye,
  Loader2,
  Users,
} from "lucide-react";

type ViewMode = "document" | "preview";

interface PageProps {
  params: Promise<{ rfpId: string }>;
}

interface ExportSection {
  id: number;
  title: string;
  questions: {
    id: string;
    title: string;
    fullQuestion: string;
  }[];
}

export default function PreviewPage({ params }: PageProps) {
  const { rfpId } = use(params);
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("document");

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answersLoaded, setAnswersLoaded] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch RFP data
  useEffect(() => {
    if (!isAuthenticated || !rfpId) return;

    const fetchRfp = async () => {
      try {
        const { rfp: data } = await api.rfps.get(rfpId);
        setRfp(data);

        // Fetch all answers
        if (data.sections?.length) {
          const allQuestions = data.sections.flatMap((s: Section) => s.questions);
          const answerPromises = allQuestions.map(async (q: Question) => {
            try {
              const answerData = await api.rfps.getAnswer(rfpId, q.id);
              return { questionId: q.id, answer: answerData.answer || "" };
            } catch {
              return { questionId: q.id, answer: "" };
            }
          });

          const answersArray = await Promise.all(answerPromises);
          const answersMap: Record<string, string> = {};
          answersArray.forEach(({ questionId, answer }) => {
            answersMap[questionId] = answer;
          });
          setAnswers(answersMap);
          setAnswersLoaded(true);
        } else {
          setAnswersLoaded(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load RFP");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRfp();
  }, [isAuthenticated, rfpId]);

  // Transform sections for export
  const exportSections: ExportSection[] =
    rfp?.sections?.map((section, index) => ({
      id: section.order || index + 1,
      title: section.title,
      questions: section.questions.map((q) => ({
        id: q.id,
        title: q.title,
        fullQuestion: q.fullQuestion || q.description || "",
      })),
    })) || [];

  const getAnswer = useCallback(
    (questionId: string): string => {
      return answers[questionId] || "";
    },
    [answers]
  );

  const getStatus = useCallback(
    (questionId: string): string => {
      const answer = answers[questionId];
      if (answer && answer.trim() !== "" && answer !== "<p></p>") {
        return "saved";
      }
      return "empty";
    },
    [answers]
  );

  // Export hook
  const {
    format,
    setFormat,
    pageSettings,
    setPageSettings,
    isExporting,
    error: exportError,
    handleExport,
  } = useExport({
    sections: exportSections,
    getAnswer,
    getStatus,
    documentTitle: rfp?.title || "RFP Response",
    companyName: rfp?.company,
  });

  // Stats
  const totalQuestions = exportSections.reduce(
    (sum, s) => sum + s.questions.length,
    0
  );
  const answeredQuestions = exportSections
    .flatMap((s) => s.questions)
    .filter((q) => getStatus(q.id) === "saved").length;

  // Loading state
  if (authLoading || isLoading || !answersLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Loading RFP data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !rfp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "RFP not found"}</p>
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:underline"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Shared Sidebar */}
      <AppSidebar activePage="rfps" />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
          {/* Left - Back and Title */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/rfp/${rfpId}`)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="font-semibold text-gray-900">RFP Preview & Export</h1>
              <p className="text-sm text-gray-500">
                {rfp.title} • {rfp.company}
                {rfp.dueDate && ` • Due ${new Date(rfp.dueDate).toLocaleDateString()}`}
              </p>
            </div>
          </div>

          {/* Right - Online status and View toggle */}
          <div className="flex items-center gap-3">
            {/* Online indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <Users size={16} />
              <span>Online</span>
            </div>

            {/* User avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
              style={{ backgroundColor: user?.color || "#3B82F6" }}
              title={user?.name}
            >
              {user?.name?.charAt(0).toUpperCase()}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("document")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "document"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <FileText size={16} />
                Document
              </button>
              <button
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === "preview"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Eye size={16} />
                Page Preview
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-12 gap-6">
              {/* Sidebar - Export Options */}
              <aside className="col-span-3 space-y-4">
                {/* Export Options */}
                <ExportOptionsPanel
                  format={format}
                  pageSettings={pageSettings}
                  onFormatChange={setFormat}
                  onPageSettingsChange={setPageSettings}
                  onExport={handleExport}
                  isExporting={isExporting}
                />

                {exportError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-600">{exportError}</p>
                  </div>
                )}

                {/* Sections Progress */}
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
                    Sections
                  </h3>
                  <div className="space-y-3">
                    {exportSections.map((section) => {
                      const answered = section.questions.filter(
                        (q) => getStatus(q.id) === "saved"
                      ).length;
                      const total = section.questions.length;
                      const percentage =
                        total > 0 ? Math.round((answered / total) * 100) : 0;

                      return (
                        <div key={section.id}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700 font-medium">
                              {section.id}. {section.title}
                            </span>
                            <span className="text-gray-500">{percentage}%</span>
                          </div>
                          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </aside>

              {/* Main Content */}
              <main className="col-span-9">
                {viewMode === "preview" ? (
                  <DocumentPreview
                    sections={exportSections}
                    getAnswer={getAnswer}
                    getStatus={getStatus}
                    pageSettings={pageSettings}
                    documentTitle={rfp.title}
                    companyName={rfp.company}
                  />
                ) : (
                  /* Document View */
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="px-8 py-6 space-y-8">
                      {/* Document Header */}
                      <div className="border-b border-gray-200 pb-4">
                        <h1 className="text-2xl font-bold text-gray-900">
                          {rfp.title}
                        </h1>
                        {rfp.company && (
                          <p className="text-gray-600 mt-1">{rfp.company}</p>
                        )}
                        <p className="text-sm text-gray-400 uppercase tracking-wide mt-2">
                          Response Document
                        </p>
                      </div>

                      {/* Sections */}
                      {exportSections.map((section) => (
                        <div key={section.id} className="space-y-6">
                          {/* Section Header */}
                          <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                            <div className="w-1 h-6 bg-blue-600 rounded-full" />
                            <h2 className="text-lg font-semibold text-gray-900">
                              Section {section.id}: {section.title}
                            </h2>
                          </div>

                          {section.questions.length === 0 ? (
                            <p className="text-sm text-gray-400 italic pl-4">
                              No questions in this section
                            </p>
                          ) : (
                            <div className="space-y-6">
                              {section.questions.map((q, qIndex) => {
                                const answer = getAnswer(q.id);
                                const hasAnswer =
                                  answer &&
                                  answer !== "<p></p>" &&
                                  answer.trim() !== "";

                                return (
                                  <div key={q.id} className="space-y-2">
                                    <h3 className="text-sm font-semibold text-gray-900">
                                      Q {section.id}.{qIndex + 1} - {q.title}
                                    </h3>
                                    <p className="text-sm text-gray-500 italic pl-4">
                                      {q.fullQuestion}
                                    </p>

                                    {hasAnswer ? (
                                      <div
                                        className="prose prose-sm max-w-none text-gray-700 pl-4 pt-2"
                                        dangerouslySetInnerHTML={{
                                          __html: answer,
                                        }}
                                      />
                                    ) : (
                                      <p className="text-sm text-gray-400 italic pl-4">
                                        No answer provided yet
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
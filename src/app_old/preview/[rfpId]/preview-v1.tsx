// src/app/preview/[rfpId]/page.tsx

"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { Rfp, Section, Question } from "@/types";
import {
  ArrowLeft,
  FileText,
  Eye,
  Loader2,
} from "lucide-react";
import ExportOptionsPanel from "@/components/ExportOptionsPanel";
import DocumentPreview from "@/components/DocumentPreview";
import { useExport } from "@/hooks/useExport";

type ViewMode = "document" | "preview";

interface PageProps {
  params: Promise<{ rfpId: string }>;
}

// Transform Section to match export format
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
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("document");

  // Store answers keyed by question ID
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

        // Fetch all answers for all questions
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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load RFP");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRfp();
  }, [isAuthenticated, rfpId]);

  // Transform sections for export format
  const exportSections: ExportSection[] = rfp?.sections?.map((section, index) => ({
    id: section.order || index + 1,
    title: section.title,
    questions: section.questions.map((q) => ({
      id: q.id,
      title: q.title,
      fullQuestion: q.fullQuestion || q.description || "",
    })),
  })) || [];

  // Get answer for a question
  const getAnswer = useCallback((questionId: string): string => {
    return answers[questionId] || "";
  }, [answers]);

  // Get status for a question (for compatibility)
  const getStatus = useCallback((questionId: string): string => {
    const answer = answers[questionId];
    if (answer && answer.trim() !== "" && answer !== "<p></p>") {
      return "saved";
    }
    return "empty";
  }, [answers]);

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
  });

  // Calculate overall stats
  const totalQuestions = exportSections.reduce(
    (sum, s) => sum + s.questions.length,
    0
  );
  const answeredQuestions = exportSections
    .flatMap((s) => s.questions)
    .filter((q) => getStatus(q.id) === "saved").length;
  const inProgressQuestions = 0; // We don't track "editing" status from this view

  const getDecisionStatus = () => {
    if (answeredQuestions === totalQuestions && totalQuestions > 0) {
      return {
        label: "Ready for Review",
        color: "bg-green-100 text-green-700",
      };
    } else if (answeredQuestions > 0) {
      return { label: "In Progress", color: "bg-yellow-100 text-yellow-700" };
    } else {
      return { label: "Not Started", color: "bg-gray-100 text-gray-700" };
    }
  };

  const decisionStatus = getDecisionStatus();

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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push(`/rfp/${rfpId}`)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  RFP Preview & Export
                </h1>
                <p className="text-sm text-gray-500">
                  {rfp.title} {rfp.company && `• ${rfp.company}`}
                </p>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
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
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Sidebar */}
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
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Sections
              </h3>
              <div className="space-y-2">
                {exportSections.map((section) => {
                  const answered = section.questions.filter(
                    (q) => getStatus(q.id) === "saved"
                  ).length;
                  const total = section.questions.length;
                  const percentage =
                    total > 0 ? Math.round((answered / total) * 100) : 0;

                  return (
                    <div
                      key={section.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-blue-600 hover:underline cursor-pointer">
                        {section.id}. {section.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">
                          {percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Document Stats */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Document Stats
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Questions:</span>
                  <span className="font-semibold">{totalQuestions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Completed:</span>
                  <span className="font-semibold text-green-600">
                    {answeredQuestions}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">In Progress:</span>
                  <span className="font-semibold text-blue-600">
                    {inProgressQuestions}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Outstanding:</span>
                  <span className="font-semibold text-gray-600">
                    {totalQuestions - answeredQuestions - inProgressQuestions}
                  </span>
                </div>
              </div>
            </div>

            {/* Review Decision */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Your Review Decision
              </h3>
              <div
                className={`px-3 py-2 rounded-lg text-sm font-medium text-center ${decisionStatus.color}`}
              >
                {decisionStatus.label}
              </div>

              {answeredQuestions === totalQuestions && totalQuestions > 0 && (
                <button className="w-full mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
                  Approve Document
                </button>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <main className="col-span-9">
            {viewMode === "preview" ? (
              /* Page Preview Mode */
              <DocumentPreview
                sections={exportSections}
                getAnswer={getAnswer}
                getStatus={getStatus}
                pageSettings={pageSettings}
                documentTitle={rfp?.title}
                companyName={rfp.company}
              />
            ) : (
              /* Document View Mode */
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-8 py-6 space-y-8">
                  {/* Document Title */}
                  <div className="border-b border-gray-200 pb-4">
                    <h1 className="text-2xl font-bold text-gray-900">{rfp.title}</h1>
                    {rfp.company && (
                      <p className="text-gray-500 mt-1">{rfp.company}</p>
                    )}
                    <p className="text-sm text-gray-400 mt-2">Response Document</p>
                  </div>

                  {exportSections.map((section) => (
                    <div key={section.id} className="space-y-6">
                      <div className="flex items-center gap-3 pb-3 border-b border-gray-200">
                        <FileText size={20} className="text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">
                          Section {section.id}: {section.title}
                        </h2>
                      </div>

                      {section.questions.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">
                          No questions in this section
                        </p>
                      ) : (
                        <div className="space-y-6">
                          {section.questions.map((q) => {
                            const answer = getAnswer(q.id);
                            const hasAnswer =
                              answer &&
                              answer !== "<p></p>" &&
                              answer.trim() !== "";

                            return (
                              <div key={q.id} className="space-y-3">
                                <div>
                                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                                    Q {section.id}.{section.questions.indexOf(q) + 1} - {q.title}
                                  </h3>
                                  <p className="text-sm text-gray-600 mb-3">
                                    {q.fullQuestion}
                                  </p>

                                  {hasAnswer ? (
                                    <div
                                      className="prose prose-sm max-w-none text-gray-700 pl-4"
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
  );
}
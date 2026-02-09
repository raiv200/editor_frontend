// src/app/(dashboard)/export/[rfpId]/page.tsx

"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import ExportOptionsPanel from "@/components/ExportOptionsPanel";
import { useExport } from "@/hooks/useExport";
import type { Rfp, Section, Question } from "@/types";
import {
  ArrowLeft,
  CheckCircle2,
  Send,
  Loader2,
  Check,
} from "lucide-react";

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

export default function ExportPage({ params }: PageProps) {
  const { rfpId } = use(params);
  const router = useRouter();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answersLoaded, setAnswersLoaded] = useState(false);

  // Submit Options
  const [submissionMethod, setSubmissionMethod] = useState("email");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [checklist, setChecklist] = useState({
    allAnswered: true,
    reviewed: true,
    supporting: true,
    quality: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch RFP data and answers
  useEffect(() => {
    if (!rfpId) return;

    const fetchData = async () => {
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

    fetchData();
  }, [rfpId]);

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

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsSubmitting(false);
    router.push(`/success/${rfpId}`);
  };

  if (isLoading || !answersLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-500">Loading RFP data...</p>
        </div>
      </div>
    );
  }

  if (error || !rfp) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "RFP not found"}</p>
          <button onClick={() => router.back()} className="text-blue-600 hover:underline">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppHeader />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/review/${rfpId}`)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
        </div>
        <div className="mt-2">
          <h1 className="text-xl font-semibold text-gray-900">Export & Submit</h1>
          <p className="text-sm text-gray-500">
            Generate final document and submit your RFP response
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Compact Approval Banner */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={24} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Document Approved!</h2>
                <p className="text-sm text-gray-500">
                  All sections have been reviewed and approved. Ready for export and submission.
                </p>
              </div>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left - Export Options with Page Settings */}
            <ExportOptionsPanel
              format={format}
              pageSettings={pageSettings}
              onFormatChange={setFormat}
              onPageSettingsChange={setPageSettings}
              onExport={handleExport}
              isExporting={isExporting}
            />

            {/* Right - Submit Response */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-5">
                <Send size={18} className="text-gray-600" />
                <h3 className="text-sm font-semibold text-gray-800">Submit Response</h3>
              </div>

              {/* RFP Details */}
              <div className="space-y-3 mb-5">
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">RFP Title</span>
                  <p className="text-sm font-medium text-gray-900">{rfp.title}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Client</span>
                  <p className="text-sm font-medium text-gray-900">{rfp.company}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Deadline</span>
                  <p className="text-sm font-medium text-gray-900">
                    {rfp.dueDate
                      ? new Date(rfp.dueDate).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        }) + " - 5:00 PM EST"
                      : "No deadline set"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">Estimated Value</span>
                  <p className="text-sm font-medium text-gray-900">$450,000</p>
                </div>
              </div>

              {/* Submission Method */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Submission Method
                </label>
                <select
                  value={submissionMethod}
                  onChange={(e) => setSubmissionMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="email">Email to Procurement@techcorp.com</option>
                  <option value="portal">Client Portal Upload</option>
                  <option value="manual">Manual Submission</option>
                </select>
              </div>

              {/* Submission Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Submission Notes
                </label>
                <textarea
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  placeholder="Add any notes about the submission..."
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Pre-Submission Checklist */}
              {/* <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pre-Submission Checklist
                </label>
                <div className="space-y-2">
                  <CheckboxOption
                    checked={checklist.allAnswered}
                    onChange={(v) => setChecklist({ ...checklist, allAnswered: v })}
                    label="All questions answered"
                  />
                  <CheckboxOption
                    checked={checklist.reviewed}
                    onChange={(v) => setChecklist({ ...checklist, reviewed: v })}
                    label="Document reviewed and approved"
                  />
                  <CheckboxOption
                    checked={checklist.supporting}
                    onChange={(v) => setChecklist({ ...checklist, supporting: v })}
                    label="Supporting documents attached"
                  />
                  <CheckboxOption
                    checked={checklist.quality}
                    onChange={(v) => setChecklist({ ...checklist, quality: v })}
                    label="Final quality check completed"
                  />
                </div>
              </div> */}

              {/* Submit Button */}
              <button
                onClick={handleSubmit}
                // disabled={isSubmitting || !Object.values(checklist).every(Boolean)}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Submit RFP Response
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Export Error */}
          {exportError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{exportError}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CheckboxOption({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-blue-600 border-blue-600" : "border-gray-300"
        }`}
      >
        {checked && <Check size={12} className="text-white" />}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}
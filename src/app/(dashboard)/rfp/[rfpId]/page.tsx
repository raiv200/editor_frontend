// src/app/(dashboard)/rfp/[rfpId]/page.tsx

"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import CollaborativeEditor from "@/components/editor/CollaborativeEditor";
import type { Rfp, Section, Question, CollaborationToken } from "@/types";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Users,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface PageProps {
  params: Promise<{ rfpId: string }>;
}

interface AnswerData {
  questionId: string;
  answer: string | null;
  answerJson: object | null;
  answeredAt: string | null;
}

export default function RfpEditorPage({ params }: PageProps) {
  const { rfpId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [collabToken, setCollabToken] = useState<CollaborationToken | null>(null);
  const [collabError, setCollabError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, AnswerData>>({});
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());

  // Fetch RFP data
  useEffect(() => {
    if (!rfpId) return;

    const fetchRfp = async () => {
      try {
        const { rfp: data } = await api.rfps.get(rfpId);
        setRfp(data);

        if (data.sections?.length) {
          setExpandedSections(data.sections.map((s: Section) => s.id));
          const firstQuestion = data.sections[0]?.questions[0];
          if (firstQuestion) {
            setActiveQuestionId(firstQuestion.id);
          }

          const answeredSet = new Set<string>();
          data.sections.forEach((section: Section) => {
            section.questions.forEach((q: Question) => {
              if (q.answer && q.answer.trim() !== "" && q.answer !== "<p></p>") {
                answeredSet.add(q.id);
              }
            });
          });
          setAnsweredQuestions(answeredSet);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load RFP");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRfp();
  }, [rfpId]);

  // Fetch collaboration token
  useEffect(() => {
    if (!rfpId) return;

    const fetchCollabToken = async () => {
      try {
        const token = await api.collaboration.getToken(rfpId);
        setCollabToken(token);
      } catch (err) {
        console.error("Collaboration token error:", err);
        setCollabError(
          err instanceof Error ? err.message : "Collaboration unavailable"
        );
      }
    };

    fetchCollabToken();
  }, [rfpId]);

  // Fetch answer when question changes
  useEffect(() => {
    if (!activeQuestionId || !rfpId) return;
    if (answers[activeQuestionId]) return;

    const fetchAnswer = async () => {
      setLoadingAnswer(true);
      try {
        const data = await api.rfps.getAnswer(rfpId, activeQuestionId);
        setAnswers((prev) => ({ ...prev, [activeQuestionId]: data }));

        if (data.answer && data.answer.trim() !== "" && data.answer !== "<p></p>") {
          setAnsweredQuestions((prev) => new Set([...prev, activeQuestionId]));
        }
      } catch (err) {
        console.error("Failed to fetch answer:", err);
        setAnswers((prev) => ({
          ...prev,
          [activeQuestionId]: {
            questionId: activeQuestionId,
            answer: null,
            answerJson: null,
            answeredAt: null,
          },
        }));
      } finally {
        setLoadingAnswer(false);
      }
    };

    fetchAnswer();
  }, [activeQuestionId, rfpId, answers]);

  // Save answer
  const handleSaveAnswer = useCallback(
    async (content: { html: string; json: object }) => {
      if (!activeQuestionId || !rfpId) {
        throw new Error("No question selected");
      }

      const result = await api.rfps.saveAnswer(rfpId, activeQuestionId, {
        answer: content.html,
        answerJson: content.json,
      });

      setAnswers((prev) => ({
        ...prev,
        [activeQuestionId]: {
          questionId: activeQuestionId,
          answer: result.answer,
          answerJson: result.answerJson,
          answeredAt: result.answeredAt,
        },
      }));

      if (content.html && content.html.trim() !== "" && content.html !== "<p></p>") {
        setAnsweredQuestions((prev) => new Set([...prev, activeQuestionId]));
      }

      console.log("✅ Answer saved for question:", activeQuestionId);
    },
    [activeQuestionId, rfpId]
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handlePreview = () => {
    router.push(`/preview/${rfpId}`);
  };

  const activeQuestion = rfp?.sections
    ?.flatMap((s) => s.questions)
    .find((q) => q.id === activeQuestionId);

  const currentAnswer = activeQuestionId ? answers[activeQuestionId] : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Error state
  if (error || !rfp) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "RFP not found"}</p>
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 hover:underline"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Header actions for RFP Editor
  const headerActions = (
    <div className="flex items-center gap-3">
      {collabToken && (
        <>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <Users size={16} />
            <span>Online</span>
          </div>

          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: collabToken.user.color }}
            title={collabToken.user.name}
          >
            {collabToken.user.name.charAt(0).toUpperCase()}
          </div>
        </>
      )}

      <button
        onClick={handlePreview}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        <Eye size={16} />
        Preview & Export
      </button>
    </div>
  );

  return (
    <>
      {/* Fixed Header */}
      <AppHeader
        title={rfp.title}
        subtitle={`${rfp.company}${rfp.dueDate ? ` • Due ${new Date(rfp.dueDate).toLocaleDateString()}` : ""}`}
        showBackButton
        backUrl="/"
        actions={headerActions}
      />

      {/* Content Area - Fixed height, no outer scroll */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Outline - Fixed, with internal scroll */}
        <aside className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
          <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h2 className="font-semibold text-gray-900">Document Outline</h2>
          </div>

          {/* Scrollable outline content */}
          <div className="flex-1 overflow-y-auto py-2">
            {rfp.sections?.map((section) => {
              const isExpanded = expandedSections.includes(section.id);
              const answered = section.questions.filter((q) =>
                answeredQuestions.has(q.id)
              ).length;
              const total = section.questions.length;

              return (
                <div key={section.id}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown size={16} className="text-gray-400" />
                      ) : (
                        <ChevronRight size={16} className="text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-700">
                        {section.order}. {section.title}
                      </span>
                    </div>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        answered === total
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {answered}/{total}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="ml-4">
                      {section.questions.map((q) => {
                        const isActive = activeQuestionId === q.id;
                        const isAnswered = answeredQuestions.has(q.id);

                        return (
                          <button
                            key={q.id}
                            onClick={() => setActiveQuestionId(q.id)}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-left ${
                              isActive
                                ? "bg-blue-50 border-l-2 border-blue-600"
                                : "hover:bg-gray-50 border-l-2 border-transparent"
                            }`}
                          >
                            {isAnswered ? (
                              <CheckCircle2
                                size={16}
                                className="text-green-500 flex-shrink-0"
                              />
                            ) : (
                              <Circle
                                size={16}
                                className="text-gray-300 flex-shrink-0"
                              />
                            )}
                            <span
                              className={`text-sm truncate ${
                                isActive
                                  ? "text-blue-700 font-medium"
                                  : "text-gray-600"
                              }`}
                            >
                              {q.title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Editor Area - Scrollable */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeQuestion ? (
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <span className="inline-block px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded-full mb-3">
                  {activeQuestion.title}
                </span>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {activeQuestion.fullQuestion}
                </h2>
                {activeQuestion.description && (
                  <p className="text-gray-500">{activeQuestion.description}</p>
                )}
                
                
              </div>

              {collabToken ? (
                loadingAnswer ? (
                  <div className="border border-gray-200 rounded-lg p-8 flex items-center justify-center bg-white">
                    <div className="flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Loading answer...</span>
                    </div>
                  </div>
                ) : (
                  <CollaborativeEditor
                    key={`editor-${activeQuestion.id}`}
                    documentName={`rfp-${rfpId}-question-${activeQuestion.id}`}
                    token={collabToken.token}
                    appId={collabToken.appId}
                    user={{
                      name: collabToken.user.name,
                      color: collabToken.user.color,
                    }}
                    placeholder="Start typing your answer..."
                    initialContent={currentAnswer?.answer || null}
                    onSave={handleSaveAnswer}
                    maxChars={activeQuestion.maxChars || 3000}
                  />
                )
              ) : collabError ? (
                <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-800">
                        Collaboration unavailable
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {collabError}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg p-8 flex items-center justify-center bg-white">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}

              {currentAnswer?.answeredAt && (
                <div className="mt-3 text-sm text-gray-500">
                  Last saved: {new Date(currentAnswer.answeredAt).toLocaleString()}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a question to start editing
            </div>
          )}
        </main>
      </div>
    </>
  );
}
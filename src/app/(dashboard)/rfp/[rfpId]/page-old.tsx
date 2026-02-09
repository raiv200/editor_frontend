// src/app/(dashboard)/rfp/[rfpId]/page.tsx

"use client";

import { useState, useEffect, use, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import DocumentOutline from "@/components/rfp/DocumentOutline";
import CollaborativeEditor from "@/components/editor/CollaborativeEditor";
import AISuggestionsPanel from "@/components/rfp/AISuggestionsPanel";
import CommentsPanel from "@/components/rfp/CommentsPanel";
import type { Rfp, Section, Question, CollaborationToken } from "@/types";
import {
  ArrowLeft,
  Users,
  FileText,
  Loader2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  MessageSquare,
  User,
  FileCheck,
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

type RightPanel = "ai" | "comments" | null;

export default function RfpEditorPage({ params }: PageProps) {
  const { rfpId } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [collabToken, setCollabToken] = useState<CollaborationToken | null>(null);
  const [collabError, setCollabError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<Record<string, AnswerData>>({});
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());

  // UI State
  const [isOutlineCollapsed, setIsOutlineCollapsed] = useState(false);
  const [rightPanel, setRightPanel] = useState<RightPanel>("ai");

  // Fetch RFP data
  useEffect(() => {
    if (!rfpId) return;

    const fetchRfp = async () => {
      try {
        const { rfp: data } = await api.rfps.get(rfpId);
        console.log("rfp Data",data)
        setRfp(data);

        if (data.sections?.length) {
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
    },
    [activeQuestionId, rfpId]
  );

  // Navigate to next question
  const handleNextQuestion = () => {
    if (!rfp?.sections || !activeQuestionId) return;

    const allQuestions = rfp.sections.flatMap((s) => s.questions);
    const currentIndex = allQuestions.findIndex((q) => q.id === activeQuestionId);

    if (currentIndex < allQuestions.length - 1) {
      setActiveQuestionId(allQuestions[currentIndex + 1].id);
    }
  };

  // Get current question info
  const activeQuestion = rfp?.sections
    ?.flatMap((s) => s.questions)
    .find((q) => q.id === activeQuestionId);

  const currentAnswer = activeQuestionId ? answers[activeQuestionId] : null;

  // Get question index info
  const getQuestionIndex = () => {
    if (!rfp?.sections || !activeQuestionId) return { current: 0, total: 0 };
    const allQuestions = rfp.sections.flatMap((s) => s.questions);
    const currentIndex = allQuestions.findIndex((q) => q.id === activeQuestionId);
    return { current: currentIndex + 1, total: allQuestions.length };
  };

  // Get current section
  const getCurrentSection = () => {
    if (!rfp?.sections || !activeQuestionId) return null;
    return rfp.sections.find((s) => s.questions.some((q) => q.id === activeQuestionId));
  };

  const questionIndex = getQuestionIndex();
  const currentSection = getCurrentSection();

  // Handle insert from AI panel
  const handleInsertContent = (content: string) => {
    // This would need to be passed to the editor
    // For now, we'll just log it - in production, use a ref to the editor
    console.log("Insert content:", content);
  };

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



  return (
    <>
      {/* Global Header */}
      <AppHeader />

      {/* RFP Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left - Back button and RFP info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{rfp.title}</h1>
              <p className="text-sm text-gray-500">
                {rfp.company}
                {rfp.dueDate && ` • Due ${new Date(rfp.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              </p>
            </div>
          </div>

          {/* Right - Online users and actions */}
          <div className="flex items-center gap-3">
            
            {/* Action Buttons */}
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Users size={16} />
              Enable Collaboration
            </button>
            <button
              onClick={() => router.push(`/review/${rfpId}`)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <FileCheck size={16} />
              Request Review
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden bg-gray-50">
        {/* Document Outline */}
        <DocumentOutline
          sections={rfp.sections || []}
          activeQuestionId={activeQuestionId}
          answeredQuestions={answeredQuestions}
          onQuestionSelect={setActiveQuestionId}
          isCollapsed={isOutlineCollapsed}
          onToggleCollapse={() => setIsOutlineCollapsed(!isOutlineCollapsed)}
        />

        {/* Question Editor Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {activeQuestion ? (
            <>
              {/* Question Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  {/* Left - Question badge and metadata */}
                  <div className="flex items-center gap-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg">
                      <FileText size={14} />
                      Question {currentSection?.order}.
                      {(rfp.sections
                        ?.find((s) => s.id === currentSection?.id)
                        ?.questions.findIndex((q) => q.id === activeQuestionId) ?? 0) + 1}
                    </span>
                  </div>

                  {/* Right - Assigned user and word limit */}
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <User size={14} />
                      Assigned to {user?.name || "Unassigned"}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} />
                      Max {activeQuestion.maxChars || 3000} characters
                    </span>
                  </div>
                </div>

                {/* Question Title and Description */}
                <div className="mt-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {activeQuestion.fullQuestion || activeQuestion.title}
                  </h2>
                  {activeQuestion.description && (
                    <p className="text-gray-600 mt-2">{activeQuestion.description}</p>
                  )}
                </div>
              </div>

              {/* Editor */}
              <div className="flex-1 overflow-hidden p-1">
                <div className="h-full max-w-5xl">
                  {collabToken ? (
                    loadingAnswer ? (
                      <div className="border border-gray-200 rounded-xl bg-white p-8 flex items-center justify-center min-h-[300px]">
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
                        placeholder="Start typing your answer or select an AI suggestion from the right panel..."
                        initialContent={currentAnswer?.answer || null}
                        onSave={handleSaveAnswer}
                        maxChars={activeQuestion.maxChars || 3000}
                        answeredAt={currentAnswer?.answeredAt}
                      />
                    )
                  ) : collabError ? (
                    <div className="border border-yellow-200 bg-yellow-50 rounded-xl p-4">
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
                    <div className="border border-gray-200 rounded-xl bg-white p-8 flex items-center justify-center min-h-[300px]">
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    </div>
                  )}

                  {/* Last saved indicator */}
                  {/* {currentAnswer?.answeredAt && (
                    <p className="text-xs text-gray-500 mt-2">
                      Last saved: {new Date(currentAnswer.answeredAt).toLocaleString()}
                    </p>
                  )} */}
                </div>
              </div>

              {/* Footer Navigation */}
              <div className="bg-white border-t border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between max-w-4xl">
                  {/* Left - Add Comment */}
                  <button
                    onClick={() => setRightPanel(rightPanel === "comments" ? "ai" : "comments")}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MessageSquare size={16} />
                    Add Comment
                  </button>

                  {/* Right - Next Question */}
                  <div className="flex items-center gap-3">
                   
                    <button
                      onClick={handleNextQuestion}
                      disabled={questionIndex.current >= questionIndex.total}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Next Question
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              Select a question to start editing
            </div>
          )}
        </main>

        {/* Right Panel - AI Suggestions or Comments */}
        {rightPanel === "ai" && activeQuestionId && (
          <AISuggestionsPanel
            questionId={activeQuestionId}
            onInsert={handleInsertContent}
          />
        )}
        {rightPanel === "comments" && activeQuestionId && (
          <CommentsPanel questionId={activeQuestionId} />
        )}

        {/* Panel Toggle Buttons (floating) */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
          <button
            onClick={() => setRightPanel(rightPanel === "ai" ? null : "ai")}
            className={`p-2 rounded-lg shadow-md transition-colors ${
              rightPanel === "ai"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
            title="AI Suggestions"
          >
            <Sparkles size={18} />
          </button>
          <button
            onClick={() => setRightPanel(rightPanel === "comments" ? null : "comments")}
            className={`p-2 rounded-lg shadow-md transition-colors ${
              rightPanel === "comments"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
            title="Comments"
          >
            <MessageSquare size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
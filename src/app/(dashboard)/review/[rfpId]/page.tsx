// src/app/(dashboard)/review/[rfpId]/page.tsx

"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import AppHeader from "@/components/layout/AppHeader";
import type { Rfp, Section, Question } from "@/types";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  Code2,
  Coins,
  BookOpen,
  Loader2,
  Check,
  Star,
  User,
  PenLine,
  ArrowRight,
} from "lucide-react";

interface PageProps {
  params: Promise<{ rfpId: string }>;
}

// ── Dummy approval data (will be API-driven later) ─────────────────────────────
const DUMMY_APPROVERS = [
  {
    id: "1",
    name: "John Doe",
    initials: "JD",
    color: "#3B82F6",
    status: "approved",
  },
  {
    id: "2",
    name: "Akshata Ken",
    initials: "AK",
    color: "#F97316",
    status: "approved",
  },
  {
    id: "3",
    name: "Abhimanyu K",
    initials: "AK",
    color: "#FB923C",
    status: "approved",
  },
  {
    id: "4",
    name: "Wayne S",
    initials: "WS",
    color: "#3B82F6",
    status: "pending",
  },
];

// Map section icons by index/name
const SECTION_ICONS: Record<string, React.ReactNode> = {
  company: <Building2 size={16} />,
  technical: <Code2 size={16} />,
  security: <Shield size={16} />,
  pricing: <Coins size={16} />,
  references: <BookOpen size={16} />,
};

function getSectionIcon(title: string): React.ReactNode {
  const lower = title.toLowerCase();
  if (lower.includes("company")) return SECTION_ICONS["company"];
  if (lower.includes("technical")) return SECTION_ICONS["technical"];
  if (lower.includes("security") || lower.includes("compliance"))
    return SECTION_ICONS["security"];
  if (lower.includes("pricing") || lower.includes("commercial"))
    return SECTION_ICONS["pricing"];
  if (lower.includes("reference")) return SECTION_ICONS["references"];
  return <FileText size={16} />;
}

// ── Approval Chain Avatars Component ───────────────────────────────────────────
function ApprovalChainAvatars() {
  return (
    <div className="flex items-center gap-1">
      {DUMMY_APPROVERS.map((member, i) => (
        <div key={member.id} className="flex items-center gap-1">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
            style={{ backgroundColor: member.color }}
          >
            {member.initials}
          </div>
          {i < DUMMY_APPROVERS.length - 1 && (
            <span className="text-[#1E293BCC]">
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Question Card Component ────────────────────────────────────────────────────
function QuestionCard({
  question,
  answer,
  sectionOrder,
  questionIndex,
}: {
  question: Question;
  answer: string;
  sectionOrder: number;
  questionIndex: number;
}) {
  const hasAnswer = answer && answer.trim() !== "" && answer !== "<p></p>";

  return (
    <div className="py-5 border-b border-gray-100 last:border-b-0">
      {/* Question Title */}
      <h4 className="text-sm font-semibold text-gray-900 mb-2">
        Q {sectionOrder}.{questionIndex + 1}{" "}
        {question.fullQuestion || question.title}
      </h4>

      {/* Answer */}
      {hasAnswer ? (
        <div
          className="text-sm text-gray-600 leading-relaxed mb-4 prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: answer }}
        />
      ) : (
        <p className="text-sm text-gray-400 italic mb-4">
          No answer provided yet
        </p>
      )}

      {/* Meta Row: Approve by → Assigned to → Last edited → Request Changes */}
      <div className="flex items-center gap-5 flex-wrap text-xs text-gray-500">
        {/* Approve by */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Approve by:</span>
          <ApprovalChainAvatars />
        </div>

        {/* Assigned to */}
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400">Assigned to:</span>
          <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-[9px] font-semibold">
            EW
          </div>
          <span className="text-gray-700">Emma Wilson</span>
        </div>

        {/* Last edited */}
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-gray-400" />
          <span>Last edited Oct 24</span>
        </div>

        {/* Request Changes */}
        <button className="flex items-center gap-1 text-orange-500 hover:text-orange-600 font-medium ml-auto transition-colors">
          <PenLine size={12} />
          <span>Request Changes</span>
        </button>
      </div>
    </div>
  );
}

// ── Main Page Component ────────────────────────────────────────────────────────
export default function ReviewPage({ params }: PageProps) {
  const { rfpId } = use(params);
  const router = useRouter();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [approvalNotes, setApprovalNotes] = useState("");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch RFP data + answers
  useEffect(() => {
    if (!rfpId) return;

    const fetchRfp = async () => {
      try {
        const { rfp: data } = await api.rfps.get(rfpId);
        setRfp(data);

        if (data.sections?.length) {
          setActiveSectionId(data.sections[0].id);

          // Fetch all answers
          const allQuestions = data.sections.flatMap(
            (s: Section) => s.questions,
          );
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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load RFP");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRfp();
  }, [rfpId]);

  // Actions
  const handleApprove = () => {
    router.push(`/export/${rfpId}`);
  };

  const handleRequestChanges = () => {
    router.push(`/rfp/${rfpId}`);
  };

  // Scroll to section
  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // Stats
  const totalQuestions =
    rfp?.sections?.reduce((sum, s) => sum + s.questions.length, 0) || 0;
  const answeredQuestions = Object.values(answers).filter(
    (a) => a && a.trim() !== "" && a !== "<p></p>",
  ).length;
  const approvedCount = DUMMY_APPROVERS.filter(
    (a) => a.status === "approved",
  ).length;
  const approvalPercentage = Math.round(
    (approvedCount / DUMMY_APPROVERS.length) * 100,
  );

  // ── Loading State ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // ── Error State ──────────────────────────────────────────────────────────────
  if (error || !rfp) {
    return (
      <div className="flex-1 flex items-center justify-center">
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
    <>
      <AppHeader />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/rfp/${rfpId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="">
            <h1 className="text-lg font-semibold text-gray-900">
              Review & Approve
            </h1>
            <p className="text-sm text-gray-500">
              Review all answers and approve the document for submission
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="max-w-[1200px] mx-auto py-8 px-6">
          {/* ── RFP Info Card ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">
              {rfp.title}
            </h2>

            <div className="flex items-center gap-5 text-sm text-gray-500 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Building2 size={14} className="text-gray-400" />
                <span>{rfp.company}</span>
              </div>
              {rfp.dueDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-400" />
                  <span>
                    Due:{" "}
                    {new Date(rfp.dueDate).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              <span className="font-medium text-gray-700">$450K</span>
              <div className="flex items-center gap-1.5 bg-green-100 rounded-full px-3 py-1">
                <div className="flex items-center justify-center w-[12px] h-[12px] rounded-full bg-green-600">
                  <Check
                    className="w-[6px] h-[6px] text-white fill-green-500/10"
                    strokeWidth={4}
                  />
                </div>
                <span className="text-green-600 font-medium text-xs">
                  100% Complete
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-100 rounded-full px-3 py-1">
                <Clock
                  className="w-[12px] h-[12px] text-amber-600"
                  strokeWidth={3}
                />

                <span className="text-amber-600 font-medium text-xs">
                  {approvalPercentage}% Approved
                </span>
              </div>
            </div>

            {/* ── Approval Progress ─────────────────────────────────────── */}

            <div className="">
              {/* Header Section - Just the Title */}
              <div className="mb-4 mt-6 px-4">
                <h2 className="text-xl font-bold text-[#1e293b]  font-i">
                  Approval Progress
                </h2>
              </div>

              {/* Main Stepper Progress - Fully Consolidated Inline */}
              <div className="w-full overflow-x-auto pb-12">
                <div className="relative flex items-start justify-between max-w-4xl px-[60px]">
                  {/* Connector Line - Gray, strictly between step centers */}
                  <div className="absolute top-[24px] left-[120px] right-[120px] h-[2px] bg-slate-200 z-0"></div>

                  {/* Steps Mapping Logic Inline */}
                  {DUMMY_APPROVERS.map((approver) => {
                    const isCompleted = approver.status === "approved";
                    return (
                      <div
                        key={approver.id}
                        className="relative flex flex-col items-center z-10 w-[120px]"
                      >
                        {/* Avatar Circle */}
                        <div
                          className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm transition-all duration-300 ${!isCompleted ? "ring-4 ring-blue-50" : ""}`}
                          style={{ backgroundColor: approver.color }}
                        >
                          {approver.initials}
                        </div>

                        {/* Name and Status Label Section */}
                        <div className="mt-4 flex flex-col items-center text-center">
                          <span className="text-sm font-bold text-slate-800 mb-1">
                            {approver.name}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {isCompleted ? (
                              <>
                                <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500">
                                  <Check
                                    className="w-[8px] h-[8px] text-white fill-green-500/10"
                                    strokeWidth={5}
                                  />
                                </div>
                                <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                                  Review Completed
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock
                                  className="w-4 h-4  text-amber-600"
                                  strokeWidth={3}
                                />

                                <span className="text-[11px] text-slate-500 font-semibold whitespace-nowrap">
                                  Review Pending
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ── Main Content: Sidebar + Sections ─────────────────────────── */}
          <div className="flex gap-6 items-start">
            {/* ── Left Sidebar ───────────────────────────────────────────── */}
            <div className="w-[280px] shrink-0 space-y-5 sticky top-8">
              {/* Sections Nav */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Sections
                </h3>
                <div className="space-y-0.5">
                  {rfp.sections?.map((section) => {
                    const isActive = activeSectionId === section.id;
                    const sectionAnswered = section.questions.filter((q) => {
                      const ans = answers[q.id];
                      return ans && ans.trim() !== "" && ans !== "<p></p>";
                    }).length;
                    const sectionTotal = section.questions.length;
                    const allAnswered = sectionAnswered === sectionTotal;

                    return (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span
                          className={
                            isActive ? "text-blue-600" : "text-gray-400"
                          }
                        >
                          {getSectionIcon(section.title)}
                        </span>
                        <span className="flex-1 text-left truncate">
                          {section.title}
                        </span>

                        {/* Answered count badge */}
                        <span
                          className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                            allAnswered
                              ? "bg-green-50 text-green-600"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {sectionAnswered}/{sectionTotal}
                        </span>

                        {/* Blue filled checkmark */}
                        {allAnswered && (
                          <CheckCircle2
                            size={16}
                            className="text-blue-500 shrink-0 fill-blue-500 stroke-white"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Document Stats */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">
                  Document Stats
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Total Questions:</span>
                    <span className="font-semibold text-gray-900">
                      {totalQuestions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Answered:</span>
                    <span className="font-semibold text-gray-900">
                      {answeredQuestions}/{totalQuestions}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Comments:</span>
                    <span className="font-semibold text-gray-900">
                      8 resolved
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Contributors:</span>
                    <span className="font-semibold text-gray-900">
                      4 members
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: All Sections + Questions (scrollable) ───────────── */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                {rfp.sections?.map((section, sIndex) => (
                  <div
                    key={section.id}
                    ref={(el) => {
                      sectionRefs.current[section.id] = el;
                    }}
                    className="mb-8 last:mb-0"
                  >
                    {/* Section Header */}
                    <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                      Section {section.order || sIndex + 1}: {section.title}
                    </h3>

                    {/* Questions */}
                    {section.questions.map((question, qIndex) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        answer={answers[question.id] || ""}
                        sectionOrder={section.order || sIndex + 1}
                        questionIndex={qIndex}
                      />
                    ))}
                  </div>
                ))}

                {/* ── Your Review Decision ───────────────────────────────── */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">
                    Your Review Decision
                  </h3>

                  <div className="flex items-center gap-3 mb-6">
                    <button
                      onClick={handleRequestChanges}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
                    >
                      <PenLine size={14} />
                      Request Changes
                    </button>
                    <button
                      onClick={handleApprove}
                      className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Check size={14} />
                      Approve Document
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Approval Notes (Optional)
                    </label>
                    <textarea
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add any comments or feedback..."
                      rows={4}
                      className="w-full px-4 py-3 text-sm text-gray-700 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// // src/app/(dashboard)/review/[rfpId]/page.tsx

// "use client";

// import { useState, useEffect, use, useRef } from "react";
// import { useRouter } from "next/navigation";
// import { api } from "@/lib/api";
// import AppHeader from "@/components/layout/AppHeader";
// import type { Rfp, Section, Question } from "@/types";
// import {
//   ArrowLeft,
//   Building2,
//   Calendar,
//   DollarSign,
//   CheckCircle2,
//   Clock,
//   FileText,
//   Shield,
//   Code2,
//   Coins,
//   BookOpen,
//   Loader2,
//   Check,
//   Star,
//   User,
//   PenLine,
// } from "lucide-react";

// interface PageProps {
//   params: Promise<{ rfpId: string }>;
// }

// // ── Dummy approval data (will be API-driven later) ─────────────────────────────
// const DUMMY_APPROVERS = [
//   { id: "1", name: "John Doe", initials: "JD", color: "#3B82F6", status: "approved" },
//   { id: "2", name: "Akshata Ken", initials: "AK", color: "#F97316", status: "approved" },
//   { id: "3", name: "Abhimanyu K", initials: "AK", color: "#FB923C", status: "approved" },
//   { id: "4", name: "Wayne S", initials: "WS", color: "#3B82F6", status: "pending" },
// ];

// // Map section icons by index/name
// const SECTION_ICONS: Record<string, React.ReactNode> = {
//   "company": <Building2 size={16} />,
//   "technical": <Code2 size={16} />,
//   "security": <Shield size={16} />,
//   "pricing": <Coins size={16} />,
//   "references": <BookOpen size={16} />,
// };

// function getSectionIcon(title: string): React.ReactNode {
//   const lower = title.toLowerCase();
//   if (lower.includes("company")) return SECTION_ICONS["company"];
//   if (lower.includes("technical")) return SECTION_ICONS["technical"];
//   if (lower.includes("security") || lower.includes("compliance")) return SECTION_ICONS["security"];
//   if (lower.includes("pricing") || lower.includes("commercial")) return SECTION_ICONS["pricing"];
//   if (lower.includes("reference")) return SECTION_ICONS["references"];
//   return <FileText size={16} />;
// }

// // ── Approval Chain Avatars Component ───────────────────────────────────────────
// function ApprovalChainAvatars() {
//   return (
//     <div className="flex items-center">
//       {DUMMY_APPROVERS.map((member, i) => (
//         <div key={member.id} className="flex items-center">
//           <div
//             className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold border-2 border-white"
//             style={{
//               backgroundColor: member.color,
//               marginLeft: i > 0 ? "-6px" : "0",
//             }}
//           >
//             {member.initials}
//           </div>
//           {i < DUMMY_APPROVERS.length - 1 && (
//             <span className="text-gray-300 text-xs mx-0.5">→</span>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }

// // ── Question Card Component ────────────────────────────────────────────────────
// function QuestionCard({
//   question,
//   answer,
//   sectionOrder,
//   questionIndex,
// }: {
//   question: Question;
//   answer: string;
//   sectionOrder: number;
//   questionIndex: number;
// }) {
//   const hasAnswer = answer && answer.trim() !== "" && answer !== "<p></p>";

//   return (
//     <div className="py-5 border-b border-gray-100 last:border-b-0">
//       {/* Question Title */}
//       <h4 className="text-sm font-semibold text-gray-900 mb-2">
//         Q {sectionOrder}.{questionIndex + 1}{" "}
//         {question.fullQuestion || question.title}
//       </h4>

//       {/* Answer */}
//       {hasAnswer ? (
//         <div
//           className="text-sm text-gray-600 leading-relaxed mb-4 prose prose-sm max-w-none"
//           dangerouslySetInnerHTML={{ __html: answer }}
//         />
//       ) : (
//         <p className="text-sm text-gray-400 italic mb-4">
//           No answer provided yet
//         </p>
//       )}

//       {/* Meta Row: Approve by → Assigned to → Last edited → Request Changes */}
//       <div className="flex items-center gap-5 flex-wrap text-xs text-gray-500">
//         {/* Approve by */}
//         <div className="flex items-center gap-1.5">
//           <span className="text-gray-400">Approve by:</span>
//           <ApprovalChainAvatars />
//         </div>

//         {/* Assigned to */}
//         <div className="flex items-center gap-1.5">
//           <span className="text-gray-400">Assigned to:</span>
//           <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-white text-[9px] font-semibold">
//             EW
//           </div>
//           <span className="text-gray-700">Emma Wilson</span>
//         </div>

//         {/* Last edited */}
//         <div className="flex items-center gap-1.5">
//           <Calendar size={12} className="text-gray-400" />
//           <span>Last edited Oct 24</span>
//         </div>

//         {/* Request Changes */}
//         <button className="flex items-center gap-1 text-orange-500 hover:text-orange-600 font-medium ml-auto transition-colors">
//           <PenLine size={12} />
//           <span>Request Changes</span>
//         </button>
//       </div>
//     </div>
//   );
// }

// // ── Main Page Component ────────────────────────────────────────────────────────
// export default function ReviewPage({ params }: PageProps) {
//   const { rfpId } = use(params);
//   const router = useRouter();

//   const [rfp, setRfp] = useState<Rfp | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [answers, setAnswers] = useState<Record<string, string>>({});
//   const [approvalNotes, setApprovalNotes] = useState("");
//   const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

//   const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

//   // Fetch RFP data + answers
//   useEffect(() => {
//     if (!rfpId) return;

//     const fetchRfp = async () => {
//       try {
//         const { rfp: data } = await api.rfps.get(rfpId);
//         setRfp(data);

//         if (data.sections?.length) {
//           setActiveSectionId(data.sections[0].id);

//           // Fetch all answers
//           const allQuestions = data.sections.flatMap((s: Section) => s.questions);
//           const answerPromises = allQuestions.map(async (q: Question) => {
//             try {
//               const answerData = await api.rfps.getAnswer(rfpId, q.id);
//               return { questionId: q.id, answer: answerData.answer || "" };
//             } catch {
//               return { questionId: q.id, answer: "" };
//             }
//           });

//           const answersArray = await Promise.all(answerPromises);
//           const answersMap: Record<string, string> = {};
//           answersArray.forEach(({ questionId, answer }) => {
//             answersMap[questionId] = answer;
//           });
//           setAnswers(answersMap);
//         }
//       } catch (err) {
//         setError(err instanceof Error ? err.message : "Failed to load RFP");
//       } finally {
//         setIsLoading(false);
//       }
//     };

//     fetchRfp();
//   }, [rfpId]);

//   // Actions
//   const handleApprove = () => {
//     router.push(`/export/${rfpId}`);
//   };

//   const handleRequestChanges = () => {
//     router.push(`/rfp/${rfpId}`);
//   };

//   // Scroll to section
//   const scrollToSection = (sectionId: string) => {
//     setActiveSectionId(sectionId);
//     const el = sectionRefs.current[sectionId];
//     if (el) {
//       el.scrollIntoView({ behavior: "smooth", block: "start" });
//     }
//   };

//   // Stats
//   const totalQuestions =
//     rfp?.sections?.reduce((sum, s) => sum + s.questions.length, 0) || 0;
//   const answeredQuestions = Object.values(answers).filter(
//     (a) => a && a.trim() !== "" && a !== "<p></p>"
//   ).length;
//   const approvedCount = DUMMY_APPROVERS.filter(
//     (a) => a.status === "approved"
//   ).length;
//   const approvalPercentage = Math.round(
//     (approvedCount / DUMMY_APPROVERS.length) * 100
//   );

//   // ── Loading State ────────────────────────────────────────────────────────────
//   if (isLoading) {
//     return (
//       <div className="flex-1 flex items-center justify-center">
//         <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
//       </div>
//     );
//   }

//   // ── Error State ──────────────────────────────────────────────────────────────
//   if (error || !rfp) {
//     return (
//       <div className="flex-1 flex items-center justify-center">
//         <div className="text-center">
//           <p className="text-red-600 mb-4">{error || "RFP not found"}</p>
//           <button
//             onClick={() => router.back()}
//             className="text-blue-600 hover:underline"
//           >
//             Go Back
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       <AppHeader />

//       <div className="flex-1 overflow-y-auto bg-gray-50">
//         <div className="max-w-[1200px] mx-auto py-8 px-6">
//           {/* ── Back Arrow + Page Title ───────────────────────────────────── */}
//           <div className="flex items-center gap-3 mb-6">
//             <button
//               onClick={() => router.push(`/rfp/${rfpId}`)}
//               className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-200 transition-colors text-gray-600"
//             >
//               <ArrowLeft size={20} />
//             </button>
//             <div>
//               <h1 className="text-2xl font-bold text-gray-900">
//                 Review &amp; Approve
//               </h1>
//               <p className="text-sm text-blue-500 mt-0.5">
//                 Review all answers and approve the document for submission
//               </p>
//             </div>
//           </div>

//           {/* ── RFP Info Card ─────────────────────────────────────────────── */}
//           <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
//             <h2 className="text-lg font-bold text-gray-900 mb-2">
//               {rfp.title}
//             </h2>

//             <div className="flex items-center gap-5 text-sm text-gray-500 flex-wrap">
//               <div className="flex items-center gap-1.5">
//                 <Building2 size={14} className="text-gray-400" />
//                 <span>{rfp.company}</span>
//               </div>
//               {rfp.dueDate && (
//                 <div className="flex items-center gap-1.5">
//                   <Calendar size={14} className="text-gray-400" />
//                   <span>
//                     Due:{" "}
//                     {new Date(rfp.dueDate).toLocaleDateString("en-US", {
//                       month: "short",
//                       day: "numeric",
//                       year: "numeric",
//                     })}
//                   </span>
//                 </div>
//               )}
//               <span className="font-medium text-gray-700">$450K</span>
//               <div className="flex items-center gap-1.5">
//                 <span className="w-2 h-2 rounded-full bg-green-500" />
//                 <span className="text-green-600 font-medium">
//                   100% Complete
//                 </span>
//               </div>
//               <div className="flex items-center gap-1.5">
//                 <span className="w-2 h-2 rounded-full bg-amber-500" />
//                 <span className="text-amber-600 font-medium">
//                   {approvalPercentage}% Approved
//                 </span>
//               </div>
//             </div>

//             {/* ── Approval Progress ─────────────────────────────────────── */}
//             <div className="mt-6">
//               <h3 className="text-sm font-semibold text-gray-700 mb-5">
//                 Approval Progress
//               </h3>
//               <div className="flex items-start gap-12">
//                 {DUMMY_APPROVERS.map((approver) => (
//                   <div
//                     key={approver.id}
//                     className="flex flex-col items-center gap-2"
//                   >
//                     <div className="relative">
//                       <div
//                         className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
//                         style={{ backgroundColor: approver.color }}
//                       >
//                         {approver.initials}
//                       </div>
//                       {/* Status badge on avatar */}
//                       {approver.status === "approved" ? (
//                         <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
//                           <Check size={10} className="text-white" />
//                         </div>
//                       ) : (
//                         <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white">
//                           <Clock size={10} className="text-white" />
//                         </div>
//                       )}
//                     </div>
//                     <p className="text-sm font-medium text-gray-900">
//                       {approver.name}
//                     </p>
//                     <div className="flex items-center gap-1">
//                       <span
//                         className={`w-1.5 h-1.5 rounded-full ${
//                           approver.status === "approved"
//                             ? "bg-green-500"
//                             : "bg-amber-400"
//                         }`}
//                       />
//                       <span
//                         className={`text-xs ${
//                           approver.status === "approved"
//                             ? "text-green-600"
//                             : "text-amber-600"
//                         }`}
//                       >
//                         {approver.status === "approved"
//                           ? "Review Completed"
//                           : "Review Pending"}
//                       </span>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* ── Main Content: Sidebar + Sections ─────────────────────────── */}
//           <div className="flex gap-6 items-start">
//             {/* ── Left Sidebar ───────────────────────────────────────────── */}
//             <div className="w-[280px] shrink-0 space-y-5 sticky top-8">
//               {/* Sections Nav */}
//               <div className="bg-white rounded-xl border border-gray-200 p-5">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-3">
//                   Sections
//                 </h3>
//                 <div className="space-y-0.5">
//                   {rfp.sections?.map((section) => {
//                     const isActive = activeSectionId === section.id;
//                     const sectionAnswered = section.questions.filter((q) => {
//                       const ans = answers[q.id];
//                       return ans && ans.trim() !== "" && ans !== "<p></p>";
//                     }).length;
//                     const sectionTotal = section.questions.length;
//                     const allAnswered = sectionAnswered === sectionTotal;

//                     return (
//                       <button
//                         key={section.id}
//                         onClick={() => scrollToSection(section.id)}
//                         className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
//                           isActive
//                             ? "bg-blue-50 text-blue-700 font-medium"
//                             : "text-gray-700 hover:bg-gray-50"
//                         }`}
//                       >
//                         <span
//                           className={
//                             isActive ? "text-blue-600" : "text-gray-400"
//                           }
//                         >
//                           {getSectionIcon(section.title)}
//                         </span>
//                         <span className="flex-1 text-left truncate">
//                           {section.title}
//                         </span>

//                         {/* Answered count badge */}
//                         <span
//                           className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
//                             allAnswered
//                               ? "bg-green-50 text-green-600"
//                               : "bg-gray-100 text-gray-500"
//                           }`}
//                         >
//                           {sectionAnswered}/{sectionTotal}
//                         </span>

//                         {/* Blue filled checkmark */}
//                         {allAnswered && (
//                           <CheckCircle2
//                             size={16}
//                             className="text-blue-500 shrink-0 fill-blue-500 stroke-white"
//                           />
//                         )}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {/* Document Stats */}
//               <div className="bg-white rounded-xl border border-gray-200 p-5">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-4">
//                   Document Stats
//                 </h3>
//                 <div className="space-y-3 text-sm">
//                   <div className="flex items-center justify-between">
//                     <span className="text-gray-500">Total Questions:</span>
//                     <span className="font-semibold text-gray-900">
//                       {totalQuestions}
//                     </span>
//                   </div>
//                   <div className="flex items-center justify-between">
//                     <span className="text-gray-500">Answered:</span>
//                     <span className="font-semibold text-gray-900">
//                       {answeredQuestions}/{totalQuestions}
//                     </span>
//                   </div>
//                   <div className="flex items-center justify-between">
//                     <span className="text-gray-500">Comments:</span>
//                     <span className="font-semibold text-gray-900">
//                       8 resolved
//                     </span>
//                   </div>
//                   <div className="flex items-center justify-between">
//                     <span className="text-gray-500">Contributors:</span>
//                     <span className="font-semibold text-gray-900">
//                       4 members
//                     </span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* ── Right: All Sections + Questions (scrollable) ───────────── */}
//             <div className="flex-1 min-w-0">
//               <div className="bg-white rounded-xl border border-gray-200 p-6">
//                 {rfp.sections?.map((section, sIndex) => (
//                   <div
//                     key={section.id}
//                     ref={(el) => {
//                       sectionRefs.current[section.id] = el;
//                     }}
//                     className="mb-8 last:mb-0"
//                   >
//                     {/* Section Header */}
//                     <h3 className="text-lg font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
//                       Section {section.order || sIndex + 1}: {section.title}
//                     </h3>

//                     {/* Questions */}
//                     {section.questions.map((question, qIndex) => (
//                       <QuestionCard
//                         key={question.id}
//                         question={question}
//                         answer={answers[question.id] || ""}
//                         sectionOrder={section.order || sIndex + 1}
//                         questionIndex={qIndex}
//                       />
//                     ))}
//                   </div>
//                 ))}

//                 {/* ── Your Review Decision ───────────────────────────────── */}
//                 <div className="mt-8 pt-6 border-t border-gray-200">
//                   <h3 className="text-base font-semibold text-gray-900 mb-4">
//                     Your Review Decision
//                   </h3>

//                   <div className="flex items-center gap-3 mb-6">
//                     <button
//                       onClick={handleRequestChanges}
//                       className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 transition-colors"
//                     >
//                       <PenLine size={14} />
//                       Request Changes
//                     </button>
//                     <button
//                       onClick={handleApprove}
//                       className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
//                     >
//                       <Check size={14} />
//                       Approve Document
//                     </button>
//                   </div>

//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-2">
//                       Approval Notes (Optional)
//                     </label>
//                     <textarea
//                       value={approvalNotes}
//                       onChange={(e) => setApprovalNotes(e.target.value)}
//                       placeholder="Add any comments or feedback..."
//                       rows={4}
//                       className="w-full px-4 py-3 text-sm text-gray-700 border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400"
//                     />
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }

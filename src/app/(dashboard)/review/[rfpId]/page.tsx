// src/app/(dashboard)/review/[rfpId]/page.tsx

"use client";

import { useState, useEffect, use } from "react";
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
  Loader2,
  X,
  Check,
  Star,
  User,
} from "lucide-react";

interface PageProps {
  params: Promise<{ rfpId: string }>;
}

const DUMMY_APPROVERS = [
  { id: "1", name: "John Doe", initials: "JD", color: "#3B82F6", status: "approved" },
  { id: "2", name: "Alice Smith", initials: "AS", color: "#10B981", status: "approved" },
  { id: "3", name: "Bob Wilson", initials: "BW", color: "#F59E0B", status: "approved" },
  { id: "4", name: "Emma Wilson", initials: "EW", color: "#6366F1", status: "pending" },
];

export default function ReviewPage({ params }: PageProps) {
  const { rfpId } = use(params);
  const router = useRouter();

  const [rfp, setRfp] = useState<Rfp | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [approvalNotes, setApprovalNotes] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (!rfpId) return;

    const fetchRfp = async () => {
      try {
        const { rfp: data } = await api.rfps.get(rfpId);
        setRfp(data);

        if (data.sections?.length) {
          setActiveSection(data.sections[0].id);

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
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load RFP");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRfp();
  }, [rfpId]);

  const handleApprove = () => {
    router.push(`/export/${rfpId}`);
  };

  const handleRequestChanges = () => {
    router.push(`/rfp/${rfpId}`);
  };

  const totalQuestions = rfp?.sections?.reduce((sum, s) => sum + s.questions.length, 0) || 0;
  const answeredQuestions = Object.values(answers).filter(
    (a) => a && a.trim() !== "" && a !== "<p></p>"
  ).length;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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

      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`/rfp/${rfpId}`)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Review & Approve</h1>
            <p className="text-sm text-gray-500">
              Review all answers and approve the document for submission
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* RFP Info Card */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">{rfp.title}</h2>

            <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
              <span className="flex items-center gap-1.5">
                <Building2 size={16} className="text-gray-400" />
                {rfp.company}
              </span>
              {rfp.dueDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar size={16} className="text-gray-400" />
                  Due: {new Date(rfp.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <DollarSign size={16} className="text-gray-400" />
                $450K
              </span>
              <span className="flex items-center gap-1.5 text-green-600 font-medium">
                <CheckCircle2 size={16} />
                100% Complete
              </span>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Approval Progress</h3>
              <div className="flex items-center gap-6">
                {DUMMY_APPROVERS.map((approver) => (
                  <div key={approver.id} className="flex flex-col items-center gap-2">
                    <div className="relative">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: approver.color }}
                      >
                        {approver.initials}
                      </div>
                      {approver.status === "approved" ? (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                          <Check size={12} className="text-white" />
                        </div>
                      ) : (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                          <Clock size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-gray-600">{approver.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left Sidebar */}
            <div className="col-span-4 space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Sections</h3>
                <div className="space-y-2">
                  {rfp.sections?.map((section) => {
                    const sectionAnswered = section.questions.filter(
                      (q) => answers[q.id] && answers[q.id].trim() !== "" && answers[q.id] !== "<p></p>"
                    ).length;
                    const isComplete = sectionAnswered === section.questions.length;

                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                          activeSection === section.id
                            ? "bg-blue-50 text-blue-700"
                            : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-gray-400" />
                          <span className="text-sm font-medium">{section.title}</span>
                        </div>
                        {isComplete && <CheckCircle2 size={16} className="text-green-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Document Stats</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Questions:</span>
                    <span className="font-medium text-gray-900">{totalQuestions}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Answered:</span>
                    <span className="font-medium text-gray-900">{answeredQuestions}/{totalQuestions}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Comments:</span>
                    <span className="font-medium text-gray-900">8 resolved</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Contributors:</span>
                    <span className="font-medium text-gray-900">4 members</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="col-span-8 bg-white rounded-xl border border-gray-200 p-6">
              {rfp.sections?.map((section) => (
                <div key={section.id} className={activeSection === section.id ? "block" : "hidden"}>
                  <h2 className="text-lg font-semibold text-gray-900 mb-6">
                    Section {section.order}: {section.title}
                  </h2>

                  <div className="space-y-8">
                    {section.questions.map((q, qIndex) => {
                      const answer = answers[q.id];
                      const hasAnswer = answer && answer.trim() !== "" && answer !== "<p></p>";

                      return (
                        <div key={q.id} className="space-y-3">
                          <h3 className="text-sm font-semibold text-gray-900">
                            Q {section.order}.{qIndex + 1} {q.fullQuestion || q.title}
                          </h3>

                          {hasAnswer ? (
                            <div
                              className="prose prose-sm max-w-none text-gray-700 [&_ol]:list-decimal [&_ol]:ml-4 [&_ul]:list-disc [&_ul]:ml-4 [&_li]:my-1"
                              dangerouslySetInnerHTML={{ __html: answer }}
                            />
                          ) : (
                            <p className="text-sm text-gray-400 italic">No answer provided yet</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                            <span className="flex items-center gap-1">
                              <User size={12} />
                              Emma Wilson
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              Last edited Oct 24
                            </span>
                            <span className="flex items-center gap-1 text-green-600">
                              <Star size={12} />
                              AI Rating: 9/10
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Review Decision */}
                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">Your Review Decision</h3>

                    <div className="flex items-center gap-3 mb-4">
                      <button
                        onClick={handleRequestChanges}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <X size={16} />
                        Request Changes
                      </button>
                      <button
                        onClick={handleApprove}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <Check size={16} />
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
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}





















// // src/app/(dashboard)/review/[rfpId]/page.tsx

// "use client";

// import { useState, useEffect, use } from "react";
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
//   Circle,
//   FileText,
//   Loader2,
//   X,
//   Check,
//   Star,
//   User,
// } from "lucide-react";

// interface PageProps {
//   params: Promise<{ rfpId: string }>;
// }

// const DUMMY_APPROVERS = [
//   { id: "1", name: "John Doe", initials: "JD", color: "#3B82F6", status: "approved" },
//   { id: "2", name: "Alice Smith", initials: "AS", color: "#10B981", status: "approved" },
//   { id: "3", name: "Bob Wilson", initials: "BW", color: "#F59E0B", status: "approved" },
//   { id: "4", name: "Emma Wilson", initials: "EW", color: "#6366F1", status: "pending" },
// ];

// export default function ReviewPage({ params }: PageProps) {
//   const { rfpId } = use(params);
//   const router = useRouter();

//   const [rfp, setRfp] = useState<Rfp | null>(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState<string | null>(null);
//   const [answers, setAnswers] = useState<Record<string, string>>({});
//   const [approvalNotes, setApprovalNotes] = useState("");
//   const [activeSection, setActiveSection] = useState<string | null>(null);

//   useEffect(() => {
//     if (!rfpId) return;

//     const fetchRfp = async () => {
//       try {
//         const { rfp: data } = await api.rfps.get(rfpId);
//         setRfp(data);

//         if (data.sections?.length) {
//           setActiveSection(data.sections[0].id);

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

//   const handleApprove = () => {
//     router.push(`/export/${rfpId}`);
//   };

//   const handleRequestChanges = () => {
//     router.push(`/rfp/${rfpId}`);
//   };

//   const totalQuestions = rfp?.sections?.reduce((sum, s) => sum + s.questions.length, 0) || 0;
//   const answeredQuestions = Object.values(answers).filter(
//     (a) => a && a.trim() !== "" && a !== "<p></p>"
//   ).length;

//   if (isLoading) {
//     return (
//       <div className="flex-1 flex items-center justify-center">
//         <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
//       </div>
//     );
//   }

//   if (error || !rfp) {
//     return (
//       <div className="flex-1 flex items-center justify-center">
//         <div className="text-center">
//           <p className="text-red-600 mb-4">{error || "RFP not found"}</p>
//           <button onClick={() => router.back()} className="text-blue-600 hover:underline">
//             Go Back
//           </button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <>
//       <AppHeader />

//       <div className="bg-white border-b border-gray-200 px-6 py-4">
//         <div className="flex items-center gap-4">
//           <button
//             onClick={() => router.push(`/rfp/${rfpId}`)}
//             className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
//           >
//             <ArrowLeft size={20} className="text-gray-600" />
//           </button>
//           <div>
//             <h1 className="text-xl font-semibold text-gray-900">Review & Approve</h1>
//             <p className="text-sm text-gray-500">
//               Review all answers and approve the document for submission
//             </p>
//           </div>
//         </div>
//       </div>

//       <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
//         <div className="max-w-6xl mx-auto space-y-6">
//           {/* RFP Info Card */}
//           <div className="bg-white rounded-xl border border-gray-200 p-6">
//             <h2 className="text-lg font-semibold text-gray-900 mb-4">{rfp.title}</h2>

//             <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
//               <span className="flex items-center gap-1.5">
//                 <Building2 size={16} className="text-gray-400" />
//                 {rfp.company}
//               </span>
//               {rfp.dueDate && (
//                 <span className="flex items-center gap-1.5">
//                   <Calendar size={16} className="text-gray-400" />
//                   Due: {new Date(rfp.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
//                 </span>
//               )}
//               <span className="flex items-center gap-1.5">
//                 <DollarSign size={16} className="text-gray-400" />
//                 $450K
//               </span>
//               <span className="flex items-center gap-1.5 text-green-600 font-medium">
//                 <CheckCircle2 size={16} />
//                 100% Complete
//               </span>
//             </div>

//             <div>
//               <h3 className="text-sm font-medium text-gray-700 mb-3">Approval Progress</h3>
//               <div className="flex items-center gap-6">
//                 {DUMMY_APPROVERS.map((approver) => (
//                   <div key={approver.id} className="flex flex-col items-center gap-2">
//                     <div className="relative">
//                       <div
//                         className="w-12 h-12 rounded-full flex items-center justify-center text-white text-sm font-medium"
//                         style={{ backgroundColor: approver.color }}
//                       >
//                         {approver.initials}
//                       </div>
//                       {approver.status === "approved" ? (
//                         <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
//                           <Check size={12} className="text-white" />
//                         </div>
//                       ) : (
//                         <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
//                           <Clock size={12} className="text-white" />
//                         </div>
//                       )}
//                     </div>
//                     <span className="text-xs text-gray-600">{approver.name}</span>
//                   </div>
//                 ))}
//               </div>
//             </div>
//           </div>

//           {/* Main Content Grid */}
//           <div className="grid grid-cols-12 gap-6">
//             {/* Left Sidebar */}
//             <div className="col-span-4 space-y-4">
//               <div className="bg-white rounded-xl border border-gray-200 p-4">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-3">Sections</h3>
//                 {/* <div className="space-y-2">
//                   {rfp.sections?.map((section) => {
//                     const sectionAnswered = section.questions.filter(
//                       (q) => answers[q.id] && answers[q.id].trim() !== "" && answers[q.id] !== "<p></p>"
//                     ).length;
//                     const isComplete = sectionAnswered === section.questions.length;

//                     return (
//                       <button
//                         key={section.id}
//                         onClick={() => setActiveSection(section.id)}
//                         className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
//                           activeSection === section.id
//                             ? "bg-blue-50 text-blue-700"
//                             : "hover:bg-gray-50 text-gray-700"
//                         }`}
//                       >
//                         <div className="flex items-center gap-2">
//                           <FileText size={16} className="text-gray-400" />
//                           <span className="text-sm font-medium">{section.title}</span>
//                         </div>
//                         {isComplete && <CheckCircle2 size={16} className="text-green-500" />}
//                       </button>
//                     );
//                   })}
//                 </div> */}
//                  <div className="space-y-2">
//                   {rfp.sections?.map((section) => {
//                     const total = section.questions.length;

// const answered = section.questions.filter(
//   (q) =>
//     answers[q.id] &&
//     answers[q.id].trim() !== "" &&
//     answers[q.id] !== "<p></p>"
// ).length;

// const status =
//   answered === 0
//     ? "not_started"
//     : answered === total
//     ? "complete"
//     : "in_progress";


//                     return (
//                       <button
//                         key={section.id}
//                         onClick={() => setActiveSection(section.id)}
//                         className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
//                           activeSection === section.id
//                             ? "bg-blue-50 text-blue-700"
//                             : "hover:bg-gray-50 text-gray-700"
//                         }`}
//                       >
//                         <div className="flex items-center gap-2">
//                           <FileText size={16} className="text-gray-400" />
//                           <span className="text-sm font-medium">{section.title}</span>
//                         </div>
//                         <div className="flex items-center gap-2">
//   {status === "complete" && (
//     <CheckCircle2 size={16} className="text-green-500" />
//   )}

//   {status === "in_progress" && (
//     <Clock size={16} className="text-yellow-500" />
//   )}

//   {status === "not_started" && (
//     <Circle size={16} className="text-gray-300" />
//   )}
// </div>

//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               <div className="bg-white rounded-xl border border-gray-200 p-4">
//                 <h3 className="text-sm font-semibold text-gray-900 mb-3">Document Stats</h3>
//                 <div className="space-y-3">
//                   <div className="flex items-center justify-between text-sm">
//                     <span className="text-gray-600">Total Questions:</span>
//                     <span className="font-medium text-gray-900">{totalQuestions}</span>
//                   </div>
//                   <div className="flex items-center justify-between text-sm">
//                     <span className="text-gray-600">Answered:</span>
//                     <span className="font-medium text-gray-900">{answeredQuestions}/{totalQuestions}</span>
//                   </div>
//                   <div className="flex items-center justify-between text-sm">
//                     <span className="text-gray-600">Comments:</span>
//                     <span className="font-medium text-gray-900">8 resolved</span>
//                   </div>
//                   <div className="flex items-center justify-between text-sm">
//                     <span className="text-gray-600">Contributors:</span>
//                     <span className="font-medium text-gray-900">4 members</span>
//                   </div>
//                 </div>
//               </div>
//             </div>

//             {/* Right Content */}
//             <div className="col-span-8 bg-white rounded-xl border border-gray-200 p-6">
//               {rfp.sections?.map((section) => (
//                 <div key={section.id} className={activeSection === section.id ? "block" : "hidden"}>
//                   <h2 className="text-lg font-semibold text-gray-900 mb-6">
//                     Section {section.order}: {section.title}
//                   </h2>

//                   <div className="space-y-8">
//                     {section.questions.map((q, qIndex) => {
//                       const answer = answers[q.id];
//                       const hasAnswer = answer && answer.trim() !== "" && answer !== "<p></p>";

//                       return (
//                         <div key={q.id} className="space-y-3">
//                           <h3 className="text-sm font-semibold text-gray-900">
//                             Q {section.order}.{qIndex + 1} {q.fullQuestion || q.title}
//                           </h3>

//                           {hasAnswer ? (
//                             <div
//                               className="prose prose-sm max-w-none text-gray-700"
//                               dangerouslySetInnerHTML={{ __html: answer }}
//                             />
//                           ) : (
//                             <p className="text-sm text-gray-400 italic">No answer provided yet</p>
//                           )}

//                           <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
//                             <span className="flex items-center gap-1">
//                               <User size={12} />
//                               Emma Wilson
//                             </span>
//                             <span className="flex items-center gap-1">
//                               <Calendar size={12} />
//                               Last edited Oct 24
//                             </span>
//                             <span className="flex items-center gap-1 text-green-600">
//                               <Star size={12} />
//                               AI Rating: 9/10
//                             </span>
//                           </div>
//                         </div>
//                       );
//                     })}
//                   </div>

//                   {/* Review Decision */}
//                   <div className="mt-8 pt-6 border-t border-gray-200">
//                     <h3 className="text-sm font-semibold text-gray-900 mb-4">Your Review Decision</h3>

//                     <div className="flex items-center gap-3 mb-4">
//                       <button
//                         onClick={handleRequestChanges}
//                         className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
//                       >
//                         <X size={16} />
//                         Request Changes
//                       </button>
//                       <button
//                         onClick={handleApprove}
//                         className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
//                       >
//                         <Check size={16} />
//                         Approve Document
//                       </button>
//                     </div>

//                     <div>
//                       <label className="block text-sm font-medium text-gray-700 mb-2">
//                         Approval Notes (Optional)
//                       </label>
//                       <textarea
//                         value={approvalNotes}
//                         onChange={(e) => setApprovalNotes(e.target.value)}
//                         placeholder="Add any comments or feedback..."
//                         rows={4}
//                         className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
//                       />
//                     </div>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         </div>
//       </div>
//     </>
//   );
// }
// src/components/rfp/AISuggestionsPanel.tsx

"use client";

import { useState } from "react";
import { Sparkles, Library, RefreshCw, Calendar, Star, Download, Eye, ChevronUp, ChevronDown } from "lucide-react";

interface AISuggestion {
  id: string;
  title: string;
  content: string;
  matchPercentage: number;
}

interface LibraryMatch {
  id: string;
  sourceRfp: string;
  date: string;
  rating: string;
  content: string;
  matchPercentage: number;
}

interface AISuggestionsPanelProps {
  questionId: string;
  onInsert: (content: string) => void;
  onClose?: () => void;
}

// Dummy data - will be replaced with API calls later
const DUMMY_AI_SUGGESTIONS: AISuggestion[] = [
  {
    id: "ai-1",
    title: "AI Option 1",
    content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and API Keys with granular permission controls.",
    matchPercentage: 98,
  },
  {
    id: "ai-2",
    title: "AI Option 2",
    content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and API Keys with granular permission controls.",
    matchPercentage: 92,
  },
  {
    id: "ai-3",
    title: "AI Option 3",
    content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and API Keys with granular permission controls.",
    matchPercentage: 27,
  },
];

const DUMMY_LIBRARY_MATCHES: LibraryMatch[] = [
  {
    id: "lib-1",
    sourceRfp: "From Q3 2024 RFP",
    date: "Sep 15, 2024",
    rating: "9/10 Rated",
    content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
    matchPercentage: 98,
  },
  {
    id: "lib-2",
    sourceRfp: "From Q3 2024 RFP",
    date: "Sep 15, 2024",
    rating: "9/10 Rated",
    content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
    matchPercentage: 98,
  },
  {
    id: "lib-3",
    sourceRfp: "From Q3 2024 RFP",
    date: "Sep 15, 2024",
    rating: "9/10 Rated",
    content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
    matchPercentage: 98,
  },
];


export default function AISuggestionsPanel({
  questionId,
  onInsert,
}: AISuggestionsPanelProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "library">("ai");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // 🔥 Separate preview states
  const [expandedAiId, setExpandedAiId] = useState<string | null>(null);
  const [expandedLibraryId, setExpandedLibraryId] = useState<string | null>(null);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsRegenerating(false);
  };

  const getMatchColor = (percentage: number) => {
    if (percentage >= 90) return "text-green-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-red-500";
  };

  const toggleAiPreview = (id: string) => {
    setExpandedAiId((prev) => (prev === id ? null : id));
  };

  const toggleLibraryPreview = (id: string) => {
    setExpandedLibraryId((prev) => (prev === id ? null : id));
  };

  return (
    <aside className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      {/* ---------------- Tabs ---------------- */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
            activeTab === "ai"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Sparkles size={16} />
          AI Suggestions
        </button>

        <button
          onClick={() => setActiveTab("library")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
            activeTab === "library"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Library size={16} />
          Library Matches
        </button>
      </div>

      {/* ---------------- Content ---------------- */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* ========== AI TAB ========== */}
        {activeTab === "ai" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                AI Generated Answers
              </h3>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw
                  size={14}
                  className={isRegenerating ? "animate-spin" : ""}
                />
                Regenerate
              </button>
            </div>

            <div className="space-y-3">
              {DUMMY_AI_SUGGESTIONS.map((s) => {
                const isExpanded = expandedAiId === s.id;

                return (
                  <div
                    key={s.id}
                    className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-blue-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {s.title}
                        </span>
                      </div>
                      <span
                        className={`text-xs font-medium ${getMatchColor(
                          s.matchPercentage
                        )}`}
                      >
                        {s.matchPercentage}% Match
                      </span>
                    </div>

                    {!isExpanded && (
                      <p className="text-xs text-gray-600 line-clamp-4 mb-3">
                        {s.content}
                      </p>
                    )}

                    {isExpanded && (
                      <div className="text-xs text-gray-700 mb-3 p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
                        {s.content}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleAiPreview(s.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg"
                      >
                        <Eye size={12} />
                        {isExpanded ? "Collapse" : "Preview Full"}
                        {isExpanded ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                      </button>

                      <button
                        onClick={() => onInsert(s.content)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        <Download size={12} />
                        Insert
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ========== LIBRARY TAB ========== */}
        {activeTab === "library" && (
          <div className="space-y-3">
            {DUMMY_LIBRARY_MATCHES.map((m) => {
              const isExpanded = expandedLibraryId === m.id;

              return (
                <div
                  key={m.id}
                  className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {m.sourceRfp}
                    </span>
                    <span
                      className={`text-xs font-medium ${getMatchColor(
                        m.matchPercentage
                      )}`}
                    >
                      {m.matchPercentage}% Match
                    </span>
                  </div>

                  {!isExpanded && (
                    <p className="text-xs text-gray-600 line-clamp-4 mb-3">
                      {m.content}
                    </p>
                  )}

                  {isExpanded && (
                    <div className="text-xs text-gray-700 mb-3 p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
                      {m.content}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleLibraryPreview(m.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg"
                    >
                      <Eye size={12} />
                      {isExpanded ? "Collapse" : "Preview Full"}
                      {isExpanded ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )}
                    </button>

                    <button
                      onClick={() => onInsert(m.content)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                    >
                      <Download size={12} />
                      Insert
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
// export default function AISuggestionsPanel({
//   questionId,
//   onInsert,
//   onClose,
// }: AISuggestionsPanelProps) {
//   const [activeTab, setActiveTab] = useState<"ai" | "library">("ai");
//   const [isRegenerating, setIsRegenerating] = useState(false);

//   const handleRegenerate = async () => {
//     setIsRegenerating(true);
//     // Simulate API call
//     await new Promise((resolve) => setTimeout(resolve, 1500));
//     setIsRegenerating(false);
//   };

//   const getMatchColor = (percentage: number) => {
//     if (percentage >= 90) return "text-green-600";
//     if (percentage >= 70) return "text-yellow-600";
//     return "text-red-500";
//   };

//   return (
//     <aside className="w-80 bg-white border-l border-gray-200 flex flex-col flex-shrink-0 h-full">
//       {/* Tabs */}
//       <div className="flex border-b border-gray-200">
//         <button
//           onClick={() => setActiveTab("ai")}
//           className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
//             activeTab === "ai"
//               ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
//               : "text-gray-500 hover:text-gray-700"
//           }`}
//         >
//           <Sparkles size={16} />
//           AI Suggestions
//         </button>
//         <button
//           onClick={() => setActiveTab("library")}
//           className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
//             activeTab === "library"
//               ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
//               : "text-gray-500 hover:text-gray-700"
//           }`}
//         >
//           <Library size={16} />
//           Library Matches
//         </button>
//       </div>

//       {/* Content */}
//       <div className="flex-1 overflow-y-auto">
//         {activeTab === "ai" ? (
//           <div className="p-4">
//             {/* Header */}
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="text-sm font-semibold text-gray-900">
//                 AI Generated Answers
//               </h3>
//               <button
//                 onClick={handleRegenerate}
//                 disabled={isRegenerating}
//                 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
//               >
//                 <RefreshCw
//                   size={14}
//                   className={isRegenerating ? "animate-spin" : ""}
//                 />
//                 Regenerate
//               </button>
//             </div>

//             {/* AI Suggestions List */}
//             <div className="space-y-3">
//               {DUMMY_AI_SUGGESTIONS.map((suggestion) => (
//                 <div
//                   key={suggestion.id}
//                   className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors"
//                 >
//                   {/* Header */}
//                   <div className="flex items-center justify-between mb-2">
//                     <div className="flex items-center gap-2">
//                       <Sparkles size={14} className="text-blue-500" />
//                       <span className="text-sm font-medium text-gray-900">
//                         {suggestion.title}
//                       </span>
//                     </div>
//                     <span
//                       className={`text-xs font-medium ${getMatchColor(
//                         suggestion.matchPercentage
//                       )}`}
//                     >
//                       {suggestion.matchPercentage}% Match
//                     </span>
//                   </div>

//                   {/* Content Preview */}
//                   <p className="text-xs text-gray-600 line-clamp-4 mb-3">
//                     {suggestion.content}
//                   </p>

//                   {/* Actions */}
//                   <div className="flex items-center gap-2">
//                     <button className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
//                       Preview Full
//                     </button>
//                     <button
//                       onClick={() => onInsert(suggestion.content)}
//                       className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
//                     >
//                       <Download size={12} />
//                       Insert
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         ) : (
//           <div className="p-4">
//             {/* Header */}
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="text-sm font-semibold text-gray-900">
//                 Previous Answers
//               </h3>
//               <button
//                 onClick={handleRegenerate}
//                 disabled={isRegenerating}
//                 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
//               >
//                 <RefreshCw
//                   size={14}
//                   className={isRegenerating ? "animate-spin" : ""}
//                 />
//                 Regenerate
//               </button>
//             </div>

//             {/* Library Matches List */}
//             <div className="space-y-3">
//               {DUMMY_LIBRARY_MATCHES.map((match) => (
//                 <div
//                   key={match.id}
//                   className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors"
//                 >
//                   {/* Header */}
//                   <div className="flex items-center justify-between mb-2">
//                     <div className="flex items-center gap-2">
//                       <RefreshCw size={14} className="text-gray-400" />
//                       <span className="text-sm font-medium text-gray-900">
//                         {match.sourceRfp}
//                       </span>
//                     </div>
//                     <span
//                       className={`text-xs font-medium ${getMatchColor(
//                         match.matchPercentage
//                       )}`}
//                     >
//                       {match.matchPercentage}% Match
//                     </span>
//                   </div>

//                   {/* Metadata */}
//                   <div className="flex items-center gap-3 mb-2 text-xs text-gray-500">
//                     <span className="flex items-center gap-1">
//                       <Calendar size={12} />
//                       {match.date}
//                     </span>
//                     <span className="flex items-center gap-1">
//                       <Star size={12} />
//                       {match.rating}
//                     </span>
//                   </div>

//                   {/* Content Preview */}
//                   <p className="text-xs text-gray-600 line-clamp-4 mb-3">
//                     {match.content}
//                   </p>

//                   {/* Actions */}
//                   <div className="flex items-center gap-2">
//                     <button className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors">
//                       View Source
//                     </button>
//                     <button
//                       onClick={() => onInsert(match.content)}
//                       className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
//                     >
//                       <Download size={12} />
//                       Insert
//                     </button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//           </div>
//         )}
//       </div>
//     </aside>
//   );
// }
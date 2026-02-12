// src/components/rfp/AISuggestionsPanel.tsx

"use client";

import { useState } from "react";
import {
  Sparkles,
  Library,
  RefreshCw,
  Eye,
  ChevronUp,
  ChevronDown,
  Download,
  FileText,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

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

const TONE_OPTIONS = [
  "Formal Tone",
  "Professional Tone",
  "Conversational Tone",
  "Technical Tone",
  "Persuasive Tone",
];

// Dummy library matches (kept static for now)
const DUMMY_LIBRARY_MATCHES: LibraryMatch[] = [
  {
    id: "lib-1",
    sourceRfp: "From Q3 2024 RFP",
    date: "Sep 15, 2024",
    rating: "9/10 Rated",
    content:
      "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
    matchPercentage: 98,
  },
  {
    id: "lib-2",
    sourceRfp: "From Q3 2024 RFP",
    date: "Sep 15, 2024",
    rating: "9/10 Rated",
    content:
      "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
    matchPercentage: 98,
  },
  {
    id: "lib-3",
    sourceRfp: "From Q3 2024 RFP",
    date: "Sep 15, 2024",
    rating: "9/10 Rated",
    content:
      "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
    matchPercentage: 98,
  },
];

export default function AISuggestionsPanel({
  questionId,
  onInsert,
}: AISuggestionsPanelProps) {
  const [activeTab, setActiveTab] = useState<"ai" | "library">("ai");

  // AI generation state
  const [selectedTone, setSelectedTone] = useState("Formal Tone");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[] | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);

  // Separate preview states
  const [expandedAiId, setExpandedAiId] = useState<string | null>(null);
  const [expandedLibraryId, setExpandedLibraryId] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setAiSuggestions(null);
    setGenerationFailed(false);
    try {
      const data = await api.ai.generateSuggestions(questionId, selectedTone);
      if (data.suggestions && data.suggestions.length > 0) {
        setAiSuggestions(data.suggestions);
      } else {
        setGenerationFailed(true);
      }
    } catch (err) {
      console.error("Failed to generate suggestions:", err);
      setGenerationFailed(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    handleGenerate();
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
    <aside className="w-84 bg-white border-l border-gray-200 flex flex-col h-full">
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
            {/* --- Initial state: Tone selector + Generate button --- */}
            {!aiSuggestions && !isGenerating && !generationFailed && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1.5">
                    Set Answer Tone
                  </label>
                  <Select value={selectedTone} onValueChange={setSelectedTone}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a tone" className="" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {TONE_OPTIONS.map((tone) => (
                          <SelectItem key={tone} value={tone}>
                            {tone}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <button
                  onClick={handleGenerate}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  <Sparkles size={16} />
                  Generate Answers
                </button>
              </div>
            )}

            {/* --- Loading state --- */}
            {isGenerating && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full border-2 border-blue-100 border-t-blue-600 animate-spin" />
                  <Sparkles
                    size={16}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Generating AI answers...
                </p>
                <p className="text-xs text-gray-400">
                  Tone: {selectedTone}
                </p>
              </div>
            )}

            {/* --- Empty / Error state --- */}
            {generationFailed && !isGenerating && (
              <div className="flex flex-col items-center justify-center py-12 px-4 gap-4">
                <div className="w-16 h-16 flex items-center justify-center text-gray-300">
                  <FileText size={48} strokeWidth={1} />
                </div>
                <p className="text-sm text-gray-500 text-center leading-relaxed">
                  AI could not generate an answer for this question due to
                  insufficient confirmed inputs.
                </p>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors"
                >
                  <RefreshCw size={14} />
                  Try Again
                </button>
              </div>
            )}

            {/* --- Results state --- */}
            {aiSuggestions && !isGenerating && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    AI Generated Answers
                  </h3>
                  <button
                    onClick={handleRegenerate}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    <RefreshCw size={14} />
                    Regenerate
                  </button>
                </div>

                {/* Tone badge */}
                <div className="mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                    {selectedTone}
                  </span>
                </div>

                <div className="space-y-3">
                  {aiSuggestions.map((s) => {
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
          </>
        )}

        {/* ========== LIBRARY TAB ========== */}
        {activeTab === "library" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                Previous Answers
              </h3>
              <button
                onClick={() => {}}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

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
          </>
        )}
      </div>
    </aside>
  );
}






































































// // src/components/rfp/AISuggestionsPanel.tsx

// "use client";

// import { useState } from "react";
// import { Sparkles, Library, RefreshCw, Calendar, Star, Download, Eye, ChevronUp, ChevronDown } from "lucide-react";

// interface AISuggestion {
//   id: string;
//   title: string;
//   content: string;
//   matchPercentage: number;
// }

// interface LibraryMatch {
//   id: string;
//   sourceRfp: string;
//   date: string;
//   rating: string;
//   content: string;
//   matchPercentage: number;
// }

// interface AISuggestionsPanelProps {
//   questionId: string;
//   onInsert: (content: string) => void;
//   onClose?: () => void;
// }

// // Dummy data - will be replaced with API calls later
// const DUMMY_AI_SUGGESTIONS: AISuggestion[] = [
//   {
//     id: "ai-1",
//     title: "AI Option 1",
//     content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and API Keys with granular permission controls.",
//     matchPercentage: 98,
//   },
//   {
//     id: "ai-2",
//     title: "AI Option 2",
//     content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and API Keys with granular permission controls.",
//     matchPercentage: 92,
//   },
//   {
//     id: "ai-3",
//     title: "AI Option 3",
//     content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and API Keys with granular permission controls.",
//     matchPercentage: 27,
//   },
// ];

// const DUMMY_LIBRARY_MATCHES: LibraryMatch[] = [
//   {
//     id: "lib-1",
//     sourceRfp: "From Q3 2024 RFP",
//     date: "Sep 15, 2024",
//     rating: "9/10 Rated",
//     content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
//     matchPercentage: 98,
//   },
//   {
//     id: "lib-2",
//     sourceRfp: "From Q3 2024 RFP",
//     date: "Sep 15, 2024",
//     rating: "9/10 Rated",
//     content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
//     matchPercentage: 98,
//   },
//   {
//     id: "lib-3",
//     sourceRfp: "From Q3 2024 RFP",
//     date: "Sep 15, 2024",
//     rating: "9/10 Rated",
//     content: "Our platform offers comprehensive API integration capabilities built on modern REST and GraphQL architectures. We support multiple authentication methods including OAuth 2.0, JWT tokens, and AP...",
//     matchPercentage: 98,
//   },
// ];


// export default function AISuggestionsPanel({
//   questionId,
//   onInsert,
// }: AISuggestionsPanelProps) {
//   const [activeTab, setActiveTab] = useState<"ai" | "library">("ai");
//   const [isRegenerating, setIsRegenerating] = useState(false);

//   // 🔥 Separate preview states
//   const [expandedAiId, setExpandedAiId] = useState<string | null>(null);
//   const [expandedLibraryId, setExpandedLibraryId] = useState<string | null>(null);

//   const handleRegenerate = async () => {
//     setIsRegenerating(true);
//     await new Promise((r) => setTimeout(r, 1500));
//     setIsRegenerating(false);
//   };

//   const getMatchColor = (percentage: number) => {
//     if (percentage >= 90) return "text-green-600";
//     if (percentage >= 70) return "text-yellow-600";
//     return "text-red-500";
//   };

//   const toggleAiPreview = (id: string) => {
//     setExpandedAiId((prev) => (prev === id ? null : id));
//   };

//   const toggleLibraryPreview = (id: string) => {
//     setExpandedLibraryId((prev) => (prev === id ? null : id));
//   };

//   return (
//     <aside className="w-84 bg-white border-l border-gray-200 flex flex-col h-full">
//       {/* ---------------- Tabs ---------------- */}
//       <div className="flex border-b border-gray-200">
//         <button
//           onClick={() => setActiveTab("ai")}
//           className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
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
//           className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium ${
//             activeTab === "library"
//               ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
//               : "text-gray-500 hover:text-gray-700"
//           }`}
//         >
//           <Library size={16} />
//           Library Matches
//         </button>
//       </div>

//       {/* ---------------- Content ---------------- */}
//       <div className="flex-1 overflow-y-auto p-4">
//         {/* ========== AI TAB ========== */}
//         {activeTab === "ai" && (
//           <>
//             <div className="flex items-center justify-between mb-4">
//               <h3 className="text-sm font-semibold text-gray-900">
//                 AI Generated Answers
//               </h3>
//               <button
//                 onClick={handleRegenerate}
//                 disabled={isRegenerating}
//                 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
//               >
//                 <RefreshCw
//                   size={14}
//                   className={isRegenerating ? "animate-spin" : ""}
//                 />
//                 Regenerate
//               </button>
//             </div>

//             <div className="space-y-3">
//               {DUMMY_AI_SUGGESTIONS.map((s) => {
//                 const isExpanded = expandedAiId === s.id;

//                 return (
//                   <div
//                     key={s.id}
//                     className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors"
//                   >
//                     <div className="flex items-center justify-between mb-2">
//                       <div className="flex items-center gap-2">
//                         <Sparkles size={14} className="text-blue-500" />
//                         <span className="text-sm font-medium text-gray-900">
//                           {s.title}
//                         </span>
//                       </div>
//                       <span
//                         className={`text-xs font-medium ${getMatchColor(
//                           s.matchPercentage
//                         )}`}
//                       >
//                         {s.matchPercentage}% Match
//                       </span>
//                     </div>

//                     {!isExpanded && (
//                       <p className="text-xs text-gray-600 line-clamp-4 mb-3">
//                         {s.content}
//                       </p>
//                     )}

//                     {isExpanded && (
//                       <div className="text-xs text-gray-700 mb-3 p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
//                         {s.content}
//                       </div>
//                     )}

//                     <div className="flex items-center gap-2">
//                       <button
//                         onClick={() => toggleAiPreview(s.id)}
//                         className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg"
//                       >
//                         <Eye size={12} />
//                         {isExpanded ? "Collapse" : "Preview Full"}
//                         {isExpanded ? (
//                           <ChevronUp size={12} />
//                         ) : (
//                           <ChevronDown size={12} />
//                         )}
//                       </button>

//                       <button
//                         onClick={() => onInsert(s.content)}
//                         className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
//                       >
//                         <Download size={12} />
//                         Insert
//                       </button>
//                     </div>
//                   </div>
//                 );
//               })}
//             </div>
//           </>
//         )}

//         {/* ========== LIBRARY TAB ========== */}
//         {activeTab === "library" && (
//           <>
//            <div className="flex items-center justify-between mb-4">
//               <h3 className="text-sm font-semibold text-gray-900">
//                 Previous Answers
//               </h3>
//               <button
//                 onClick={handleRegenerate}
//                 disabled={isRegenerating}
//                 className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
//               >
//                 <RefreshCw
//                   size={14}
//                   className={isRegenerating ? "animate-spin" : ""}
//                 />
//                 Regenerate
//               </button>
//             </div>
//           <div className="space-y-3">
//             {DUMMY_LIBRARY_MATCHES.map((m) => {
//               const isExpanded = expandedLibraryId === m.id;

//               return (
//                 <div
//                   key={m.id}
//                   className="border border-gray-200 rounded-lg p-3 hover:border-blue-200 transition-colors"
//                 >
//                   <div className="flex items-center justify-between mb-2">
//                     <span className="text-sm font-medium text-gray-900">
//                       {m.sourceRfp}
//                     </span>
//                     <span
//                       className={`text-xs font-medium ${getMatchColor(
//                         m.matchPercentage
//                       )}`}
//                     >
//                       {m.matchPercentage}% Match
//                     </span>
//                   </div>

//                   {!isExpanded && (
//                     <p className="text-xs text-gray-600 line-clamp-4 mb-3">
//                       {m.content}
//                     </p>
//                   )}

//                   {isExpanded && (
//                     <div className="text-xs text-gray-700 mb-3 p-2 bg-gray-50 rounded-md whitespace-pre-wrap">
//                       {m.content}
//                     </div>
//                   )}

//                   <div className="flex items-center gap-2">
//                     <button
//                       onClick={() => toggleLibraryPreview(m.id)}
//                       className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 border border-gray-200 rounded-lg"
//                     >
//                       <Eye size={12} />
//                       {isExpanded ? "Collapse" : "Preview Full"}
//                       {isExpanded ? (
//                         <ChevronUp size={12} />
//                       ) : (
//                         <ChevronDown size={12} />
//                       )}
//                     </button>

//                     <button
//                       onClick={() => onInsert(m.content)}
//                       className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
//                     >
//                       <Download size={12} />
//                       Insert
//                     </button>
//                   </div>
//                 </div>
//               );
//             })}
//           </div>

//           </>
//         )}
//       </div>
//     </aside>
//   );
// }

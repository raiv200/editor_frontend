// src/components/rfp/DocumentOutline.tsx

"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Edit3,
  History,
} from "lucide-react";

interface Question {
  id: string;
  title: string;
  order?: number;
}

interface Section {
  id: string;
  title: string;
  order: number;
  questions: Question[];
}

interface DocumentOutlineProps {
  sections: Section[];
  activeQuestionId: string | null;
  answeredQuestions: Set<string>;
  unsavedQuestions?: Set<string>; // NEW: Questions with unsaved changes
  onQuestionSelect: (questionId: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function DocumentOutline({
  sections,
  activeQuestionId,
  answeredQuestions,
  unsavedQuestions = new Set(), // Default to empty set
  onQuestionSelect,
  isCollapsed = false,
  onToggleCollapse,
}: DocumentOutlineProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(
    sections.map((s) => s.id)
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  if (isCollapsed) {
    return (
      <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="Expand outline"
        >
          <ChevronRight size={20} className="text-gray-500" />
        </button>
      </div>
    );
  }

  return (
    <aside className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 text-sm">Document Outline</h2>
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="Collapse outline"
          >
            <ChevronLeft size={18} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Sections List */}
      <div className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          const answered = section.questions.filter((q) =>
            answeredQuestions.has(q.id)
          ).length;
          const total = section.questions.length;
          const isComplete = answered === total && total > 0;

          return (
            <div key={section.id} className="mb-1">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
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
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    isComplete
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {answered}/{total}
                </span>
              </button>

              {/* Questions List */}
              {isExpanded && (
                <div className="ml-2">
                  {section.questions.map((q, qIndex) => {
                    const isActive = activeQuestionId === q.id;
                    const isAnswered = answeredQuestions.has(q.id);
                    const hasUnsavedChanges = unsavedQuestions.has(q.id);
                    
                    // Determine icon state (priority order):
                    // 1. If answered/saved = green checkmark
                    // 2. If has unsaved changes (typed but not saved) = orange clock/history
                    // 3. If active but no content = blue pencil (editing)
                    // 4. Otherwise = empty circle (not started)

                    const getIconAndColor = () => {
                      if (isAnswered) {
                        // Saved/Answered - Green checkmark
                        return {
                          icon: <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />,
                          textColor: "text-gray-700"
                        };
                      }
                      if (hasUnsavedChanges) {
                        // Has unsaved changes - Orange clock/history icon
                        return {
                          icon: <History size={16} className="text-amber-500 flex-shrink-0" />,
                          textColor: "text-gray-700"
                        };
                      }
                      if (isActive) {
                        // Currently editing (active but empty) - Blue pencil
                        return {
                          icon: <Edit3 size={16} className="text-blue-500 flex-shrink-0" />,
                          textColor: "text-blue-700 font-medium"
                        };
                      }
                      // Not started - Empty circle
                      return {
                        icon: <Circle size={16} className="text-gray-300 flex-shrink-0" />,
                        textColor: "text-gray-600"
                      };
                    };

                    const { icon, textColor } = getIconAndColor();

                    return (
                      <button
                        key={q.id}
                        onClick={() => onQuestionSelect(q.id)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                          isActive
                            ? "bg-blue-50 border-l-2 border-blue-600"
                            : "hover:bg-gray-50 border-l-2 border-transparent"
                        }`}
                      >
                        {/* Status Icon */}
                        {icon}

                        {/* Question Title */}
                        <span className={`text-sm truncate ${isActive ? "text-blue-700 font-medium" : textColor}`}>
                          {/* Q {section.order}.{qIndex + 1} - {q.title} */}
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
  );
}


















// // src/components/rfp/DocumentOutline.tsx

// "use client";

// import { useState } from "react";
// import {
//   ChevronDown,
//   ChevronRight,
//   ChevronLeft,
//   CheckCircle2,
//   Circle,
//   Edit3,
// } from "lucide-react";

// interface Question {
//   id: string;
//   title: string;
//   order?: number;
// }

// interface Section {
//   id: string;
//   title: string;
//   order: number;
//   questions: Question[];
// }

// interface DocumentOutlineProps {
//   sections: Section[];
//   activeQuestionId: string | null;
//   answeredQuestions: Set<string>;
//   onQuestionSelect: (questionId: string) => void;
//   isCollapsed?: boolean;
//   onToggleCollapse?: () => void;
// }

// export default function DocumentOutline({
//   sections,
//   activeQuestionId,
//   answeredQuestions,
//   onQuestionSelect,
//   isCollapsed = false,
//   onToggleCollapse,
// }: DocumentOutlineProps) {
//   const [expandedSections, setExpandedSections] = useState<string[]>(
//     sections.map((s) => s.id)
//   );

//   const toggleSection = (sectionId: string) => {
//     setExpandedSections((prev) =>
//       prev.includes(sectionId)
//         ? prev.filter((id) => id !== sectionId)
//         : [...prev, sectionId]
//     );
//   };

//   if (isCollapsed) {
//     return (
//       <div className="w-12 bg-white border-r border-gray-200 flex flex-col items-center py-4">
//         <button
//           onClick={onToggleCollapse}
//           className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
//           title="Expand outline"
//         >
//           <ChevronRight size={20} className="text-gray-500" />
//         </button>
//       </div>
//     );
//   }

//   return (
//     <aside className="w-72 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
//       {/* Header */}
//       <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
//         <h2 className="font-semibold text-gray-900 text-sm">Document Outline</h2>
//         {onToggleCollapse && (
//           <button
//             onClick={onToggleCollapse}
//             className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
//             title="Collapse outline"
//           >
//             <ChevronLeft size={18} className="text-gray-400" />
//           </button>
//         )}
//       </div>

//       {/* Sections List */}
//       <div className="flex-1 overflow-y-auto py-2">
//         {sections.map((section) => {
//           const isExpanded = expandedSections.includes(section.id);
//           const answered = section.questions.filter((q) =>
//             answeredQuestions.has(q.id)
//           ).length;
//           const total = section.questions.length;
//           const isComplete = answered === total && total > 0;

//           return (
//             <div key={section.id} className="mb-1">
//               {/* Section Header */}
//               <button
//                 onClick={() => toggleSection(section.id)}
//                 className="w-full flex items-center justify-between px-4 py-2 hover:bg-gray-50 transition-colors"
//               >
//                 <div className="flex items-center gap-2">
//                   {isExpanded ? (
//                     <ChevronDown size={16} className="text-gray-400" />
//                   ) : (
//                     <ChevronRight size={16} className="text-gray-400" />
//                   )}
//                   <span className="text-sm font-medium text-gray-700">
//                     {section.order}. {section.title}
//                   </span>
//                 </div>
//                 <span
//                   className={`text-xs px-2 py-0.5 rounded-full font-medium ${
//                     isComplete
//                       ? "bg-green-100 text-green-700"
//                       : "bg-gray-100 text-gray-600"
//                   }`}
//                 >
//                   {answered}/{total}
//                 </span>
//               </button>

//               {/* Questions List */}
//               {isExpanded && (
//                 <div className="ml-2">
//                   {section.questions.map((q, qIndex) => {
//                     const isActive = activeQuestionId === q.id;
//                     const isAnswered = answeredQuestions.has(q.id);
                    
//                     // Determine icon state:
//                     // - If active AND not answered yet = show edit icon (currently editing)
//                     // - If answered/saved = show green checkmark
//                     // - Otherwise = show empty circle
//                     const isCurrentlyEditing = isActive && !isAnswered;

//                     return (
//                       <button
//                         key={q.id}
//                         onClick={() => onQuestionSelect(q.id)}
//                         className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
//                           isActive
//                             ? "bg-blue-50 border-l-2 border-blue-600"
//                             : "hover:bg-gray-50 border-l-2 border-transparent"
//                         }`}
//                       >
//                         {/* Status Icon */}
//                         {isAnswered ? (
//                           // Saved/Answered - Green checkmark
//                           <CheckCircle2
//                             size={16}
//                             className="text-green-500 flex-shrink-0"
//                           />
//                         ) : isCurrentlyEditing ? (
//                           // Currently editing (active but not saved) - Blue pencil
//                           <Edit3
//                             size={16}
//                             className="text-blue-500 flex-shrink-0"
//                           />
//                         ) : (
//                           // Not started - Empty circle
//                           <Circle
//                             size={16}
//                             className="text-gray-300 flex-shrink-0"
//                           />
//                         )}

//                         {/* Question Title */}
//                         <span
//                           className={`text-sm truncate ${
//                             isActive
//                               ? "text-blue-700 font-medium"
//                               : isAnswered
//                               ? "text-gray-700"
//                               : "text-gray-600"
//                           }`}
//                         >
//                           {/* Q {section.order}.{qIndex + 1} - {q.title} */}
//                           {q.title}
//                         </span>
//                       </button>
//                     );
//                   })}
//                 </div>
//               )}
//             </div>
//           );
//         })}
//       </div>
//     </aside>
//   );
// }
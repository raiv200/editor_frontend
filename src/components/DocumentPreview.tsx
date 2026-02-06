// src/components/DocumentPreview.tsx

"use client";

import React from "react";
import { FileText } from "lucide-react";
import {
  PageSettings,
  PAGE_SIZES,
  getEffectiveDimensions,
} from "@/types/export";

interface Section {
  id: number;
  title: string;
  questions: {
    id: string;
    title: string;
    fullQuestion: string;
  }[];
}

interface DocumentPreviewProps {
  sections: Section[];
  getAnswer: (id: string) => string;
  getStatus: (id: string) => string;
  pageSettings: PageSettings;
  documentTitle?: string;
  companyName?: string | null;
}

export default function DocumentPreview({
  sections,
  getAnswer,
  getStatus,
  pageSettings,
  documentTitle = "RFP Response",
  companyName,
}: DocumentPreviewProps) {
  const dimensions = getEffectiveDimensions(
    pageSettings.pageSize,
    pageSettings.orientation
  );

  // Scale factor to fit preview in container (base width ~700px for portrait A4)
  const baseScale = 0.35;
  const scaledWidth = dimensions.width * baseScale * 10; // Convert mm to ~px
  const scaledHeight = dimensions.height * baseScale * 10;

  // Scaled margins
  const marginTop = pageSettings.margins.top * baseScale * 10;
  const marginBottom = pageSettings.margins.bottom * baseScale * 10;
  const marginLeft = pageSettings.margins.left * baseScale * 10;
  const marginRight = pageSettings.margins.right * baseScale * 10;

  return (
    <div className="bg-gray-100 rounded-lg border border-gray-200 p-6 overflow-auto">
      {/* Preview Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Document Preview</h3>
        <span className="text-xs text-gray-500">
          {PAGE_SIZES[pageSettings.pageSize].label} •{" "}
          {pageSettings.orientation === "portrait" ? "Portrait" : "Landscape"}
        </span>
      </div>

      {/* Page Preview Container */}
      <div className="flex justify-center">
        <div
          className="bg-white shadow-lg rounded-sm overflow-hidden"
          style={{
            width: `${scaledWidth}px`,
            minHeight: `${scaledHeight}px`,
            maxHeight: "70vh",
          }}
        >
          {/* Content area with margins visualized */}
          <div
            className="h-full overflow-auto"
            style={{
              padding: `${marginTop}px ${marginRight}px ${marginBottom}px ${marginLeft}px`,
            }}
          >
            {/* Document Title */}
            <div className="mb-6 pb-4 border-b border-gray-200">
              <h1 className="text-lg font-bold text-gray-900">
                {documentTitle}
              </h1>
              {companyName && (
                <p className="text-sm text-gray-600 mt-1">{companyName}</p>
              )}
            
            </div>

            {/* Sections */}
            <div className="space-y-6">
              {sections.map((section) => (
                <div key={section.id} className="space-y-4">
                  {/* Section Header */}
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <FileText size={14} className="text-gray-500" />
                    <h2 className="text-sm font-semibold text-gray-800">
                      Section {section.id}: {section.title}
                    </h2>
                  </div>

                  {/* Questions */}
                  {section.questions.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">
                      No questions in this section
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {section.questions.map((q, qIndex) => {
                        const answer = getAnswer(q.id);
                        const hasAnswer =
                          answer &&
                          answer !== "<p></p>" &&
                          answer.trim() !== "";

                        return (
                          <div key={q.id} className="space-y-2">
                            {/* Question title */}
                            <h3 className="text-xs font-semibold text-gray-800">
                              Q {section.id}.{qIndex + 1} - {q.title}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {q.fullQuestion}
                            </p>

                            {/* Answer */}
                            {hasAnswer ? (
                              <div
                                className="prose prose-xs max-w-none text-gray-700 pl-2"
                                style={{ fontSize: "10px", lineHeight: "1.4" }}
                                dangerouslySetInnerHTML={{ __html: answer }}
                              />
                            ) : (
                              <p className="text-xs text-gray-400 italic pl-2">
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
        </div>
      </div>

      {/* Margin Indicator */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
        <span>
          Margins: {pageSettings.margins.top}mm (T) •{" "}
          {pageSettings.margins.bottom}mm (B) • {pageSettings.margins.left}mm
          (L) • {pageSettings.margins.right}mm (R)
        </span>
      </div>
    </div>
  );
}
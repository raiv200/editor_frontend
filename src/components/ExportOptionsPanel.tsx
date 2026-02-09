// src/components/ExportOptionsPanel.tsx

"use client";

import React from "react";
import { FileText, FileIcon, Loader2 } from "lucide-react";
import {
  ExportFormat,
  PageSize,
  PageOrientation,
  PageSettings,
  PAGE_SIZES,
} from "@/types/export";

interface ExportOptionsPanelProps {
  format: ExportFormat;
  pageSettings: PageSettings;
  onFormatChange: (format: ExportFormat) => void;
  onPageSettingsChange: (settings: PageSettings) => void;
  onExport: () => void;
  isExporting: boolean;
}

export default function ExportOptionsPanel({
  format,
  pageSettings,
  onFormatChange,
  onPageSettingsChange,
  onExport,
  isExporting,
}: ExportOptionsPanelProps) {
  const updateMargin = (key: keyof PageSettings["margins"], value: number) => {
    onPageSettingsChange({
      ...pageSettings,
      margins: {
        ...pageSettings.margins,
        [key]: value,
      },
    });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-5">
        <FileText size={18} className="text-gray-600" />
        <h3 className="text-sm font-semibold text-gray-800">Export Options</h3>
      </div>

      {/* Format Selection */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Select Format
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onFormatChange("pdf")}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
              format === "pdf"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                format === "pdf" ? "bg-red-100" : "bg-gray-100"
              }`}
            >
              <span className="text-xs font-bold text-red-600">PDF</span>
            </div>
            <span className="text-xs font-medium text-gray-700">
              PDF Document
            </span>
          </button>

          <button
            onClick={() => onFormatChange("docx")}
            className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
              format === "docx"
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300 bg-white"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                format === "docx" ? "bg-blue-100" : "bg-gray-100"
              }`}
            >
              <span className="text-xs font-bold text-blue-600">DOCX</span>
            </div>
            <span className="text-xs font-medium text-gray-700">
              Word (.docx)
            </span>
          </button>
        </div>
      </div>

      {/* Page Settings */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-gray-700 mb-3">
          Page Settings
        </label>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Page Size */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Page Size
            </label>
            <select
              value={pageSettings.pageSize}
              onChange={(e) =>
                onPageSettingsChange({
                  ...pageSettings,
                  pageSize: e.target.value as PageSize,
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {Object.entries(PAGE_SIZES).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Orientation */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">
              Orientation
            </label>
            <select
              value={pageSettings.orientation}
              onChange={(e) =>
                onPageSettingsChange({
                  ...pageSettings,
                  orientation: e.target.value as PageOrientation,
                })
              }
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
        </div>

        {/* Margins */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">
            Margins (mm)
          </label>
          <div className="grid grid-cols-4 gap-2">
            {(["top", "bottom", "left", "right"] as const).map((side) => (
              <div key={side}>
                <input
                  type="number"
                  value={pageSettings.margins[side]}
                  onChange={(e) =>
                    updateMargin(side, parseFloat(e.target.value) || 0)
                  }
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <span className="block text-xs text-gray-400 text-center mt-1 capitalize">
                  {side}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Export Button */}
      <button
        onClick={onExport}
        disabled={isExporting}
        className="w-full px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isExporting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <FileIcon size={16} />
            Generate & Download
          </>
        )}
      </button>
    </div>
  );
}
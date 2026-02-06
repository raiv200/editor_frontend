// src/hooks/useExport.ts

"use client";

import { useState, useCallback } from "react";
import {
  ExportFormat,
  PageSettings,
  DEFAULT_PAGE_SETTINGS,
} from "@/types/export";
import { generatePDF } from "@/lib/generatePDF";
import { generateDOCX } from "@/lib/generateDOCX";

interface Section {
  id: number;
  title: string;
  questions: {
    id: string;
    title: string;
    fullQuestion: string;
  }[];
}

interface UseExportOptions {
  sections: Section[];
  getAnswer: (id: string) => string;
  getStatus: (id: string) => string;
  documentTitle?: string;
  companyName?: string | null;
}

export const useExport = ({
  sections,
  getAnswer,
  getStatus,
  documentTitle = "RFP Response",
  companyName,
}: UseExportOptions) => {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pageSettings, setPageSettings] = useState<PageSettings>(
    DEFAULT_PAGE_SETTINGS
  );
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      const sanitizedTitle = documentTitle
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const timestamp = new Date().toISOString().split("T")[0];

      if (format === "pdf") {
        const blob = await generatePDF({
          sections,
          getAnswer,
          getStatus,
          pageSettings,
          documentTitle,
          companyName,
        });
        downloadBlob(blob, `${sanitizedTitle}_${timestamp}.pdf`);
      } else {
        const blob = await generateDOCX({
          sections,
          getAnswer,
          getStatus,
          pageSettings,
          documentTitle,
          companyName,
        });
        downloadBlob(blob, `${sanitizedTitle}_${timestamp}.docx`);
      }
    } catch (err) {
      console.error("Export failed:", err);
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [format, pageSettings, sections, getAnswer, getStatus, documentTitle, companyName]);

  return {
    format,
    setFormat,
    pageSettings,
    setPageSettings,
    isExporting,
    error,
    handleExport,
  };
};
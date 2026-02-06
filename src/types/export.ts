// src/types/export.ts
// Export types and constants

export type ExportFormat = "pdf" | "docx";

export type PageSize = "a4" | "letter" | "legal";

export type PageOrientation = "portrait" | "landscape";

export interface PageSettings {
  pageSize: PageSize;
  orientation: PageOrientation;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

export interface ExportOptions {
  format: ExportFormat;
  pageSettings: PageSettings;
}

// Page dimensions in mm
export const PAGE_SIZES: Record<PageSize, { width: number; height: number; label: string }> = {
  a4: { width: 210, height: 297, label: "A4" },
  letter: { width: 216, height: 279, label: "Letter" },
  legal: { width: 216, height: 356, label: "Legal" },
};

// Default settings
export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  pageSize: "a4",
  orientation: "portrait",
  margins: {
    top: 20,
    bottom: 20,
    left: 20,
    right: 20,
  },
};

// Convert mm to points (for PDF)
export const mmToPoints = (mm: number): number => mm * 2.83465;

// Convert mm to DXA (for DOCX - 1 inch = 1440 DXA, 1 inch = 25.4mm)
export const mmToDxa = (mm: number): number => Math.round((mm / 25.4) * 1440);

// Get effective page dimensions based on orientation
export const getEffectiveDimensions = (
  pageSize: PageSize,
  orientation: PageOrientation
): { width: number; height: number } => {
  const size = PAGE_SIZES[pageSize];
  if (orientation === "landscape") {
    return { width: size.height, height: size.width };
  }
  return { width: size.width, height: size.height };
};
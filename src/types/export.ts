// src/types/export.ts

export type ExportFormat = "pdf" | "docx";
export type PageSize = "a4" | "letter" | "legal";
export type PageOrientation = "portrait" | "landscape";

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PageSettings {
  pageSize: PageSize;
  orientation: PageOrientation;
  margins: PageMargins;
}

export const PAGE_SIZES: Record<PageSize, { width: number; height: number; label: string }> = {
  a4: { width: 210, height: 297, label: "A4" },
  letter: { width: 215.9, height: 279.4, label: "Letter" },
  legal: { width: 215.9, height: 355.6, label: "Legal" },
};

export const DEFAULT_PAGE_SETTINGS: PageSettings = {
  pageSize: "a4",
  orientation: "portrait",
  margins: {
    top: 25.4,
    bottom: 25.4,
    left: 25.4,
    right: 25.4,
  },
};

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

// Convert mm to DXA (twentieths of a point) for DOCX
export const mmToDxa = (mm: number): number => {
  return Math.round(mm * 56.7); // 1mm ≈ 56.7 DXA
};
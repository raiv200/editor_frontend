// src/lib/generatePDF.ts
// Fixed version with proper HTML formatting support

import { jsPDF } from "jspdf";
import { PageSettings, getEffectiveDimensions } from "@/types/export";

interface Section {
  id: number;
  title: string;
  questions: {
    id: string;
    title: string;
    fullQuestion: string;
  }[];
}

interface GeneratePDFOptions {
  sections: Section[];
  getAnswer: (id: string) => string;
  getStatus: (id: string) => string;
  pageSettings: PageSettings;
  documentTitle?: string;
  companyName?: string | null;
}

// Text segment with formatting
interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: string; // background color
}

// Parse HTML to text segments with formatting preserved
const parseHTMLToSegments = (html: string): TextSegment[] => {
  if (!html || html === "<p></p>") return [];

  const segments: TextSegment[] = [];
  const temp = document.createElement("div");
  temp.innerHTML = html;

  const processNode = (
    node: Node,
    formatting: {
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
      highlight?: string;
    } = {}
  ) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        segments.push({
          text,
          bold: formatting.bold,
          italic: formatting.italic,
          underline: formatting.underline,
          highlight: formatting.highlight,
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      const newFormatting = { ...formatting };

      switch (tagName) {
        case "strong":
        case "b":
          newFormatting.bold = true;
          break;
        case "em":
        case "i":
          newFormatting.italic = true;
          break;
        case "u":
          newFormatting.underline = true;
          break;
        case "mark":
          // Get highlight color from style or use default yellow
          const bgColor = element.style.backgroundColor;
          newFormatting.highlight = bgColor || "#FFFF00";
          break;
        case "span":
          // Check for inline styles (highlight, background)
          if (element.style.backgroundColor) {
            newFormatting.highlight = element.style.backgroundColor;
          }
          // Check for data-color attribute (TipTap highlight)
          if (element.dataset.color) {
            newFormatting.highlight = element.dataset.color;
          }
          break;
        case "br":
          segments.push({ text: "\n" });
          return;
        case "p":
        case "div":
          // Process children then add newline
          element.childNodes.forEach((child) =>
            processNode(child, newFormatting)
          );
          segments.push({ text: "\n" });
          return;
      }

      element.childNodes.forEach((child) => processNode(child, newFormatting));
    }
  };

  temp.childNodes.forEach((child) => processNode(child));

  return segments;
};

// Convert color string to RGB values
const colorToRGB = (
  color: string
): { r: number; g: number; b: number } | null => {
  if (!color) return null;

  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    } else if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  // Handle named colors (common ones)
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    yellow: { r: 255, g: 255, b: 0 },
    red: { r: 255, g: 0, b: 0 },
    green: { r: 0, g: 255, b: 0 },
    blue: { r: 0, g: 0, b: 255 },
    orange: { r: 255, g: 165, b: 0 },
    pink: { r: 255, g: 192, b: 203 },
    cyan: { r: 0, g: 255, b: 255 },
    lightblue: { r: 173, g: 216, b: 230 },
    lightyellow: { r: 255, g: 255, b: 224 },
    lightgreen: { r: 144, g: 238, b: 144 },
  };

  return namedColors[color.toLowerCase()] || { r: 255, g: 255, b: 0 }; // Default to yellow
};

// Draw formatted text with segments
const drawFormattedText = (
  pdf: jsPDF,
  segments: TextSegment[],
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number => {
  let currentX = x;
  let currentY = y;
  const fontSize = 10;
  const charWidth = fontSize * 0.22; // Approximate character width

  for (const segment of segments) {
    if (segment.text === "\n") {
      currentX = x;
      currentY += lineHeight;
      continue;
    }

    // Set font style
    let fontStyle = "normal";
    if (segment.bold && segment.italic) {
      fontStyle = "bolditalic";
    } else if (segment.bold) {
      fontStyle = "bold";
    } else if (segment.italic) {
      fontStyle = "italic";
    }

    pdf.setFont("helvetica", fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(55, 65, 81); // gray-700

    // Split text into words for line wrapping
    const words = segment.text.split(/(\s+)/);

    for (const word of words) {
      const wordWidth = pdf.getTextWidth(word);

      // Check if we need to wrap to next line
      if (currentX + wordWidth > x + maxWidth && currentX > x) {
        currentX = x;
        currentY += lineHeight;
      }

      // Draw highlight background if present
      if (segment.highlight) {
        const rgb = colorToRGB(segment.highlight);
        if (rgb) {
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.rect(
            currentX,
            currentY - lineHeight * 0.7,
            wordWidth,
            lineHeight * 0.9,
            "F"
          );
        }
      }

      // Draw text
      pdf.setTextColor(55, 65, 81);
      pdf.text(word, currentX, currentY);

      // Draw underline if present
      if (segment.underline) {
        pdf.setDrawColor(55, 65, 81);
        pdf.setLineWidth(0.2);
        pdf.line(currentX, currentY + 0.5, currentX + wordWidth, currentY + 0.5);
      }

      currentX += wordWidth;
    }
  }

  return currentY;
};

// Fallback: Convert HTML to plain text
const htmlToText = (html: string): string => {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
};

export const generatePDF = async ({
  sections,
  getAnswer,
  getStatus,
  pageSettings,
  documentTitle = "RFP Response",
  companyName,
}: GeneratePDFOptions): Promise<Blob> => {
  const dimensions = getEffectiveDimensions(
    pageSettings.pageSize,
    pageSettings.orientation
  );

  // Create PDF with correct orientation
  const pdf = new jsPDF({
    orientation: pageSettings.orientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: [dimensions.width, dimensions.height],
  });

  const { margins } = pageSettings;
  const contentWidth = dimensions.width - margins.left - margins.right;

  let currentY = margins.top;

  const addNewPage = () => {
    pdf.addPage();
    currentY = margins.top;
  };

  const checkPageBreak = (requiredHeight: number) => {
    if (currentY + requiredHeight > dimensions.height - margins.bottom) {
      addNewPage();
    }
  };

  // Document Title
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(31, 41, 55); // gray-800
  pdf.text(documentTitle, margins.left, currentY);
  currentY += 8;

  // Company name if provided
  if (companyName) {
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99); // gray-600
    pdf.text(companyName, margins.left, currentY);
    currentY += 6;
  }

  // Subtitle
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(107, 114, 128); // gray-500
  pdf.text("Response Document", margins.left, currentY);
  currentY += 8;

  // Horizontal line
  pdf.setDrawColor(229, 231, 235); // gray-200
  pdf.setLineWidth(0.5);
  pdf.line(margins.left, currentY, dimensions.width - margins.right, currentY);
  currentY += 10;

  // Sections
  for (const section of sections) {
    // Section Header
    checkPageBreak(20);

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(`Section ${section.id}: ${section.title}`, margins.left, currentY);
    currentY += 6;

    // Section underline
    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);
    pdf.line(
      margins.left,
      currentY,
      dimensions.width - margins.right,
      currentY
    );
    currentY += 8;

    if (section.questions.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(156, 163, 175); // gray-400
      pdf.text("No questions in this section", margins.left, currentY);
      currentY += 10;
      continue;
    }

    // Questions
    for (let qIndex = 0; qIndex < section.questions.length; qIndex++) {
      const question = section.questions[qIndex];
      const answer = getAnswer(question.id);
      const hasAnswer =
        answer && answer !== "<p></p>" && answer.trim() !== "";

      // Estimate required height
      const answerText = hasAnswer
        ? htmlToText(answer)
        : "No answer provided yet";
      const estimatedLines = Math.ceil(answerText.length / 80) + 4;
      const estimatedHeight = estimatedLines * 5;

      checkPageBreak(Math.min(estimatedHeight, 60));

      // Question title with numbering
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(31, 41, 55);
      const questionTitle = `Q ${section.id}.${qIndex + 1} - ${question.title}`;
      const titleLines = pdf.splitTextToSize(questionTitle, contentWidth);
      titleLines.forEach((line: string, index: number) => {
        pdf.text(line, margins.left, currentY + index * 4);
      });
      currentY += titleLines.length * 4 + 2;

      // Full question
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(75, 85, 99); // gray-600
      const questionLines = pdf.splitTextToSize(
        question.fullQuestion,
        contentWidth - 5
      );
      questionLines.forEach((line: string, index: number) => {
        if (currentY + index * 4 > dimensions.height - margins.bottom) {
          addNewPage();
        }
        pdf.text(line, margins.left + 5, currentY + index * 4);
      });
      currentY += questionLines.length * 4 + 4;

      // Answer
      checkPageBreak(15);

      if (hasAnswer) {
        // Parse HTML and render with formatting
        const segments = parseHTMLToSegments(answer);

        if (segments.length > 0) {
          // Use formatted text rendering
          const answerX = margins.left + 5;
          const lineHeight = 5;

          // Process segments and render
          let lastY = currentY;

          for (const segment of segments) {
            if (segment.text === "\n") {
              currentY += lineHeight;
              continue;
            }

            // Check page break
            if (currentY > dimensions.height - margins.bottom - 10) {
              addNewPage();
            }

            // Set font style
            let fontStyle = "normal";
            if (segment.bold && segment.italic) {
              fontStyle = "bolditalic";
            } else if (segment.bold) {
              fontStyle = "bold";
            } else if (segment.italic) {
              fontStyle = "italic";
            }

            pdf.setFont("helvetica", fontStyle);
            pdf.setFontSize(10);
            pdf.setTextColor(55, 65, 81);

            // Split text for line wrapping
            const textLines = pdf.splitTextToSize(
              segment.text,
              contentWidth - 10
            );

            for (const line of textLines) {
              if (currentY > dimensions.height - margins.bottom - 4) {
                addNewPage();
              }

              // Draw highlight background if present
              if (segment.highlight) {
                const rgb = colorToRGB(segment.highlight);
                if (rgb) {
                  const textWidth = pdf.getTextWidth(line);
                  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
                  pdf.rect(answerX, currentY - 3, textWidth + 1, 4.5, "F");
                }
              }

              // Draw text
              pdf.setTextColor(55, 65, 81);
              pdf.text(line, answerX, currentY);

              // Draw underline if present
              if (segment.underline) {
                const textWidth = pdf.getTextWidth(line);
                pdf.setDrawColor(55, 65, 81);
                pdf.setLineWidth(0.2);
                pdf.line(
                  answerX,
                  currentY + 0.5,
                  answerX + textWidth,
                  currentY + 0.5
                );
              }

              currentY += lineHeight;
            }

            lastY = currentY;
          }

          currentY = lastY + 2;
        } else {
          // Fallback: use plain text
          const plainText = htmlToText(answer);
          const answerLines = pdf.splitTextToSize(plainText, contentWidth - 5);

          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);

          for (const line of answerLines) {
            if (currentY > dimensions.height - margins.bottom - 4) {
              addNewPage();
            }
            pdf.text(line, margins.left + 5, currentY);
            currentY += 4;
          }
          currentY += 4;
        }
      } else {
        // No answer placeholder
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(156, 163, 175);
        pdf.text("No answer provided yet", margins.left + 5, currentY);
        currentY += 8;
      }

      currentY += 6;
    }

    currentY += 6;
  }

  // Add page numbers
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(156, 163, 175);
    pdf.text(
      `Page ${i} of ${totalPages}`,
      dimensions.width / 2,
      dimensions.height - margins.bottom / 2,
      { align: "center" }
    );
  }

  return pdf.output("blob");
};
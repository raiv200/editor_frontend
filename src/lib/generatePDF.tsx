// src/lib/generatePDF.ts
// Fixed version - properly handles ordered/unordered lists

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
  highlight?: string;
}

// Paragraph with optional list info
interface Paragraph {
  segments: TextSegment[];
  listType?: "ordered" | "unordered";
  listIndex?: number;
  indent?: number;
}

// Parse HTML to paragraphs with list support
const parseHTMLToParagraphs = (html: string): Paragraph[] => {
  if (!html || html === "<p></p>") return [];

  const paragraphs: Paragraph[] = [];
  const temp = document.createElement("div");
  temp.innerHTML = html;

  interface Formatting {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    highlight?: string;
  }

  // Extract text segments from an element with formatting
  const extractSegments = (element: Element | Node, formatting: Formatting = {}): TextSegment[] => {
    const segments: TextSegment[] = [];
    
    const processNode = (node: Node, fmt: Formatting) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        if (text) {
          segments.push({
            text,
            bold: fmt.bold,
            italic: fmt.italic,
            underline: fmt.underline,
            highlight: fmt.highlight,
          });
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        const newFmt = { ...fmt };
        
        switch (tagName) {
          case "strong":
          case "b":
            newFmt.bold = true;
            break;
          case "em":
          case "i":
            newFmt.italic = true;
            break;
          case "u":
            newFmt.underline = true;
            break;
          case "mark":
            newFmt.highlight = el.style.backgroundColor || "yellow";
            break;
          case "span":
            if (el.style.backgroundColor) {
              newFmt.highlight = el.style.backgroundColor;
            }
            break;
        }
        
        el.childNodes.forEach(child => processNode(child, newFmt));
      }
    };
    
    if (element.nodeType === Node.TEXT_NODE) {
      const text = element.textContent || "";
      if (text) {
        segments.push({ text, ...formatting });
      }
    } else {
      (element as Element).childNodes.forEach(child => processNode(child, formatting));
    }
    
    return segments;
  };

  // Process top-level elements
  const processElement = (element: Element) => {
    const tagName = element.tagName.toLowerCase();

    if (tagName === "ol" || tagName === "ul") {
      // Handle list
      const listType = tagName === "ol" ? "ordered" : "unordered";
      const listItems = element.querySelectorAll(":scope > li");
      
      listItems.forEach((li, index) => {
        const segments = extractSegments(li);
        if (segments.length > 0) {
          paragraphs.push({
            segments,
            listType,
            listIndex: index + 1,
            indent: 1,
          });
        }
      });
    } else if (tagName === "p" || tagName === "div") {
      const segments = extractSegments(element);
      if (segments.length > 0) {
        paragraphs.push({ segments });
      }
    } else {
      // For other elements, just extract text
      const segments = extractSegments(element);
      if (segments.length > 0) {
        paragraphs.push({ segments });
      }
    }
  };

  // Process children
  if (temp.children.length > 0) {
    Array.from(temp.children).forEach(processElement);
  } else {
    // No block elements - treat as single paragraph
    const segments = extractSegments(temp);
    if (segments.length > 0) {
      paragraphs.push({ segments });
    }
  }

  return paragraphs;
};

// Convert color to RGB
const colorToRGB = (color: string): { r: number; g: number; b: number } => {
  if (!color) return { r: 255, g: 255, b: 0 };

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

  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  // Named colors
  const namedColors: Record<string, { r: number; g: number; b: number }> = {
    yellow: { r: 255, g: 255, b: 0 },
    red: { r: 255, g: 200, b: 200 },
    green: { r: 200, g: 255, b: 200 },
    blue: { r: 200, g: 200, b: 255 },
    orange: { r: 255, g: 220, b: 180 },
    pink: { r: 255, g: 220, b: 230 },
  };

  return namedColors[color.toLowerCase()] || { r: 255, g: 255, b: 0 };
};

// Draw a paragraph with mixed formatting
const drawParagraph = (
  pdf: jsPDF,
  paragraph: Paragraph,
  startX: number,
  startY: number,
  maxWidth: number,
  lineHeight: number,
  pageHeight: number,
  bottomMargin: number,
  addNewPage: () => void
): number => {
  let currentX = startX;
  let currentY = startY;
  
  // Add indent for lists
  const indentSize = (paragraph.indent || 0) * 8;
  const effectiveStartX = startX + indentSize;
  const effectiveMaxWidth = maxWidth - indentSize;
  
  // Draw list prefix
  if (paragraph.listType) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(55, 65, 81);
    
    const prefix = paragraph.listType === "ordered" 
      ? `${paragraph.listIndex}. `
      : "• ";
    
    pdf.text(prefix, startX, currentY);
    currentX = effectiveStartX;
  } else {
    currentX = effectiveStartX;
  }

  // Draw segments
  for (const segment of paragraph.segments) {
    if (!segment.text) continue;

    // Determine font style
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

    // Split text into words to handle wrapping
    const words = segment.text.split(/( +)/);

    for (const word of words) {
      if (!word) continue;

      const wordWidth = pdf.getTextWidth(word);

      // Check if we need to wrap to next line
      if (currentX + wordWidth > startX + maxWidth && currentX > effectiveStartX) {
        currentX = effectiveStartX;
        currentY += lineHeight;

        // Check page break
        if (currentY > pageHeight - bottomMargin) {
          addNewPage();
          currentY = startY;
        }
      }

      // Draw highlight background if present
      if (segment.highlight && word.trim()) {
        const rgb = colorToRGB(segment.highlight);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
        pdf.rect(currentX, currentY - 3, wordWidth, 4, "F");
      }

      // Draw text
      pdf.setTextColor(55, 65, 81);
      pdf.text(word, currentX, currentY);

      // Draw underline if present
      if (segment.underline && word.trim()) {
        pdf.setDrawColor(55, 65, 81);
        pdf.setLineWidth(0.2);
        pdf.line(currentX, currentY + 0.8, currentX + wordWidth, currentY + 0.8);
      }

      currentX += wordWidth;
    }
  }

  return currentY;
};

// Fallback for plain text
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

  const pdf = new jsPDF({
    orientation: pageSettings.orientation === "landscape" ? "l" : "p",
    unit: "mm",
    format: [dimensions.width, dimensions.height],
  });

  const { margins } = pageSettings;
  const contentWidth = dimensions.width - margins.left - margins.right;
  const pageHeight = dimensions.height;

  let currentY = margins.top;

  const addNewPage = () => {
    pdf.addPage();
    currentY = margins.top;
  };

  const checkPageBreak = (requiredHeight: number) => {
    if (currentY + requiredHeight > pageHeight - margins.bottom) {
      addNewPage();
    }
  };

  // === Document Title ===
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(31, 41, 55);
  pdf.text(documentTitle, margins.left, currentY);
  currentY += 8;

  // Company name
  if (companyName) {
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(75, 85, 99);
    pdf.text(companyName, margins.left, currentY);
    currentY += 6;
  }

  currentY += 8;

  // Line
  pdf.setDrawColor(229, 231, 235);
  pdf.setLineWidth(0.5);
  pdf.line(margins.left, currentY, dimensions.width - margins.right, currentY);
  currentY += 10;

  // === Sections ===
  for (const section of sections) {
    checkPageBreak(20);

    // Section header
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(31, 41, 55);
    pdf.text(`Section ${section.id}: ${section.title}`, margins.left, currentY);
    currentY += 6;

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.3);
    pdf.line(margins.left, currentY, dimensions.width - margins.right, currentY);
    currentY += 8;

    if (section.questions.length === 0) {
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "italic");
      pdf.setTextColor(156, 163, 175);
      pdf.text("No questions in this section", margins.left, currentY);
      currentY += 10;
      continue;
    }

    // === Questions ===
    for (let qIndex = 0; qIndex < section.questions.length; qIndex++) {
      const question = section.questions[qIndex];
      const answer = getAnswer(question.id);
      const hasAnswer = answer && answer !== "<p></p>" && answer.trim() !== "";

      checkPageBreak(25);

      // Question title
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(31, 41, 55);
      const qTitle = `Q ${section.id}.${qIndex + 1} - ${question.title}`;
      const titleLines = pdf.splitTextToSize(qTitle, contentWidth);
      titleLines.forEach((line: string) => {
        checkPageBreak(5);
        pdf.text(line, margins.left, currentY);
        currentY += 4.5;
      });
      currentY += 1;

      // Full question
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(75, 85, 99);
      const questionLines = pdf.splitTextToSize(question.fullQuestion, contentWidth - 5);
      questionLines.forEach((line: string) => {
        checkPageBreak(5);
        pdf.text(line, margins.left + 5, currentY);
        currentY += 4;
      });
      currentY += 3;

      // === Answer ===
      checkPageBreak(10);

      if (hasAnswer) {
        const paragraphs = parseHTMLToParagraphs(answer);

        if (paragraphs.length > 0) {
          for (const paragraph of paragraphs) {
            checkPageBreak(6);
            currentY = drawParagraph(
              pdf,
              paragraph,
              margins.left + 5,
              currentY,
              contentWidth - 10,
              4.5,
              pageHeight,
              margins.bottom,
              addNewPage
            );
            currentY += 4.5; // Space between paragraphs
          }
        } else {
          // Fallback to plain text
          const plainText = htmlToText(answer);
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(55, 65, 81);
          const answerLines = pdf.splitTextToSize(plainText, contentWidth - 10);
          answerLines.forEach((line: string) => {
            checkPageBreak(5);
            pdf.text(line, margins.left + 5, currentY);
            currentY += 4;
          });
        }
        currentY += 2;
      } else {
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "italic");
        pdf.setTextColor(156, 163, 175);
        pdf.text("No answer provided yet", margins.left + 5, currentY);
        currentY += 8;
      }

      currentY += 4;
    }

    currentY += 4;
  }

  // === Page Numbers ===
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
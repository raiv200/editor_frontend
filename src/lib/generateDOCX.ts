// src/lib/generateDOCX.ts
// Fixed version with proper HTML formatting support including highlights

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  BorderStyle,
  AlignmentType,
  PageOrientation,
  Footer,
  PageNumber,
  Header,
  convertMillimetersToTwip,
  ShadingType,
  IRunOptions,
} from "docx";
import { PageSettings, getEffectiveDimensions, mmToDxa } from "@/types/export";

interface Section {
  id: number;
  title: string;
  questions: {
    id: string;
    title: string;
    fullQuestion: string;
  }[];
}

interface GenerateDOCXOptions {
  sections: Section[];
  getAnswer: (id: string) => string;
  getStatus: (id: string) => string;
  pageSettings: PageSettings;
  documentTitle?: string;
  companyName?: string | null;
}

// Convert color string to hex (without #)
const colorToHex = (color: string): string | undefined => {
  if (!color) return undefined;

  // Handle hex colors
  if (color.startsWith("#")) {
    return color.slice(1).toUpperCase();
  }

  // Handle rgb/rgba colors
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
    const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
    const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
    return (r + g + b).toUpperCase();
  }

  // Handle named colors (common ones)
  const namedColors: Record<string, string> = {
    yellow: "FFFF00",
    red: "FF0000",
    green: "00FF00",
    blue: "0000FF",
    orange: "FFA500",
    pink: "FFC0CB",
    cyan: "00FFFF",
    lightblue: "ADD8E6",
    lightyellow: "FFFFE0",
    lightgreen: "90EE90",
  };

  return namedColors[color.toLowerCase()] || "FFFF00"; // Default to yellow
};

// Convert HTML to plain text - robust version that works in browser
const htmlToPlainText = (html: string): string => {
  if (!html || html === "<p></p>") return "";

  // Create a temporary element to parse HTML
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Get text content
  let text = temp.textContent || temp.innerText || "";

  // Clean up whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
};

// Parse HTML and convert to TextRun array with full formatting support
const parseHTMLToTextRuns = (html: string): TextRun[] => {
  if (!html || html === "<p></p>") {
    return [];
  }

  const runs: TextRun[] = [];
  const temp = document.createElement("div");
  temp.innerHTML = html;

  interface Formatting {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    highlight?: string;
  }

  const processNode = (node: Node, formatting: Formatting = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {

        const hexColor = formatting.highlight
            ? colorToHex(formatting.highlight)
            : undefined;

          const runOptions: IRunOptions = {
            text,
            bold: formatting.bold,
            italics: formatting.italic,
            underline: formatting.underline ? {} : undefined,
            size: 22, // 11pt
            color: "374151",

            ...(hexColor && {
              shading: {
                type: ShadingType.CLEAR,
                fill: hexColor,
              },
              highlight: "yellow", // DOCX only supports named highlights
            }),
          };

          runs.push(new TextRun(runOptions));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      const newFormatting: Formatting = { ...formatting };

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
          newFormatting.highlight = bgColor || "yellow";
          break;
        case "span":
          // Check for inline styles (highlight, background)
          if (element.style.backgroundColor) {
            newFormatting.highlight = element.style.backgroundColor;
          }
          // Check for data-color attribute (TipTap highlight extension)
          if (element.dataset.color) {
            newFormatting.highlight = element.dataset.color;
          }
          break;
        case "br":
          runs.push(new TextRun({ break: 1 }));
          return;
      }

      element.childNodes.forEach((child) => processNode(child, newFormatting));
    }
  };

  temp.childNodes.forEach((child) => processNode(child));

  return runs;
};

// Convert HTML to paragraphs for complex content with full formatting
const parseHTMLToParagraphs = (html: string): Paragraph[] => {
  if (!html || html === "<p></p>") {
    return [];
  }

  const paragraphs: Paragraph[] = [];
  const temp = document.createElement("div");
  temp.innerHTML = html;

  const processElement = (element: Element | ChildNode) => {
    if (element.nodeType === Node.TEXT_NODE) {
      const text = element.textContent?.trim();
      if (text) {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text, size: 22, color: "374151" })],
            spacing: { before: 80, after: 80 },
            indent: { left: convertMillimetersToTwip(5) },
          })
        );
      }
      return;
    }

    if (element.nodeType !== Node.ELEMENT_NODE) return;

    const el = element as Element;
    const tagName = el.tagName.toLowerCase();

    if (tagName === "ul" || tagName === "ol") {
      const listItems = el.querySelectorAll(":scope > li");
      listItems.forEach((li, index) => {
        // Process list item content with formatting
        const runs = parseHTMLToTextRuns(li.innerHTML);
        const isOrdered = tagName === "ol";
        const prefix = isOrdered ? `${index + 1}. ` : "• ";

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: prefix,
                size: 22,
                color: "374151",
              }),
              ...runs,
            ],
            indent: { left: convertMillimetersToTwip(10) },
            spacing: { before: 60, after: 60 },
          })
        );
      });
    } else if (tagName === "p" || tagName === "div") {
      const runs = parseHTMLToTextRuns(el.innerHTML);
      if (runs.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: runs,
            spacing: { before: 80, after: 80 },
            indent: { left: convertMillimetersToTwip(5) },
          })
        );
      }
    } else if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
      const level = parseInt(tagName[1]);
      const runs = parseHTMLToTextRuns(el.innerHTML);
      paragraphs.push(
        new Paragraph({
          children:
            runs.length > 0
              ? runs.map(
                  (run) =>
                    new TextRun({
                      ...run,
                      bold: true,
                      size: 28 - level * 2,
                      color: "1F2937",
                    } as IRunOptions)
                )
              : [
                  new TextRun({
                    text: el.textContent || "",
                    bold: true,
                    size: 28 - level * 2,
                    color: "1F2937",
                  }),
                ],
          spacing: { before: 200, after: 100 },
          indent: { left: convertMillimetersToTwip(5) },
        })
      );
    } else {
      // For other elements, try to parse with formatting
      const runs = parseHTMLToTextRuns(el.outerHTML);
      if (runs.length > 0) {
        paragraphs.push(
          new Paragraph({
            children: runs,
            spacing: { before: 80, after: 80 },
            indent: { left: convertMillimetersToTwip(5) },
          })
        );
      }
    }
  };

  // Process children
  if (temp.children.length > 0) {
    Array.from(temp.children).forEach(processElement);
  } else {
    // No block elements - treat entire content as single paragraph
    const runs = parseHTMLToTextRuns(html);
    if (runs.length > 0) {
      paragraphs.push(
        new Paragraph({
          children: runs,
          spacing: { before: 80, after: 80 },
          indent: { left: convertMillimetersToTwip(5) },
        })
      );
    }
  }

  // If still empty, try plain text fallback
  if (paragraphs.length === 0) {
    const plainText = htmlToPlainText(html);
    if (plainText) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: plainText, size: 22, color: "374151" })],
          spacing: { before: 80, after: 80 },
          indent: { left: convertMillimetersToTwip(5) },
        })
      );
    }
  }

  return paragraphs;
};

export const generateDOCX = async ({
  sections,
  getAnswer,
  getStatus,
  pageSettings,
  documentTitle = "RFP Response",
  companyName,
}: GenerateDOCXOptions): Promise<Blob> => {
  const dimensions = getEffectiveDimensions(
    pageSettings.pageSize,
    pageSettings.orientation
  );

  const { margins } = pageSettings;

  // Build document content
  const children: Paragraph[] = [];

  // Document Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: documentTitle,
          bold: true,
          size: 36, // 18pt
          color: "1F2937",
        }),
      ],
      spacing: { after: 100 },
    })
  );

  // Company name if provided
  if (companyName) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: companyName,
            size: 24, // 12pt
            color: "4B5563",
          }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  // Subtitle
  // children.push(
  //   new Paragraph({
  //     children: [
  //       new TextRun({
  //         text: "Response Document",
  //         size: 22, // 11pt
  //         color: "6B7280",
  //       }),
  //     ],
  //     spacing: { after: 400 },
  //     border: {
  //       bottom: {
  //         color: "E5E7EB",
  //         style: BorderStyle.SINGLE,
  //         size: 8,
  //         space: 8,
  //       },
  //     },
  //   })
  // );

  // Sections
  for (const section of sections) {
    // Section Header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Section ${section.id}: ${section.title}`,
            bold: true,
            size: 28, // 14pt
            color: "1F2937",
          }),
        ],
        spacing: { before: 400, after: 200 },
        border: {
          bottom: {
            color: "E5E7EB",
            style: BorderStyle.SINGLE,
            size: 4,
            space: 4,
          },
        },
      })
    );

    if (section.questions.length === 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "No questions in this section",
              italics: true,
              size: 22,
              color: "9CA3AF",
            }),
          ],
          spacing: { before: 100, after: 200 },
        })
      );
      continue;
    }

    // Questions
    for (let qIndex = 0; qIndex < section.questions.length; qIndex++) {
      const question = section.questions[qIndex];
      const answer = getAnswer(question.id);
      const hasAnswer = answer && answer !== "<p></p>" && answer.trim() !== "";

      // Question title with numbering
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Q ${section.id}.${qIndex + 1} - ${question.title}`,
              bold: true,
              size: 24, // 12pt
              color: "1F2937",
            }),
          ],
          spacing: { before: 300, after: 100 },
        })
      );

      // Full question
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: question.fullQuestion,
              size: 22,
              color: "4B5563",
            }),
          ],
          spacing: { before: 60, after: 200 },
          indent: { left: convertMillimetersToTwip(5) },
        })
      );

      // Answer
      if (hasAnswer) {
        // Parse HTML content with formatting
        const answerParagraphs = parseHTMLToParagraphs(answer);

        if (answerParagraphs.length > 0) {
          answerParagraphs.forEach((para) => {
            children.push(para);
          });
        } else {
          // Fallback: use plain text
          const plainText = htmlToPlainText(answer);
          if (plainText) {
            children.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: plainText,
                    size: 22,
                    color: "374151",
                  }),
                ],
                spacing: { before: 80, after: 80 },
                indent: { left: convertMillimetersToTwip(5) },
              })
            );
          }
        }
      } else {
        // No answer placeholder
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "No answer provided yet",
                italics: true,
                size: 22,
                color: "9CA3AF",
              }),
            ],
            spacing: { before: 100, after: 100 },
            indent: { left: convertMillimetersToTwip(5) },
          })
        );
      }

      // Add spacing after each question
      children.push(
        new Paragraph({
          children: [],
          spacing: { after: 100 },
        })
      );
    }
  }

  // Create document
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: "Arial",
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: mmToDxa(dimensions.width),
              height: mmToDxa(dimensions.height),
              orientation:
                pageSettings.orientation === "landscape"
                  ? PageOrientation.LANDSCAPE
                  : PageOrientation.PORTRAIT,
            },
            margin: {
              top: mmToDxa(margins.top),
              bottom: mmToDxa(margins.bottom),
              left: mmToDxa(margins.left),
              right: mmToDxa(margins.right),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: documentTitle,
                    size: 18,
                    color: "9CA3AF",
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Page ",
                    size: 18,
                    color: "9CA3AF",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                    color: "9CA3AF",
                  }),
                  new TextRun({
                    text: " of ",
                    size: 18,
                    color: "9CA3AF",
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                    color: "9CA3AF",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  // Generate blob
  const buffer = await Packer.toBlob(doc);
  return buffer;
};
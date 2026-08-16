import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText } from "unpdf";

type AssessmentFile = {
  filename: string;
  contentType: string;
  bytes: ArrayBuffer;
};

export type DocumentSection = {
  locator: string;
  content: string;
};

const MAX_SECTION_CHARS = 16_000;
const MAX_TOTAL_CHARS = 120_000;

function cleanText(value: string) {
  return value.replaceAll("\u0000", "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function addSection(sections: DocumentSection[], locator: string, content: string) {
  const used = sections.reduce((sum, section) => sum + section.content.length, 0);
  if (used >= MAX_TOTAL_CHARS) return;
  const cleaned = cleanText(content).slice(0, Math.min(MAX_SECTION_CHARS, MAX_TOTAL_CHARS - used));
  if (cleaned.length >= 10) sections.push({ locator, content: cleaned });
}

async function extractPptx(file: AssessmentFile, sections: DocumentSection[]) {
  const zip = await JSZip.loadAsync(file.bytes);
  const slides = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
  for (const [index, name] of slides.entries()) {
    const xml = await zip.file(name)?.async("string");
    if (!xml) continue;
    const text = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("\n");
    addSection(sections, `${file.filename} · slide ${index + 1}`, text);
  }
}

export async function extractDocumentSections(files: AssessmentFile[]) {
  const sections: DocumentSection[] = [];
  const warnings: string[] = [];
  for (const file of files) {
    try {
      if (["text/plain", "text/markdown", "application/json"].includes(file.contentType)) {
        addSection(sections, `${file.filename} · toàn bộ file`, new TextDecoder().decode(file.bytes));
      } else if (file.contentType === "application/pdf") {
        const parsed = await extractText(new Uint8Array(file.bytes), { mergePages: false });
        parsed.text.forEach((text, index) => addSection(sections, `${file.filename} · trang ${index + 1}`, text));
      } else if (file.contentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const result = await mammoth.extractRawText({ buffer: Buffer.from(file.bytes) });
        addSection(sections, `${file.filename} · nội dung tài liệu`, result.value);
        warnings.push(...result.messages.map((message) => `${file.filename}: ${message.message}`));
      } else if (file.contentType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        await extractPptx(file, sections);
      } else if (file.contentType.startsWith("image/")) {
        warnings.push(`${file.filename}: model TokenRouter hiện là text-only nên ảnh cần được mô tả trong phần reflection.`);
      } else {
        warnings.push(`${file.filename}: định dạng chưa hỗ trợ trích xuất văn bản.`);
      }
    } catch (error) {
      warnings.push(`${file.filename}: không trích xuất được (${error instanceof Error ? error.message : "unknown error"}).`);
    }
  }
  if (sections.reduce((sum, section) => sum + section.content.length, 0) >= MAX_TOTAL_CHARS) {
    warnings.push("Nội dung evidence đã được giới hạn để giữ request AI trong context an toàn.");
  }
  return { sections, warnings };
}

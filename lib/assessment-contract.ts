export type EvidenceSource = {
  id: string;
  locator: string;
  content: string;
};

export type AssessmentCitation = {
  sourceId: string;
  locator: string;
  quote: string;
};

export type RubricAssessment = {
  id: string;
  label: string;
  score: number;
  maxScore: number;
  rationale: string;
  citations: AssessmentCitation[];
};

export type AssessmentDraft = {
  schemaVersion: "skillbridge.assessment.v1";
  rubric: RubricAssessment[];
  totalScore: number;
  confidence: number;
  summary: string;
  strengths: string[];
  reviewerFlags: string[];
  grounding: {
    citationCoverage: number;
    unsupportedClaims: string[];
  };
  risk: {
    promptInjectionDetected: boolean;
    insufficientEvidence: boolean;
  };
};

export type AssessmentEnvelope = {
  draft: AssessmentDraft;
  provenance: {
    mode: "tokenrouter" | "gemini" | "openai" | "fixture" | "fixture_fallback" | "manual";
    provider: "tokenrouter" | "gemini" | "openai" | "skillbridge-fixture" | "human-review";
    model: string;
    generatedAt: string;
    validationPassed: boolean;
    validationErrors: string[];
  };
};

export const RUBRIC = [
  { id: "problem_framing", label: "Problem framing", maxScore: 25 },
  { id: "evidence_quality", label: "Evidence quality", maxScore: 25 },
  { id: "strategy_quality", label: "Strategy quality", maxScore: 30 },
  { id: "feasibility", label: "Feasibility", maxScore: 20 },
] as const;

export const DEMO_EVIDENCE: EvidenceSource[] = [
  {
    id: "E1",
    locator: "Slide 3",
    content:
      "Khảo sát 126 sinh viên tại TP.HCM: 62% ưu tiên thương hiệu có thông tin nguồn gốc vật liệu rõ ràng; 47% từng bỏ giỏ hàng vì giá cao.",
  },
  {
    id: "E2",
    locator: "Slides 6–9",
    content:
      "Persona chính là sinh viên 19–23 tuổi. Channel mix ưu tiên TikTok creator nhỏ, campus ambassador và nội dung hậu trường sản xuất.",
  },
  {
    id: "E3",
    locator: "Slide 12",
    content:
      "Ngân sách thử nghiệm 90 ngày là 180 triệu đồng. CAC mục tiêu 118.000 đồng nhưng chưa có nguồn benchmark bên ngoài.",
  },
  {
    id: "E4",
    locator: "Reflection, paragraph 2",
    content:
      "Nhóm loại bỏ quảng cáo diện rộng để ưu tiên hai campus pilot, đổi lại tốc độ tăng nhận diện trong tháng đầu sẽ thấp hơn.",
  },
];

export const ASSESSMENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "rubric",
    "totalScore",
    "confidence",
    "summary",
    "strengths",
    "reviewerFlags",
    "grounding",
    "risk",
  ],
  properties: {
    schemaVersion: { type: "string", enum: ["skillbridge.assessment.v1"] },
    rubric: {
      type: "array",
      minItems: 4,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "score", "maxScore", "rationale", "citations"],
        properties: {
          id: { type: "string", enum: RUBRIC.map((item) => item.id) },
          label: { type: "string" },
          score: { type: "number", minimum: 0, maximum: 30 },
          maxScore: { type: "number", enum: RUBRIC.map((item) => item.maxScore) },
          rationale: { type: "string" },
          citations: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sourceId", "locator", "quote"],
              properties: {
                sourceId: { type: "string" },
                locator: { type: "string" },
                quote: { type: "string" },
              },
            },
          },
        },
      },
    },
    totalScore: { type: "number", minimum: 0, maximum: 100 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    reviewerFlags: { type: "array", items: { type: "string" } },
    grounding: {
      type: "object",
      additionalProperties: false,
      required: ["citationCoverage", "unsupportedClaims"],
      properties: {
        citationCoverage: { type: "number", minimum: 0, maximum: 1 },
        unsupportedClaims: { type: "array", items: { type: "string" } },
      },
    },
    risk: {
      type: "object",
      additionalProperties: false,
      required: ["promptInjectionDetected", "insufficientEvidence"],
      properties: {
        promptInjectionDetected: { type: "boolean" },
        insufficientEvidence: { type: "boolean" },
      },
    },
  },
} as const;

const injectionPatterns = [
  /ignore (all|any|the|previous|prior) (instructions?|rules?|prompts?)/i,
  /system prompt/i,
  /developer message/i,
  /give (me|this submission) (a )?(perfect score|100)/i,
  /bỏ qua (mọi |tất cả )?(chỉ dẫn|hướng dẫn|quy tắc)/i,
  /chấm (tôi|bài này) (100|điểm tối đa)/i,
  /tiết lộ (system prompt|chỉ dẫn hệ thống)/i,
];

export function detectPromptInjection(sources: EvidenceSource[]) {
  return sources.some((source) =>
    injectionPatterns.some((pattern) => pattern.test(source.content)),
  );
}

function normalized(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("vi");
}

export function validateAssessment(
  value: unknown,
  evidence: EvidenceSource[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== "object") {
    return { valid: false, errors: ["Assessment must be an object."] };
  }

  const draft = value as Partial<AssessmentDraft>;
  if (draft.schemaVersion !== "skillbridge.assessment.v1") {
    errors.push("Unsupported assessment schema version.");
  }
  if (!Array.isArray(draft.rubric) || draft.rubric.length !== RUBRIC.length) {
    errors.push("Assessment must contain every rubric item exactly once.");
    return { valid: false, errors };
  }

  const evidenceById = new Map(evidence.map((source) => [source.id, source]));
  let total = 0;
  let groundedItems = 0;

  RUBRIC.forEach((definition) => {
    const item = draft.rubric?.find((candidate) => candidate.id === definition.id);
    if (!item) {
      errors.push(`Missing rubric item: ${definition.id}.`);
      return;
    }
    if (item.label !== definition.label || item.maxScore !== definition.maxScore) {
      errors.push(`Rubric definition changed: ${definition.id}.`);
    }
    if (typeof item.score !== "number" || item.score < 0 || item.score > definition.maxScore) {
      errors.push(`Score out of range: ${definition.id}.`);
    } else {
      total += item.score;
    }
    if (!item.rationale?.trim()) errors.push(`Missing rationale: ${definition.id}.`);

    if (!Array.isArray(item.citations) || item.citations.length === 0) {
      errors.push(`Missing citation: ${definition.id}.`);
      return;
    }

    let itemGrounded = true;
    item.citations.forEach((citation) => {
      const source = evidenceById.get(citation.sourceId);
      if (!source) {
        errors.push(`Unknown evidence source: ${citation.sourceId}.`);
        itemGrounded = false;
        return;
      }
      if (citation.locator !== source.locator) {
        errors.push(`Locator mismatch: ${citation.sourceId}.`);
        itemGrounded = false;
      }
      if (
        normalized(citation.quote).length < 8 ||
        !normalized(source.content).includes(normalized(citation.quote))
      ) {
        errors.push(`Quote is not grounded in ${citation.sourceId}.`);
        itemGrounded = false;
      }
    });
    if (itemGrounded) groundedItems += 1;
  });

  if (draft.totalScore !== total) errors.push("Total score does not equal rubric sum.");
  if (typeof draft.confidence !== "number" || draft.confidence < 0 || draft.confidence > 1) {
    errors.push("Confidence must be between 0 and 1.");
  }
  const expectedCoverage = groundedItems / RUBRIC.length;
  if (
    typeof draft.grounding?.citationCoverage !== "number" ||
    Math.abs(draft.grounding.citationCoverage - expectedCoverage) > 0.001
  ) {
    errors.push("Citation coverage does not match grounded rubric items.");
  }
  if (!Array.isArray(draft.grounding?.unsupportedClaims)) {
    errors.push("Unsupported claims must be an array.");
  }
  if (!Array.isArray(draft.strengths) || !Array.isArray(draft.reviewerFlags)) {
    errors.push("Strengths and reviewer flags must be arrays.");
  }
  if (typeof draft.summary !== "string" || !draft.summary.trim()) {
    errors.push("Assessment summary is required.");
  }
  if (
    typeof draft.risk?.promptInjectionDetected !== "boolean" ||
    typeof draft.risk?.insufficientEvidence !== "boolean"
  ) {
    errors.push("Risk flags are required.");
  }

  return { valid: errors.length === 0, errors };
}

export function makeFixtureAssessment(): AssessmentDraft {
  return {
    schemaVersion: "skillbridge.assessment.v1",
    rubric: [
      {
        id: "problem_framing",
        label: "Problem framing",
        score: 23,
        maxScore: 25,
        rationale: "Vấn đề và rào cản giá được định lượng bằng khảo sát người dùng mục tiêu.",
        citations: [
          {
            sourceId: "E1",
            locator: "Slide 3",
            quote: "62% ưu tiên thương hiệu có thông tin nguồn gốc vật liệu rõ ràng; 47% từng bỏ giỏ hàng vì giá cao.",
          },
        ],
      },
      {
        id: "evidence_quality",
        label: "Evidence quality",
        score: 22,
        maxScore: 25,
        rationale: "Persona và channel mix liên kết với khảo sát, nhưng CAC vẫn thiếu benchmark ngoài.",
        citations: [
          {
            sourceId: "E2",
            locator: "Slides 6–9",
            quote: "Channel mix ưu tiên TikTok creator nhỏ, campus ambassador và nội dung hậu trường sản xuất.",
          },
          {
            sourceId: "E3",
            locator: "Slide 12",
            quote: "CAC mục tiêu 118.000 đồng nhưng chưa có nguồn benchmark bên ngoài.",
          },
        ],
      },
      {
        id: "strategy_quality",
        label: "Strategy quality",
        score: 27,
        maxScore: 30,
        rationale: "Lựa chọn kênh tập trung và trade-off được diễn giải nhất quán với persona.",
        citations: [
          {
            sourceId: "E2",
            locator: "Slides 6–9",
            quote: "Persona chính là sinh viên 19–23 tuổi.",
          },
          {
            sourceId: "E4",
            locator: "Reflection, paragraph 2",
            quote: "Nhóm loại bỏ quảng cáo diện rộng để ưu tiên hai campus pilot",
          },
        ],
      },
      {
        id: "feasibility",
        label: "Feasibility",
        score: 15,
        maxScore: 20,
        rationale: "Có ngân sách và phạm vi pilot, nhưng giả định CAC cần reviewer xác nhận.",
        citations: [
          {
            sourceId: "E3",
            locator: "Slide 12",
            quote: "Ngân sách thử nghiệm 90 ngày là 180 triệu đồng.",
          },
        ],
      },
    ],
    totalScore: 87,
    confidence: 0.84,
    summary:
      "Chiến lược có framing và channel focus tốt; reviewer cần kiểm tra benchmark CAC trước khi phê duyệt.",
    strengths: [
      "Persona và channel mix có liên kết evidence.",
      "Trade-off giữa reach và chất lượng pilot được nêu rõ.",
    ],
    reviewerFlags: ["Xác minh benchmark cho CAC mục tiêu 118.000 đồng."],
    grounding: {
      citationCoverage: 1,
      unsupportedClaims: ["CAC 118.000 đồng chưa có benchmark độc lập."],
    },
    risk: {
      promptInjectionDetected: false,
      insufficientEvidence: false,
    },
  };
}

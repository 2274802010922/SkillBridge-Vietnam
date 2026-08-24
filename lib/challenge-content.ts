export type ChallengeContent = {
  summary: string;
  context: string;
  objectives: string[];
  deliverables: string[];
  constraints: string[];
  timeline: string;
};

const cleanText = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);
const cleanList = (value: unknown, maxItems = 12) => {
  const source = Array.isArray(value) ? value : String(value ?? "").split(/\r?\n/);
  return source.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, maxItems);
};

export function normalizeChallengeContent(input: Partial<ChallengeContent> | null | undefined, fallbackSummary = ""): ChallengeContent {
  return {
    summary: cleanText(input?.summary || fallbackSummary, 600),
    context: cleanText(input?.context, 2400),
    objectives: cleanList(input?.objectives),
    deliverables: cleanList(input?.deliverables),
    constraints: cleanList(input?.constraints),
    timeline: cleanText(input?.timeline, 600),
  };
}

export function parseChallengeContent(value: unknown, fallbackSummary = ""): ChallengeContent {
  try {
    return normalizeChallengeContent(JSON.parse(String(value || "{}")) as Partial<ChallengeContent>, fallbackSummary);
  } catch {
    return normalizeChallengeContent({ summary: fallbackSummary }, fallbackSummary);
  }
}

export function contentForPrompt(content: ChallengeContent) {
  return [
    content.summary && `Summary:\n${content.summary}`,
    content.context && `Context:\n${content.context}`,
    content.objectives.length && `Objectives:\n- ${content.objectives.join("\n- ")}`,
    content.deliverables.length && `Deliverables:\n- ${content.deliverables.join("\n- ")}`,
    content.constraints.length && `Constraints:\n- ${content.constraints.join("\n- ")}`,
    content.timeline && `Timeline:\n${content.timeline}`,
  ].filter(Boolean).join("\n\n");
}

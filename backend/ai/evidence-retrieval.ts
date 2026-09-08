import type { EvidenceSource } from "../../shared/validation/assessment-contract";
import type { DocumentChunk } from "./document-text";
import { estimateTokenCount } from "./document-text";

type RubricLike = { id: string; label: string; maxScore: number };

const STOP_WORDS = new Set([
  "and", "the", "for", "with", "from", "this", "that", "into", "your", "của", "và", "cho", "với", "trong", "một", "các", "được", "là", "từ", "theo", "những", "này", "bài",
]);

function terms(value: string) {
  return value
    .toLocaleLowerCase("vi")
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length >= 3 && !STOP_WORDS.has(term));
}

function scoreChunk(chunk: DocumentChunk, query: string) {
  const queryTerms = new Set(terms(query));
  if (!queryTerms.size) return 0;
  const contentTerms = terms(chunk.content);
  const contentSet = new Set(contentTerms);
  let score = 0;
  for (const term of queryTerms) {
    if (contentSet.has(term)) score += 2;
    else if (contentTerms.some((candidate) => candidate.startsWith(term) || term.startsWith(candidate))) score += 1;
  }
  return score / Math.max(1, Math.sqrt(chunk.tokenEstimate));
}

function toSource(id: string, locator: string, content: string): EvidenceSource {
  return { id, locator, content };
}

export function retrieveEvidence(
  submitted: EvidenceSource[],
  chunks: DocumentChunk[],
  challenge: { title: string; brief: string; rubric: RubricLike[] },
  options?: { topKPerRubric?: number; maxTokens?: number },
) {
  const topKPerRubric = Math.max(1, options?.topKPerRubric ?? 2);
  const maxTokens = Math.max(1000, options?.maxTokens ?? 6000);
  const selected: EvidenceSource[] = [];
  const selectedKeys = new Set<string>();
  let usedTokens = 0;

  for (const source of submitted) {
    const tokenEstimate = estimateTokenCount(source.content);
    if (usedTokens + tokenEstimate > maxTokens) break;
    selected.push(source);
    selectedKeys.add(`${source.locator}:${source.content}`);
    usedTokens += tokenEstimate;
  }

  const pool = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, `${challenge.title} ${challenge.brief}`) }))
    .sort((a, b) => b.score - a.score || a.chunk.ordinal - b.chunk.ordinal);

  for (const rubric of challenge.rubric) {
    const rubricPool = chunks
      .map((chunk) => ({ chunk, score: scoreChunk(chunk, `${rubric.label} ${challenge.title} ${challenge.brief}`) }))
      .sort((a, b) => b.score - a.score || a.chunk.ordinal - b.chunk.ordinal);
    let added = 0;
    for (const candidate of rubricPool) {
      const key = `${candidate.chunk.locator}:${candidate.chunk.content}`;
      if (selectedKeys.has(key)) continue;
      const tokenEstimate = candidate.chunk.tokenEstimate;
      if (usedTokens + tokenEstimate > maxTokens) break;
      selected.push(toSource(`C${selected.length + 1}`, candidate.chunk.locator, candidate.chunk.content));
      selectedKeys.add(key);
      usedTokens += tokenEstimate;
      added += 1;
      if (added >= topKPerRubric) break;
    }
  }

  if (selected.length === submitted.length && chunks.length > 0) {
    for (const candidate of pool) {
      const key = `${candidate.chunk.locator}:${candidate.chunk.content}`;
      if (selectedKeys.has(key)) continue;
      if (usedTokens + candidate.chunk.tokenEstimate > maxTokens) break;
      selected.push(toSource(`C${selected.length + 1}`, candidate.chunk.locator, candidate.chunk.content));
      selectedKeys.add(key);
      usedTokens += candidate.chunk.tokenEstimate;
      if (selected.length >= 4) break;
    }
  }

  return {
    evidence: selected.map((source, index) => ({ ...source, id: `E${index + 1}` })),
    tokenEstimate: usedTokens,
    selectedChunkCount: Math.max(0, selected.length - submitted.length),
  };
}

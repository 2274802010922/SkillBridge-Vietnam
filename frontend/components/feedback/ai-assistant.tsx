"use client";
import { useState } from "react";
import { useLanguage } from "../../i18n/i18n";

export function AiAssistant({
  kind,
  text,
  submissionId,
}: {
  kind: "brief" | "feedback";
  text?: string;
  submissionId?: string;
}) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const [busy, setBusy] = useState(false),
    [suggestions, setSuggestions] = useState<string[]>([]),
    [error, setError] = useState("");
  async function run() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, text, submissionId, locale }),
        signal: AbortSignal.timeout(60000),
      });
      const data = (await response.json()) as {
        suggestions?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "AI unavailable");
      setSuggestions(data.suggestions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI unavailable");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="technical-details ai-disclosure">
      <summary>
        {vi ? "AI hỗ trợ (tùy chọn)" : "AI assistance (optional)"}
      </summary>
      <div className="app-panel">
        <p>
          {vi
            ? "Khi bấm nút, nội dung sẽ được gửi đến nhà cung cấp AI đã cấu hình (OpenRouter khi được chọn). Gợi ý chỉ để tham khảo; bạn tự quyết định và chỉnh sửa."
            : "Clicking sends the content to the configured AI provider (OpenRouter when selected). Suggestions require your review and do not change the official record."}
        </p>
        <button
          type="button"
          className="button button-secondary"
          disabled={busy}
          aria-busy={busy}
          onClick={run}
        >
          {busy
            ? vi
              ? "Đang tạo gợi ý…"
              : "Generating…"
            : kind === "brief"
              ? vi
                ? "Gợi ý làm rõ đề bài"
                : "Review draft clarity"
              : vi
                ? "Diễn giải nhận xét chính thức"
                : "Explain approved feedback"}
        </button>
        {error && <p role="alert">{error}</p>}
        <ul>
          {suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}

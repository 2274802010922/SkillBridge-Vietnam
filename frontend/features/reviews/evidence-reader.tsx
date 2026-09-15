"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "../../i18n/i18n";
import styles from "./evidence-reader.module.css";
export type CitationSelection = { sourceId: string; quote: string };
type FileInfo = {
  id: string;
  name: string;
  type: string;
  hash: string;
  page?: number | null;
};
type Payload = {
  file: FileInfo | null;
  content: string;
  quote?: string;
  warning?: string | null;
};
export function EvidenceReader({
  assessmentId,
  files,
  citation,
}: {
  assessmentId: string | null;
  files: { id: string; original_name: string }[];
  citation: CitationSelection | null;
}) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const [selected, setSelected] = useState(""),
    [view, setView] = useState<Payload | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const id = selected || files[0]?.id;
    if (!id && !citation) return;
    const isCitation = !manual && citation && assessmentId;
    const url = isCitation
      ? `/api/assessments/${assessmentId}/citation?sourceId=${encodeURIComponent(citation.sourceId)}&quote=${encodeURIComponent(citation.quote)}`
      : `/api/files/${id}/text`;
    const timeout = setTimeout(() => {
      if (live) {
        setLoading(true);
        setView(null);
        setError("");
      }
    }, 0);
    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        const d = (await r.json()) as Payload & {
          sections?: { locator: string; content: string }[];
          error?: string;
        };
        if (!r.ok) throw Error(d.error || "File unavailable");
        if (live)
          setView(
            isCitation
              ? d
              : {
                  file: d.file,
                  content: (d.sections || [])
                    .map((s) => s.content)
                    .join("\n\n"),
                },
          );
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [assessmentId, citation, files, selected, manual]);
  function highlight(value: string, quote?: string) {
    if (!quote) return value;
    const at = value.indexOf(quote);
    if (at < 0) return value;
    return (
      <>
        {value.slice(0, at)}
        <mark>{quote}</mark>
        {value.slice(at + quote.length)}
      </>
    );
  }
  return (
    <section
      className={"assessment-column " + styles.reader}
      data-panel="evidence"
    >
      <h3>{vi ? "Tài liệu và bằng chứng" : "Documents and evidence"}</h3>
      <label>
        {vi ? "Chọn tệp" : "Select file"}
        <select
          value={selected || files[0]?.id || ""}
          onChange={(e) => {
            setSelected(e.target.value);
            setManual(true);
          }}
        >
          {files.map((f) => (
            <option key={f.id} value={f.id}>
              {f.original_name}
            </option>
          ))}
        </select>
      </label>
      {citation && (
        <button
          className="button button-secondary"
          onClick={() => setManual(false)}
        >
          {vi ? "Trở lại trích dẫn" : "Return to citation"}
        </button>
      )}
      {loading && (
        <p role="status">{vi ? "Đang đọc tài liệu…" : "Reading document…"}</p>
      )}
      {error && <p role="alert">{error}</p>}
      {view && (
        <>
          <p>
            {view.file?.name ||
              (vi ? "Nguồn văn bản đã lưu" : "Stored text source")}
            {view.file?.page
              ? ` · ${vi ? "Trang" : "Page"} ${view.file.page}`
              : ""}
          </p>
          {view.warning && (
            <p>
              {vi
                ? "Không có vị trí tệp chính xác cho nguồn này. Đoạn dưới là bằng chứng đã lưu; hãy đối chiếu tệp thủ công."
                : "An exact file position is unavailable. The text below is stored evidence; compare the file manually."}
            </p>
          )}
          {view.file?.type === "application/pdf" && (
            <iframe
              title={view.file.name}
              src={`/api/files/${view.file.id}#page=${view.file.page || 1}`}
              className={styles.pdf}
            />
          )}
          {view.file && (
            <a
              href={`/api/files/${view.file.id}`}
              target="_blank"
              rel="noreferrer"
            >
              {vi ? "Mở tệp gốc" : "Open original file"}
            </a>
          )}
          <p className={styles.caption}>
            {vi
              ? "Văn bản trích xuất để đối chiếu; bố cục có thể khác tệp gốc."
              : "Extracted text for comparison; layout may differ from the original."}
          </p>
          <div className={styles.text}>
            {view.content
              ? highlight(view.content, view.quote)
              : vi
                ? "Chưa trích xuất được văn bản. Với tài liệu scan, hãy xem tệp gốc và chấm thủ công."
                : "Text extraction unavailable. For scanned documents, inspect the original and review manually."}
          </div>
          {view.file && (
            <details>
              <summary>{vi ? "Phiên bản tệp" : "File version"}</summary>
              <code>{view.file.hash}</code>
            </details>
          )}
        </>
      )}
    </section>
  );
}

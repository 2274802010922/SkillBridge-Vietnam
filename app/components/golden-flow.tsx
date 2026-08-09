"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Stage = "invited" | "submitted" | "ai_drafted" | "approved" | "issued" | "unlocked" | "revoked";
type DemoEvent = { label: string; detail: string; at: string };
type DemoState = { sessionId: string; stage: Stage; events: DemoEvent[] };

const stages: Array<{ id: Stage; short: string; title: string; owner: string }> = [
  { id: "invited", short: "01", title: "Challenge", owner: "Doanh nghiệp" },
  { id: "submitted", short: "02", title: "Evidence", owner: "Sinh viên" },
  { id: "ai_drafted", short: "03", title: "AI draft", owner: "AI copilot" },
  { id: "approved", short: "04", title: "Review", owner: "Giảng viên" },
  { id: "issued", short: "05", title: "Credential", owner: "Solana" },
  { id: "unlocked", short: "06", title: "Invitation", owner: "Cơ hội" },
];

const actionByStage: Record<Exclude<Stage, "revoked">, { action: string; label: string; helper: string }> = {
  invited: { action: "submit_evidence", label: "Nộp evidence", helper: "Sinh viên gửi strategy deck và reflection." },
  submitted: { action: "generate_ai_draft", label: "Tạo AI assessment", helper: "AI đối chiếu rubric và dẫn chứng cụ thể." },
  ai_drafted: { action: "approve_assessment", label: "Reviewer phê duyệt", helper: "Con người kiểm tra, sửa và chịu trách nhiệm." },
  approved: { action: "issue_credential", label: "Preview cấp credential", helper: "Tạo claim theo schema đã technical-spike." },
  issued: { action: "unlock_opportunity", label: "Kiểm tra & mở khóa", helper: "Gate kiểm tra score, evidence hash và trạng thái." },
  unlocked: { action: "revoke_credential", label: "Thử revoke credential", helper: "Chứng minh utility biến mất sau thu hồi." },
};

function stageIndex(stage: Stage) {
  if (stage === "revoked") return 4;
  return Math.max(0, stages.findIndex((item) => item.id === stage));
}

export function GoldenFlow() {
  const [state, setState] = useState<DemoState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/demo", { cache: "no-store" });
    if (!response.ok) throw new Error("Không thể tải phiên demo.");
    setState((await response.json()) as DemoState);
  }, []);

  useEffect(() => {
    load().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : "Đã có lỗi xảy ra.");
    });
  }, [load]);

  const activeIndex = useMemo(() => (state ? stageIndex(state.stage) : 0), [state]);

  async function act(action: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json()) as DemoState & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Không thể cập nhật demo.");
      setState(payload);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Đã có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }

  const action = state && state.stage !== "revoked" ? actionByStage[state.stage] : null;

  return (
    <div className="demo-console">
      <div className="demo-notice">
        <span>PROTOTYPE MODE</span>
        Workflow lưu trạng thái thật; bước ghi chain đang là preview cho tới khi devnet faucet cấp test SOL.
      </div>

      <div className="stage-rail" aria-label="Tiến độ golden flow">
        {stages.map((item, index) => {
          const complete = index < activeIndex || (state?.stage === "unlocked" && index === activeIndex);
          const active = index === activeIndex && state?.stage !== "revoked";
          return (
            <div className={`stage-item ${complete ? "complete" : ""} ${active ? "active" : ""}`} key={item.id}>
              <span>{complete ? "✓" : item.short}</span>
              <strong>{item.title}</strong><small>{item.owner}</small>
            </div>
          );
        })}
      </div>

      <div className="demo-grid">
        <section className="workspace-panel">
          <div className="panel-topline"><span>BUSINESS CHALLENGE</span><span className="live-dot">ACTIVE</span></div>
          <h3>Growth plan cho thương hiệu thời trang bền vững</h3>
          <p className="challenge-brief">Xây chiến lược tăng trưởng 90 ngày cho một startup Việt Nam, ưu tiên Gen Z tại TP.HCM và ngân sách thực tế.</p>
          <div className="challenge-meta"><span>⏱ 8 giờ</span><span>◎ Marketing</span><span>◇ Team 1–3</span></div>

          <div className="evidence-box">
            <div><span className="file-type">PDF</span><div><strong>growth-strategy-v3.pdf</strong><small>18 trang · evidence hash sẵn sàng</small></div></div>
            <span className={activeIndex >= 1 ? "status-good" : "status-muted"}>{activeIndex >= 1 ? "ĐÃ NỘP" : "CHỜ NỘP"}</span>
          </div>

          <div className={`assessment-box ${activeIndex >= 2 ? "visible" : ""}`}>
            <div className="assessment-head"><div><small>AI ASSESSMENT DRAFT</small><strong>87 / 100</strong></div><span>Confidence 0.84</span></div>
            <div className="rubric-row"><span>Problem framing</span><div><i style={{ width: "90%" }} /></div><strong>9.0</strong></div>
            <div className="rubric-row"><span>Strategy quality</span><div><i style={{ width: "86%" }} /></div><strong>8.6</strong></div>
            <div className="rubric-row"><span>Feasibility</span><div><i style={{ width: "84%" }} /></div><strong>8.4</strong></div>
            <blockquote>“Persona và channel mix được chứng minh tại slide 6–9; CAC assumption cần reviewer xác nhận.”</blockquote>
            <div className={`human-seal ${activeIndex >= 3 ? "approved" : ""}`}>{activeIndex >= 3 ? "✓ HUMAN APPROVED" : "AWAITING HUMAN REVIEW"}</div>
          </div>

          {action ? (
            <div className="next-action">
              <div><small>BƯỚC TIẾP THEO</small><strong>{action.helper}</strong></div>
              <button className="button button-primary" disabled={busy} onClick={() => act(action.action)}>{busy ? "Đang xử lý…" : action.label}</button>
            </div>
          ) : (
            <div className="next-action revoked-action">
              <div><small>UTILITY CHECK</small><strong>Credential đã revoke; invitation không còn truy cập được.</strong></div>
              <button className="button button-dark" disabled={busy} onClick={() => act("reset")}>Chạy lại demo</button>
            </div>
          )}
          {error && <p className="demo-error" role="alert">{error}</p>}
        </section>

        <aside className="proof-panel">
          <div className="proof-panel-label">SKILL PASSPORT</div>
          <div className={`credential-card ${activeIndex >= 4 ? "issued" : ""} ${state?.stage === "revoked" ? "revoked" : ""}`}>
            <div className="credential-top"><span>VLU × SKILLBRIDGE</span><span>PS-001</span></div>
            <div className="credential-score"><strong>{activeIndex >= 4 ? "87" : "—"}</strong><span>GROWTH<br />STRATEGY</span></div>
            <p>Evidence-linked Proof of Skill</p>
            <div className="credential-lines"><span /><span /><span /></div>
            <div className="credential-status">
              {state?.stage === "revoked" ? "REVOKED · ACCESS DENIED" : activeIndex >= 4 ? "ACTIVE · HUMAN APPROVED" : "NOT ISSUED"}
            </div>
          </div>

          <div className={`opportunity-card ${state?.stage === "unlocked" ? "unlocked" : ""}`}>
            <div><span>LEVEL 2 OPPORTUNITY</span><strong>Growth Sprint Interview</strong></div>
            <span className="lock-mark">{state?.stage === "unlocked" ? "OPEN" : "LOCKED"}</span>
          </div>

          <div className="activity-log">
            <div className="activity-title"><span>ACTIVITY</span><button onClick={() => act("reset")} disabled={busy}>Reset</button></div>
            {!state && <p>Đang tạo phiên demo…</p>}
            {state?.events.slice().reverse().slice(0, 4).map((event, index) => (
              <div className="activity-item" key={`${event.at}-${index}`}><span /><div><strong>{event.label}</strong><small>{event.detail}</small></div></div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

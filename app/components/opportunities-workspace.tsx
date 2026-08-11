"use client";

import { useEffect, useState } from "react";

type Membership = {
  id: string;
  organization_id: string;
  organization_name: string;
  organization_kind: string;
  role: string;
};
type University = { id: string; name: string };
type Opportunity = {
  id: string;
  title: string;
  description: string;
  organization_name: string;
  required_issuer_name: string;
  minimum_score: string;
  status: string;
  latest_decision: string | null;
  policy_address: string | null;
  policy_tx: string | null;
};
type AccessResult = {
  decision: string;
  reason: string;
  receiptAddress: string | null;
  recordTx: string | null;
};

const explorerAddress = (value: string) =>
  `https://explorer.solana.com/address/${value}?cluster=devnet`;
const explorerTransaction = (value: string) =>
  `https://explorer.solana.com/tx/${value}?cluster=devnet`;

export function OpportunitiesWorkspace({
  memberships,
  universities,
}: {
  memberships: Membership[];
  universities: University[];
}) {
  const businesses = memberships.filter(
    (item) => item.organization_kind === "business"
      && ["business_admin", "challenge_manager"].includes(item.role),
  );
  const [items, setItems] = useState<Opportunity[]>([]);
  const [organizationId, setOrganizationId] = useState(businesses[0]?.organization_id ?? "");
  const [issuerId, setIssuerId] = useState(universities[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [minimumScore, setMinimumScore] = useState(80);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastAccess, setLastAccess] = useState<AccessResult | null>(null);

  async function load() {
    const response = await fetch("/api/opportunities", { cache: "no-store" });
    if (response.ok) {
      setItems(((await response.json()) as { opportunities: Opportunity[] }).opportunities);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/opportunities", { cache: "no-store" })
      .then((response) => response.ok
        ? response.json() as Promise<{ opportunities: Opportunity[] }>
        : { opportunities: [] })
      .then((data) => {
        if (active) setItems(data.opportunities);
      });
    return () => { active = false; };
  }, []);

  async function create() {
    setBusy(true);
    setLastAccess(null);
    const response = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId,
        title,
        description,
        requiredIssuerOrganizationId: issuerId,
        minimumScore,
      }),
    });
    const data = await response.json() as { error?: string };
    setNotice(response.ok ? "Đã tạo policy on-chain cho cơ hội." : data.error ?? "Không thể tạo cơ hội.");
    if (response.ok) {
      setTitle("");
      setDescription("");
      await load();
    }
    setBusy(false);
  }

  async function verify(id: string) {
    setBusy(true);
    setLastAccess(null);
    const response = await fetch(`/api/opportunities/${id}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = await response.json() as { access?: AccessResult; error?: string };
    if (data.access) {
      setLastAccess(data.access);
      setNotice(`${data.access.decision.toUpperCase()}: ${data.access.reason}`);
    } else {
      setNotice(data.error ?? "Không thể kiểm tra credential.");
    }
    await load();
    setBusy(false);
  }

  return (
    <div className="workspace-product-content">
      <div className="app-welcome">
        <div>
          <span>CREDENTIAL UTILITY</span>
          <h1>Credential phải mở được cơ hội.</h1>
          <p>Mỗi lần kiểm tra đọc lại attestation trên Devnet; credential đã revoke không thể tiếp tục mở khóa.</p>
        </div>
        <div className="identity-card">
          <small>ACTIVE OPPORTUNITIES</small>
          <strong className="metric-number">{items.filter((item) => item.status === "active").length}</strong>
          <b>Live on-chain verification</b>
        </div>
      </div>

      {businesses.length > 0 && (
        <section className="app-panel opportunity-builder">
          <div>
            <span className="panel-kicker">NEW ACCESS POLICY</span>
            <h2>Tạo opportunity gate</h2>
            <p>Policy lưu issuer tin cậy, schema, verifier và ngưỡng điểm trên Solana.</p>
          </div>
          <div className="stack-form">
            <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}>
              {businesses.map((item) => (
                <option value={item.organization_id} key={item.id}>{item.organization_name}</option>
              ))}
            </select>
            <select value={issuerId} onChange={(event) => setIssuerId(event.target.value)}>
              {universities.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Tên cơ hội" />
            <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Quyền lợi hoặc vòng tiếp theo được mở khóa…" />
            <label>
              Điểm tối thiểu
              <input type="number" min="0" max="100" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} />
            </label>
            <button className="button button-dark" disabled={busy || !issuerId} onClick={create}>Tạo policy Devnet</button>
          </div>
        </section>
      )}

      <section className="opportunity-list">
        {items.map((item) => (
          <article key={item.id}>
            <div className="entity-top"><span>{item.organization_name}</span><b>{item.latest_decision ?? item.status}</b></div>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
            <dl>
              <div><dt>TRUSTED ISSUER</dt><dd>{item.required_issuer_name}</dd></div>
              <div><dt>MIN SCORE</dt><dd>{item.minimum_score}</dd></div>
            </dl>
            {item.policy_address && (
              <div className="chain-actions">
                <a href={explorerAddress(item.policy_address)} target="_blank" rel="noreferrer">Policy account ↗</a>
                {item.policy_tx && <a href={explorerTransaction(item.policy_tx)} target="_blank" rel="noreferrer">Create tx ↗</a>}
              </div>
            )}
            {item.status === "active" && (
              <button className="button button-primary" disabled={busy} onClick={() => verify(item.id)}>Verify ví hiện tại & unlock</button>
            )}
          </article>
        ))}
      </section>

      {notice && <p className="app-notice">{notice}</p>}
      {lastAccess?.receiptAddress && (
        <div className="chain-actions access-receipt-links">
          <a href={explorerAddress(lastAccess.receiptAddress)} target="_blank" rel="noreferrer">Access receipt ↗</a>
          {lastAccess.recordTx && <a href={explorerTransaction(lastAccess.recordTx)} target="_blank" rel="noreferrer">Record transaction ↗</a>}
        </div>
      )}
    </div>
  );
}

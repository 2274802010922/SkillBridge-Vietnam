import type { Metadata } from "next";
import { GoldenFlow } from "./components/golden-flow";

export const metadata: Metadata = {
  title: "Bằng chứng kỹ năng mở khóa cơ hội",
  description:
    "Trải nghiệm golden flow của SkillBridge: evidence, AI assessment, human review, Solana credential và cơ hội tiếp theo.",
};

export default function Home() {
  return (
    <main>
      <header className="site-header page-shell">
        <a className="wordmark" href="#top" aria-label="SkillBridge Vietnam">
          <span className="wordmark-mark" aria-hidden="true">S</span>
          <span>SkillBridge</span>
          <small>VIETNAM</small>
        </a>
        <nav aria-label="Điều hướng chính">
          <a href="#demo">Demo</a>
          <a href="/workspace">Role workspace</a>
          <a href="#trust">Cách hoạt động</a>
          <a href="#pilot">Pilot</a>
        </nav>
        <a className="header-cta" href="/workspace">Mở role workspace</a>
      </header>

      <section className="hero page-shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> VLU pilot · Vietnam-first</div>
          <h1>Bài làm tốt<br />không nên <em>biến mất.</em></h1>
          <p className="hero-lede">
            SkillBridge biến sản phẩm sinh viên thành bằng chứng kỹ năng có thể
            kiểm chứng—được AI hỗ trợ đánh giá, con người phê duyệt và dùng để
            mở khóa cơ hội thật.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/workspace">Chạy end-to-end</a>
            <a className="text-link" href="#trust">Xem trust architecture <span>↗</span></a>
          </div>
          <div className="hero-proof" aria-label="Nguyên tắc sản phẩm">
            <span>AI có evidence</span>
            <span>Human-in-the-loop</span>
            <span>Solana verifiable</span>
          </div>
        </div>

        <div className="hero-object" aria-label="Vòng lặp bằng chứng kỹ năng">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="proof-card proof-card-main">
            <div className="card-kicker">PROOF OF SKILL · 001</div>
            <div className="score-ring"><strong>87</strong><span>/100</span></div>
            <h2>Growth Strategy</h2>
            <p>VLU Marketing Challenge</p>
            <div className="proof-meta">
              <span>✓ Human approved</span>
              <span>Evidence linked</span>
            </div>
          </div>
          <div className="proof-card proof-card-mini top">
            <span className="mini-icon">01</span>
            <div><strong>BUILD</strong><small>Sản phẩm thật</small></div>
          </div>
          <div className="proof-card proof-card-mini bottom">
            <span className="mini-icon accent">02</span>
            <div><strong>UNLOCK</strong><small>Cơ hội tiếp theo</small></div>
          </div>
        </div>
      </section>

      <section className="trust-strip" aria-label="Chuỗi giá trị">
        <div className="page-shell trust-steps">
          {[
            ["01", "LEARN", "Học từ brief thật"],
            ["02", "BUILD", "Tạo evidence"],
            ["03", "PROVE", "Đánh giá có dẫn chứng"],
            ["04", "UNLOCK", "Mở cơ hội mới"],
          ].map(([number, label, detail]) => (
            <div className="trust-step" key={number}>
              <span>{number}</span><div><strong>{label}</strong><small>{detail}</small></div>
            </div>
          ))}
        </div>
      </section>

      <section className="demo-section page-shell" id="demo">
        <div className="section-heading">
          <div><div className="eyebrow"><span /> Interactive vertical slice</div>
          <h2>Từ evidence đến invitation<br />trong một luồng.</h2></div>
          <p>Không phải marketplace tổng quát. Một challenge, một submission và một credential có utility rõ ràng.</p>
        </div>
        <GoldenFlow />
      </section>

      <section className="trust-architecture" id="trust">
        <div className="page-shell">
          <div className="section-heading light">
            <div><div className="eyebrow"><span /> Trust architecture</div>
            <h2>AI đề xuất.<br />Con người quyết định.</h2></div>
            <p>Dữ liệu nhạy cảm ở off-chain. Solana chỉ giữ claim tối thiểu cần để kiểm chứng tính toàn vẹn và trạng thái.</p>
          </div>
          <div className="architecture-grid">
            <article><span>AI</span><h3>Assessment contract</h3><p>Structured output theo rubric, citation được đối chiếu với evidence trước khi hiển thị.</p><small>15/15 contract evals pass</small></article>
            <article><span>H</span><h3>Human review</h3><p>Reviewer sửa, duyệt và chịu trách nhiệm cho kết quả cuối cùng.</p><small>Có audit trail & appeal</small></article>
            <article><span>S</span><h3>Solana proof</h3><p>Issuer, schema, score, evidence hash, expiry và trạng thái revoke.</p><small>Không ghi PII lên chain</small></article>
            <article className="architecture-outcome"><span>↗</span><h3>Reusable access</h3><p>Credential hợp lệ mở invitation; credential bị revoke mất utility ngay.</p><small>Verify → unlock → re-check</small></article>
          </div>
        </div>
      </section>

      <section className="pilot-section page-shell" id="pilot">
        <div className="pilot-card">
          <div><div className="eyebrow"><span /> Pilot 01</div><h2>Khởi đầu tại Văn Lang.<br />Thiết kế cho Việt Nam.</h2></div>
          <div className="pilot-copy"><p>Một business challenge ngắn, 10–20 sinh viên, một reviewer team và một doanh nghiệp nhận talent signal dựa trên sản phẩm thật.</p><a className="button button-dark" href="mailto:pilot@skillbridge.vn">Trở thành design partner</a></div>
        </div>
      </section>

      <footer className="site-footer page-shell">
        <div className="wordmark"><span className="wordmark-mark">S</span><span>SkillBridge</span></div>
        <p>Proof-of-Skill Challenge Infrastructure for Vietnam.</p>
        <span>Built for UniHackFest · 2026</span>
      </footer>
    </main>
  );
}

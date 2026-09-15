"use client";
import { useEffect, useState } from "react";
import { getWallets } from "@wallet-standard/app";
import {
  StandardConnect,
  type StandardConnectFeature,
} from "@wallet-standard/features";
import {
  SolanaSignTransaction,
  type SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";
import type { Wallet } from "@wallet-standard/base";
import { useLanguage } from "../../i18n/i18n";
type SigningWallet = Wallet & {
  features: StandardConnectFeature & SolanaSignTransactionFeature;
};
type Reply = {
  enabled?: boolean;
  claim?: { id: string; status: string; signature: string | null };
  id?: string;
  status?: string;
  signature?: string;
  transaction?: string;
  error?: string;
};
export function SponsoredClaimButton({
  escrow,
  recipient,
  onConfirmed,
}: {
  escrow: string;
  recipient: string;
  onConfirmed: () => void;
}) {
  const { locale } = useLanguage(),
    vi = locale === "vi";
  const [wallets, setWallets] = useState<SigningWallet[]>([]),
    [selected, setSelected] = useState("");
  const [available, setAvailable] = useState(false),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState(""),
    [signature, setSignature] = useState("");
  useEffect(() => {
    const registry = getWallets();
    const update = () => {
      const list = registry
        .get()
        .filter(
          (w) =>
            StandardConnect in w.features &&
            SolanaSignTransaction in w.features,
        ) as SigningWallet[];
      setWallets(list);
      setSelected((s) =>
        list.some((w) => w.name === s) ? s : list[0]?.name || "",
      );
    };
    update();
    const a = registry.on("register", update),
      b = registry.on("unregister", update);
    return () => {
      a();
      b();
    };
  }, []);
  useEffect(() => {
    let live = true;
    fetch(`/api/claims/sponsored?escrow=${encodeURIComponent(escrow)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        if (!r.ok) return;
        const d = (await r.json()) as Reply;
        if (!live) return;
        setAvailable(!!d.enabled);
        if (d.claim?.signature) setSignature(d.claim.signature);
        setPending(d.claim?.status === "broadcast");
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [escrow]);
  async function check() {
    const r = await fetch(
      `/api/claims/sponsored?escrow=${encodeURIComponent(escrow)}`,
      { cache: "no-store" },
    );
    const d = (await r.json()) as Reply;
    if (!r.ok) throw Error(d.error || "Cannot verify");
    if (d.claim?.signature) setSignature(d.claim.signature);
    if (d.claim?.status === "finalized") {
      setPending(false);
      setNotice(
        vi
          ? "Đã nhận thưởng. Phí mạng được tài trợ."
          : "Reward received. Network fees were sponsored.",
      );
      onConfirmed();
    } else if (["failed", "expired"].includes(d.claim?.status || "")) {
      setPending(false);
      setNotice(
        vi
          ? "Giao dịch không hoàn tất; có thể tạo yêu cầu mới."
          : "Transaction did not complete; a new request can be prepared.",
      );
    } else
      setNotice(
        vi
          ? "Đang chờ xác nhận. Không cần ký lại."
          : "Awaiting confirmation. No new signature needed.",
      );
  }
  async function run() {
    setBusy(true);
    setNotice("");
    try {
      if (pending) {
        await check();
        return;
      }
      const wallet = wallets.find((w) => w.name === selected);
      if (!wallet)
        throw Error(
          vi
            ? "Chọn ví hỗ trợ ký giao dịch."
            : "Select a wallet that supports transaction signing.",
        );
      const accounts = (await wallet.features[StandardConnect].connect())
        .accounts;
      const account = accounts.find((a) => a.address === recipient);
      if (!account)
        throw Error(
          vi
            ? "Kết nối đúng ví nhận thưởng."
            : "Connect the reward recipient wallet.",
        );
      const r = await fetch("/api/claims/sponsored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", escrow }),
      });
      const d = (await r.json()) as Reply;
      if (!r.ok) throw Error(d.error || "Sponsor unavailable");
      if (d.status !== "prepared") {
        setPending(d.status === "broadcast");
        await check();
        return;
      }
      const bytes = Uint8Array.from(atob(d.transaction!), (c) =>
        c.charCodeAt(0),
      );
      const [signed] = await wallet.features[
        SolanaSignTransaction
      ].signTransaction({
        account,
        chain: "solana:devnet",
        transaction: bytes,
      });
      const wire = btoa(
        Array.from(signed.signedTransaction, (b) =>
          String.fromCharCode(b),
        ).join(""),
      );
      const send = await fetch("/api/claims/sponsored", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", id: d.id, transaction: wire }),
      });
      const reply = (await send.json()) as Reply;
      if (!send.ok) throw Error(reply.error || "Sending failed");
      setSignature(reply.signature || "");
      setPending(true);
      await check();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <h3>{vi ? "Nhận thưởng có tài trợ phí" : "Claim with sponsored fees"}</h3>
      <p>
        {available
          ? vi
            ? "Bạn xác nhận bằng ví; ứng dụng trả phí SOL Devnet trong hạn mức."
            : "You approve in your wallet; the app pays Devnet SOL fees within its budget."
          : vi
            ? "Tài trợ phí chưa khả dụng. Có thể dùng lựa chọn tự trả phí bên dưới."
            : "Sponsorship is unavailable. You can use the self-paid option below."}
      </p>
      {(available || pending) && (
        <>
          <label>
            {vi ? "Ví nhận thưởng" : "Recipient wallet"}
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={busy}
            >
              {wallets.map((w) => (
                <option key={w.name}>{w.name}</option>
              ))}
            </select>
          </label>
          <button
            className="button button-primary"
            aria-busy={busy}
            disabled={busy || (!pending && !wallets.length)}
            onClick={() => void run()}
          >
            {busy
              ? vi
                ? "Đang xử lý…"
                : "Processing…"
              : pending
                ? vi
                  ? "Kiểm tra giao dịch đã gửi"
                  : "Check submitted transaction"
                : vi
                  ? "Nhận thưởng — ứng dụng trả phí"
                  : "Claim — app pays fees"}
          </button>
        </>
      )}
      {notice && <p role="status">{notice}</p>}
      {signature && (
        <a
          href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
          target="_blank"
          rel="noreferrer"
        >
          {vi ? "Xem giao dịch" : "View transaction"}
        </a>
      )}
    </section>
  );
}

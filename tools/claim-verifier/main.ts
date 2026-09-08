import { getWallets } from "@wallet-standard/app";
import {
  StandardConnect,
  type StandardConnectFeature,
} from "@wallet-standard/features";
import {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
  type SolanaSignAndSendTransactionFeature,
  type SolanaSignTransactionFeature,
} from "@solana/wallet-standard-features";
import type { Wallet } from "@wallet-standard/base";
import bs58 from "bs58";
document
  .getElementById("credential-form")!
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = document.getElementById("credential-result")!;
    result.textContent = "Đang đọc chứng nhận trực tiếp từ Solana…";
    try {
      const checked = await verifyIndependentCredential({
        rpc: getRpc(),
        attestation: input("attestation").value.trim(),
        wallet: input("candidate").value.trim(),
        challengeId: input("challenge-id").value.trim(),
        trustedIssuers: (
          document.getElementById("trusted") as HTMLTextAreaElement
        ).value
          .split(/\s+/)
          .filter(Boolean),
        minimumScore: Number(input("score").value),
      });
      const conclusion = checked.accepted
        ? "Chứng nhận đạt các điều kiện bạn đã chọn."
        : "Chứng nhận chưa đạt điều kiện: " +
          [
            !checked.active && "đã hết hạn hoặc bị tạm dừng",
            !checked.signerAuthorized && "người ký không còn được ủy quyền",
            !checked.trusted &&
              "đơn vị phát hành chưa nằm trong danh sách bạn tin tưởng",
            !checked.matches && "ví, thử thách, điểm hoặc phê duyệt không khớp",
          ]
            .filter(Boolean)
            .join("; ") +
          ".";
      result.textContent =
        conclusion +
        "\n\n" +
        JSON.stringify(
          checked,
          (_, value) => (typeof value === "bigint" ? value.toString() : value),
          2,
        );
    } catch (error) {
      result.textContent =
        error instanceof Error
          ? error.message
          : "Không tìm thấy chứng nhận còn hiệu lực.";
    }
  });
import { Buffer } from "buffer";
import { verifyIndependentCredential } from "../../solana/client/independent-credential";
import {
  inspectReward,
  buildIndependentClaim,
  verifyCommittedText,
  upgradeAuthority,
} from "../../solana/client/independent-claim";
import { escrowRpc, SYSTEM } from "../../solana/client/challenge-escrow";

type PaymentWallet = Wallet & {
  features: StandardConnectFeature &
    Partial<SolanaSignAndSendTransactionFeature & SolanaSignTransactionFeature>;
};
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const notice = document.getElementById("notice")!;
const button = document.getElementById("claim") as HTMLButtonElement;
const wallets = document.getElementById(
  "wallet",
) as unknown as HTMLSelectElement;
const registry = getWallets();
let current: Awaited<ReturnType<typeof inspectReward>> | null = null;
let busy = false;
function supported() {
  return registry
    .get()
    .filter(
      (w) =>
        StandardConnect in w.features &&
        (SolanaSignTransaction in w.features ||
          SolanaSignAndSendTransaction in w.features),
    ) as PaymentWallet[];
}
function updateWallets() {
  const selected = wallets.value;
  wallets.replaceChildren();
  for (const w of supported()) {
    const option = document.createElement("option");
    option.value = w.name;
    option.textContent = w.name;
    wallets.appendChild(option);
  }
  if ([...wallets.options].some((o) => o.value === selected))
    wallets.value = selected;
  button.disabled = busy || !current?.claimable || !wallets.options.length;
}
registry.on("register", updateWallets);
registry.on("unregister", updateWallets);
updateWallets();
const getRpc = () => {
  const url = new URL(input("rpc").value);
  if (
    url.protocol !== "https:" &&
    url.hostname !== "localhost" &&
    url.hostname !== "127.0.0.1"
  )
    throw new Error("RPC phải dùng HTTPS.");
  return url.href;
};
const key = () =>
  current
    ? "skillbridge-independent:" + current.escrow + ":" + current.recipient
    : "";
function amount(value: string, decimals: number) {
  const n = BigInt(value),
    scale = BigInt(10) ** BigInt(decimals);
  const fraction = (n % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return (n / scale).toString() + (fraction ? "." + fraction : "");
}
async function inspect() {
  if (busy) return;
  busy = true;
  button.disabled = true;
  notice.textContent = "Đang đọc trạng thái finalized…";
  document.getElementById("inspect")!.setAttribute("aria-busy", "true");
  document.getElementById("result")!.hidden = true;
  document.getElementById("terms-status")!.textContent = "";
  try {
    current = null;
    current = await inspectReward(
      getRpc(),
      input("escrow").value.trim(),
      input("recipient").value.trim(),
    );
    const e = current.state;
    const units = e.mint === SYSTEM ? 9 : 6;
    document.getElementById("state")!.textContent = [
      "Chương trình: " + current.program,
      "Quỹ: " + current.escrow,
      "Ví nhận: " + current.recipient,
      "Phần thưởng mỗi suất: " +
        amount(e.amount, units) +
        (units === 9 ? " SOL Devnet" : " USDC Devnet"),
      "Đã nạp: " + amount(e.funded, units),
      "Đã phân bổ: " + amount(e.allocated, units),
      "Đã nhận: " + amount(e.paid, units),
      "Đã hoàn phần dư: " + amount(e.refunded, units),
      "Hash cam kết: " + e.terms,
      "Hash bài nộp: " + (current.submission?.evidenceHash || "Chưa có"),
      "Hash kết quả: " + (current.submission?.resultHash || "Chưa có"),
      "Reviewer chính: " + e.reviewer,
      "Reviewer dự phòng: " + e.backup,
      "Trạng thái: " +
        (current.submission?.paid
          ? "Đã nhận thưởng"
          : current.claimable
            ? "Có quyền nhận thưởng"
            : "Chưa được phân bổ thưởng"),
    ].join("\n");
    document.getElementById("result")!.hidden = false;
    const explorer = document.getElementById("explorer") as HTMLAnchorElement;
    explorer.href =
      "https://explorer.solana.com/address/" +
      current.escrow +
      "?cluster=devnet";
    notice.textContent = "Đã đọc dữ liệu finalized trực tiếp từ Solana.";
    if (current.submission?.paid) localStorage.removeItem(key());
    try {
      const authority = await upgradeAuthority(getRpc());
      document.getElementById("upgrade")!.textContent = authority.upgradeable
        ? "Chương trình có thể nâng cấp. Authority: " + authority.authority
        : "Đã xác minh: chương trình không còn upgrade authority.";
    } catch {
      document.getElementById("upgrade")!.textContent =
        "Chưa đọc được quyền nâng cấp; không được hiểu là chương trình bất biến.";
    }
  } catch (e) {
    current = null;
    notice.textContent = e instanceof Error ? e.message : "Không đọc được quỹ.";
  } finally {
    busy = false;
    document.getElementById("inspect")!.setAttribute("aria-busy", "false");
    updateWallets();
  }
}
document.getElementById("inspect")!.addEventListener("submit", (e) => {
  e.preventDefault();
  void inspect();
});
document
  .getElementById("refresh")!
  .addEventListener("click", () => void inspect());
input("terms").addEventListener("change", async () => {
  const file = input("terms").files?.[0];
  const status = document.getElementById("terms-status")!;
  if (!file || !current) return;
  if (file.size > 2 * 1024 * 1024) {
    status.textContent = "Tệp quá lớn (tối đa 2 MB).";
    return;
  }
  try {
    const raw = await file.text();
    let text = raw,
      hash = current.state.terms,
      kind = "điều khoản";
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* Raw committed JSON/text is supported. */
    }
    if (typeof parsed.termsText === "string") text = parsed.termsText;
    if (parsed.kind === "submission" || parsed.kind === "result") {
      if (typeof parsed.committedText !== "string")
        throw new Error("Thiếu nội dung đối chiếu.");
      text = parsed.committedText;
      kind = parsed.kind === "submission" ? "bài nộp" : "kết quả";
      hash =
        (parsed.kind === "submission"
          ? current.submission?.evidenceHash
          : current.submission?.resultHash) || "";
      if (!hash) throw new Error("Chưa có cam kết tương ứng trên chuỗi.");
      if (parsed.kind === "result") {
        const result = JSON.parse(text);
        if (
          result.finalHash &&
          (typeof parsed.finalDraftText !== "string" ||
            !(await verifyCommittedText(
              parsed.finalDraftText,
              result.finalHash,
            )))
        )
          throw new Error("Chi tiết điểm không khớp hash kết quả.");
      }
    }
    status.textContent = (await verifyCommittedText(text, hash))
      ? "Nội dung " + kind + " khớp chính xác cam kết on-chain."
      : "Nội dung " + kind + " KHÔNG khớp cam kết on-chain.";
  } catch {
    status.textContent = "Không đọc được tệp.";
  }
});
button.addEventListener("click", async () => {
  if (busy || !current?.claimable) return;
  busy = true;
  button.disabled = true;
  try {
    const rpc = getRpc(),
      escrow = input("escrow").value.trim(),
      recipient = input("recipient").value.trim();
    if (escrow !== current.escrow || recipient !== current.recipient)
      throw new Error("Thông tin đã đổi. Hãy kiểm tra lại trước khi ký.");
    const storageKey = key(),
      pending = localStorage.getItem(storageKey);
    if (pending) {
      const states = await escrowRpc<{
        value: Array<{ err: unknown; confirmationStatus: string } | null>;
      }>(rpc, "getSignatureStatuses", [
        [pending],
        { searchTransactionHistory: true },
      ]);
      if (!states.value[0]?.err)
        throw new Error(
          "Đã có giao dịch đang chờ kiểm tra: " +
            pending +
            ". Dùng Kiểm tra lại; không ký giao dịch thứ hai.",
        );
      localStorage.removeItem(storageKey);
    }
    const wallet = supported().find((w) => w.name === wallets.value);
    if (!wallet) throw new Error("Chưa tìm thấy ví tương thích.");
    notice.textContent = "Mở ví để kết nối và kiểm tra người nhận.";
    const connected = await wallet.features[StandardConnect].connect();
    const account = connected.accounts.find((a) => a.address === recipient);
    if (!account) throw new Error("Ví đang kết nối không khớp ví nhận thưởng.");
    const unsigned = Buffer.from(
      await buildIndependentClaim(rpc, escrow, recipient),
      "base64",
    );
    let signature: string;
    const signOnly = wallet.features[SolanaSignTransaction],
      signAndSend = wallet.features[SolanaSignAndSendTransaction];
    notice.textContent = "Kiểm tra giao dịch và ký nhận thưởng trong ví.";
    if (signOnly?.supportedTransactionVersions.includes("legacy")) {
      const [signed] = await signOnly.signTransaction({
        account,
        chain: "solana:devnet",
        transaction: unsigned,
      });
      signature = bs58.encode(signed.signedTransaction.slice(1, 65));
      localStorage.setItem(storageKey, signature);
      await escrowRpc<string>(rpc, "sendTransaction", [
        Buffer.from(signed.signedTransaction).toString("base64"),
        { encoding: "base64", preflightCommitment: "confirmed" },
      ]);
    } else if (signAndSend?.supportedTransactionVersions.includes("legacy")) {
      const [sent] = await signAndSend.signAndSendTransaction({
        account,
        chain: "solana:devnet",
        transaction: unsigned,
      });
      signature = bs58.encode(sent.signature);
      localStorage.setItem(storageKey, signature);
    } else throw new Error("Ví không hỗ trợ giao dịch legacy.");
    notice.textContent =
      "Đã gửi: " + signature + ". Chờ xác nhận rồi bấm Kiểm tra lại.";
    const link = document.createElement("a");
    link.href =
      "https://explorer.solana.com/tx/" + signature + "?cluster=devnet";
    link.textContent = " Xem giao dịch";
    link.target = "_blank";
    link.rel = "noreferrer";
    notice.appendChild(link);
  } catch (e) {
    notice.textContent =
      e instanceof Error
        ? e.message
        : "Không thể ký. Hãy kiểm tra trạng thái trên chuỗi.";
  } finally {
    busy = false;
    updateWallets();
  }
});

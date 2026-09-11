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
import { initWalletLookup, text as tr } from "./wallet-lookup";
const locale =
  new URLSearchParams(location.search).get("lang") === "en" ? "en" : "vi";
document.documentElement.lang = locale;
document.title = locale === "en" ? "SkillBridge — Wallet lookup" : "SkillBridge — Tra cứu ví";
if (locale === "en")
  document.querySelectorAll<HTMLElement>("[data-en]").forEach((node) => {
    node.textContent = node.dataset.en || node.textContent;
  });
for (const language of ["vi", "en"]) {
  const url = new URL(location.href);
  url.searchParams.set("lang", language);
  (document.getElementById("lang-" + language) as HTMLAnchorElement).href =
    url.href;
}
document
  .getElementById("credential-form")!
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const result = document.getElementById("credential-result")!;
    result.textContent = tr(
      "Đang đọc chứng nhận trực tiếp từ Solana…",
      "Reading the credential from Solana…",
    );
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
        ? tr(
            "Chứng nhận đạt các điều kiện bạn đã chọn.",
            "The credential meets your selected policy.",
          )
        : tr(
            "Chứng nhận chưa đạt điều kiện: ",
            "The credential does not meet the policy: ",
          ) +
          [
            !checked.active &&
              tr("đã hết hạn hoặc bị tạm dừng", "expired or paused"),
            !checked.signerAuthorized &&
              tr(
                "người ký không còn được ủy quyền",
                "signer no longer authorized",
              ),
            !checked.trusted &&
              tr(
                "đơn vị phát hành chưa nằm trong danh sách bạn tin tưởng",
                "issuer not in your trusted list",
              ),
            !checked.matches &&
              tr(
                "ví, thử thách, điểm hoặc phê duyệt không khớp",
                "wallet, challenge, score or approval mismatch",
              ),
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
          : tr(
              "Không tìm thấy chứng nhận còn hiệu lực.",
              "No active credential found.",
            );
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
  button.disabled = busy || !current?.claimable || !supported().length;
  (document.getElementById("connect-lookup") as HTMLButtonElement).disabled =
    !supported().length || busy;
  document.getElementById("wallet-help")!.textContent = supported().length
    ? ""
    : tr(
        "Chưa phát hiện ví trong trình duyệt. Bạn vẫn có thể dán địa chỉ để tra cứu.",
        "No browser wallet detected. You can still paste an address to look it up.",
      );
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
    throw new Error(tr("RPC phải dùng HTTPS.", "RPC must use HTTPS."));
  return url.href;
};
initWalletLookup({
  rpc: getRpc,
  busy: () => busy,
  inspect: async (escrow, wallet) => {
    input("escrow").value = escrow;
    input("recipient").value = wallet;
    await inspect();
  },
  connect: async () => {
    const wallet = supported().find((w) => w.name === wallets.value);
    if (!wallet)
      throw new Error(tr("Chưa phát hiện ví.", "No wallet detected."));
    const result = await wallet.features[StandardConnect].connect();
    const account = result.accounts.find((a) =>
      a.chains.some((chain) => chain.startsWith("solana:")),
    );
    if (!account)
      throw new Error(
        tr(
          "Ví chưa cung cấp tài khoản Solana.",
          "No Solana account was provided.",
        ),
      );
    return account.address;
  },
});
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
  notice.textContent = tr(
    "Đang đọc trạng thái finalized…",
    "Reading finalized fund state…",
  );
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
      tr("Chương trình: ", "Program: ") + current.program,
      tr("Quỹ: ", "Fund: ") + current.escrow,
      tr("Ví nhận: ", "Recipient: ") + current.recipient,
      tr("Phần thưởng mỗi suất: ", "Reward per recipient: ") +
        amount(e.amount, units) +
        (units === 9 ? " SOL Devnet" : " USDC Devnet"),
      tr("Đã nạp: ", "Funded: ") + amount(e.funded, units),
      tr("Đã phân bổ: ", "Allocated: ") + amount(e.allocated, units),
      tr("Đã nhận: ", "Claimed: ") + amount(e.paid, units),
      tr("Đã hoàn phần dư: ", "Unused funds refunded: ") +
        amount(e.refunded, units),
      tr("Hash cam kết: ", "Terms hash: ") + e.terms,
      tr("Hash bài nộp: ", "Submission hash: ") +
        (current.submission?.evidenceHash || tr("Chưa có", "Not available")),
      tr("Hash kết quả: ", "Result hash: ") +
        (current.submission?.resultHash || tr("Chưa có", "Not available")),
      tr("Reviewer chính: ", "Primary reviewer: ") + e.reviewer,
      tr("Reviewer dự phòng: ", "Backup reviewer: ") + e.backup,
      tr("Trạng thái: ", "Status: ") +
        (current.submission?.paid
          ? tr("Đã nhận thưởng", "Already received")
          : current.claimable
            ? tr("Có quyền nhận thưởng", "Ready to claim")
            : tr("Chưa được phân bổ thưởng", "No reward allocated")),
    ].join("\n");
    document.getElementById("result")!.hidden = false;
    document.getElementById("selected-reward")!.textContent = current.submission
      ?.paid
      ? tr(
          "Phần thưởng này đã được nhận.",
          "This reward has already been received.",
        )
      : current.claimable
        ? tr("Bạn có thể nhận ", "You can claim ") +
          amount(e.amount, units) +
          (units === 9 ? " SOL Devnet" : " USDC Devnet")
        : tr(
            "Ví này chưa có phần thưởng được phân bổ trong quỹ đã chọn.",
            "This wallet has no allocated reward in the selected fund.",
          );
    document.getElementById("result")!.scrollIntoView({ block: "start" });
    const explorer = document.getElementById("explorer") as HTMLAnchorElement;
    explorer.href =
      "https://explorer.solana.com/address/" +
      current.escrow +
      "?cluster=devnet";
    notice.textContent = tr(
      "Đã đọc dữ liệu finalized trực tiếp từ Solana.",
      "Finalized data read directly from Solana.",
    );
    if (current.submission?.paid) localStorage.removeItem(key());
    try {
      const authority = await upgradeAuthority(getRpc());
      document.getElementById("upgrade")!.textContent = authority.upgradeable
        ? tr(
            "Chương trình có thể nâng cấp. Authority: ",
            "Program is upgradeable. Authority: ",
          ) + authority.authority
        : tr(
            "Đã xác minh: chương trình không còn upgrade authority.",
            "Verified: the program has no upgrade authority.",
          );
    } catch {
      document.getElementById("upgrade")!.textContent = tr(
        "Chưa đọc được quyền nâng cấp; không được hiểu là chương trình bất biến.",
        "Upgrade authority could not be read; immutability is not confirmed.",
      );
    }
  } catch (e) {
    current = null;
    notice.textContent =
      e instanceof Error
        ? e.message
        : tr("Không đọc được quỹ.", "Unable to read the fund.");
    document.getElementById("advanced-status")!.textContent =
      notice.textContent;
    document.getElementById("lookup-status")!.textContent =
      tr(
        "Chưa kiểm tra được quỹ đã chọn. ",
        "Unable to inspect the selected fund. ",
      ) + notice.textContent;
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
  .addEventListener(
    "click",
    () =>
      void inspect().then(() =>
        document.dispatchEvent(new Event("reward-refresh")),
      ),
  );
input("terms").addEventListener("change", async () => {
  const file = input("terms").files?.[0];
  const status = document.getElementById("terms-status")!;
  if (!file || !current) return;
  if (file.size > 2 * 1024 * 1024) {
    status.textContent = tr(
      "Tệp quá lớn (tối đa 2 MB).",
      "File too large (maximum 2 MB).",
    );
    return;
  }
  try {
    const raw = await file.text();
    let text = raw,
      hash = current.state.terms,
      kind = tr("điều khoản", "terms");
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      /* Raw committed JSON/text is supported. */
    }
    if (typeof parsed.termsText === "string") text = parsed.termsText;
    if (parsed.kind === "submission" || parsed.kind === "result") {
      if (typeof parsed.committedText !== "string")
        throw new Error(
          tr("Thiếu nội dung đối chiếu.", "Missing committed text."),
        );
      text = parsed.committedText;
      kind =
        parsed.kind === "submission"
          ? tr("bài nộp", "submission")
          : tr("kết quả", "result");
      hash =
        (parsed.kind === "submission"
          ? current.submission?.evidenceHash
          : current.submission?.resultHash) || "";
      if (!hash)
        throw new Error(
          tr(
            "Chưa có cam kết tương ứng trên chuỗi.",
            "No matching commitment on-chain.",
          ),
        );
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
          throw new Error(
            tr(
              "Chi tiết điểm không khớp hash kết quả.",
              "Score details do not match the result hash.",
            ),
          );
      }
    }
    status.textContent = (await verifyCommittedText(text, hash))
      ? tr("Nội dung ", "The ") +
        kind +
        tr(
          " khớp chính xác cam kết on-chain.",
          " matches the on-chain commitment.",
        )
      : tr("Nội dung ", "The ") +
        kind +
        tr(
          " KHÔNG khớp cam kết on-chain.",
          " does NOT match the on-chain commitment.",
        );
  } catch {
    status.textContent = tr("Không đọc được tệp.", "Unable to read the file.");
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
      throw new Error(
        tr(
          "Thông tin đã đổi. Hãy kiểm tra lại trước khi ký.",
          "Details changed. Check the fund again before signing.",
        ),
      );
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
          tr(
            "Đã có giao dịch đang chờ kiểm tra: ",
            "A transaction is already pending: ",
          ) +
            pending +
            tr(
              ". Dùng Kiểm tra lại; không ký giao dịch thứ hai.",
              ". Use Check again before signing another transaction.",
            ),
        );
      localStorage.removeItem(storageKey);
    }
    const wallet = supported().find((w) => w.name === wallets.value);
    if (!wallet)
      throw new Error(
        tr("Chưa tìm thấy ví tương thích.", "No compatible wallet found."),
      );
    notice.textContent = tr(
      "Mở ví để kết nối và kiểm tra người nhận.",
      "Open your wallet to connect and verify the recipient.",
    );
    const connected = await wallet.features[StandardConnect].connect();
    const account = connected.accounts.find((a) => a.address === recipient);
    if (!account)
      throw new Error(
        tr(
          "Ví đang kết nối không khớp ví nhận thưởng.",
          "The connected wallet does not match the reward recipient.",
        ),
      );
    const unsigned = Buffer.from(
      await buildIndependentClaim(rpc, escrow, recipient),
      "base64",
    );
    let signature: string;
    const signOnly = wallet.features[SolanaSignTransaction],
      signAndSend = wallet.features[SolanaSignAndSendTransaction];
    notice.textContent = tr(
      "Kiểm tra giao dịch và ký nhận thưởng trong ví.",
      "Review and sign the claim in your wallet.",
    );
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
    } else
      throw new Error(
        tr(
          "Ví không hỗ trợ giao dịch legacy.",
          "Wallet does not support legacy transactions.",
        ),
      );
    notice.textContent =
      tr("Đã gửi: ", "Submitted: ") +
      signature +
      tr(
        ". Chờ xác nhận rồi bấm Kiểm tra lại.",
        ". Wait for confirmation, then select Check again.",
      );
    const link = document.createElement("a");
    link.href =
      "https://explorer.solana.com/tx/" + signature + "?cluster=devnet";
    link.textContent = tr(" Xem giao dịch", " View transaction");
    link.target = "_blank";
    link.rel = "noreferrer";
    notice.appendChild(link);
  } catch (e) {
    notice.textContent =
      e instanceof Error
        ? e.message
        : tr(
            "Không thể ký. Hãy kiểm tra trạng thái trên chuỗi.",
            "Unable to sign. Check the on-chain status.",
          );
  } finally {
    busy = false;
    updateWallets();
  }
});

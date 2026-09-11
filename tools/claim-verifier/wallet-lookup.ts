import QRCode from "qrcode";
import { address } from "gill";
import {
  discoverRewards,
  discoverBadges,
} from "../../solana/client/wallet-discovery";
declare const __SKILLBRIDGE_ISSUERS__: string[];
const vi = new URLSearchParams(location.search).get("lang") !== "en";
export const text = (v: string, e: string) => (vi ? v : e);
const el = (id: string) => document.getElementById(id)!;
const field = (id: string) => el(id) as HTMLInputElement;
function node(tag: string, value: string) {
  const n = document.createElement(tag);
  n.textContent = value;
  return n;
}
function explorer(value: string) {
  const a = node(
    "a",
    text("Xem bằng chứng", "View evidence"),
  ) as HTMLAnchorElement;
  a.href = `https://explorer.solana.com/address/${value}?cluster=devnet`;
  a.target = "_blank";
  a.rel = "noreferrer";
  return a;
}
export function initWalletLookup(options: {
  rpc: () => string;
  connect: () => Promise<string>;
  inspect: (escrow: string, wallet: string) => Promise<void>;
  busy: () => boolean;
}) {
  let generation = 0,
    loading = false,
    lastWallet = "";
  const selectedFund = new URLSearchParams(location.search).get("escrow");
  field("lookup-wallet").addEventListener("input",()=>{
    generation++;lastWallet="";
    el("wallet-results").hidden=true;el("result").hidden=true;
    el("lookup-status").textContent=text("Bấm Tra cứu ví để kiểm tra địa chỉ mới.","Select Look up wallet to check the new address.");
  });
  const suppliedWallet = new URLSearchParams(location.search).get("wallet");
  if (suppliedWallet) field("lookup-wallet").value = suppliedWallet;
  if (selectedFund) {
    try {
      address(selectedFund);
      field("escrow").value = selectedFund;
      el("lookup-context").textContent = text(
        "Đã chọn quỹ của thử thách. Nhập ví để kiểm tra quyền nhận.",
        "Challenge fund selected. Enter a wallet to check its reward.",
      );
    } catch {
      /* Invalid deep links never trigger RPC/signing. */
    }
  }
  const errorText = text(
    "Chưa tải được dữ liệu. Hãy thử lại hoặc chọn RPC khác trong Kiểm tra nâng cao.",
    "Unable to load data. Retry or select another RPC under Advanced checks.",
  );
  async function lookup() {
    if (loading || options.busy()) return;
    const wallet = field("lookup-wallet").value.trim();
    try {
      address(wallet);
    } catch {
      el("lookup-status").textContent = text(
        "Địa chỉ ví Solana chưa hợp lệ. Kiểm tra lại địa chỉ đã dán.",
        "Enter a valid Solana wallet address.",
      );
      return;
    }
    loading = true;
    const run = ++generation;
    field("lookup-submit").disabled = true;
    el("lookup-form").setAttribute("aria-busy", "true");
    el("wallet-results").hidden = false;
    el("share-area").hidden = true;
    el("result").hidden = true;
    for (const id of ["badges", "rewards", "history"]) {
      el(id).replaceChildren(node("p", text("Đang kiểm tra…", "Checking…")));
    }
    for (const id of ["badge-count", "reward-count", "paid-count"])
      el(id).textContent = "—";
    el("lookup-status").textContent = text(
      "Đang đọc dữ liệu đã xác nhận trên Solana Devnet…",
      "Reading finalized Solana Devnet records…",
    );
    field("recipient").value = wallet;
    field("candidate").value = wallet;
    lastWallet = wallet;
    try {
      const rpc = options.rpc();
      const rewardTask = discoverRewards(rpc, wallet)
        .then((items) => {
          if (run !== generation) return;
          el("reward-count").textContent = String(
            items.filter((i) => i.claimable).length,
          );
          el("paid-count").textContent = String(
            items.filter((i) => i.submission.paid).length,
          );
          el("rewards").replaceChildren();
          el("history").replaceChildren();
          for (const item of items) {
            const card = node("article", "");
            card.className = "lookup-card";
            card.dataset.escrow = item.escrow;
            card.appendChild(node("h3", `${item.amount} ${item.asset}`));
            card.appendChild(
              node(
                "p",
                item.submission.paid
                  ? text("Đã nhận thưởng", "Reward received")
                  : item.claimable
                    ? text(
                        "Phần thưởng đang chờ bạn nhận",
                        "Your reward is ready",
                      )
                    : text(
                        "Chưa được phân bổ thưởng",
                        "No reward allocated yet",
                      ),
              ),
            );
            const title = node(
              "p",
              text(
                "Chưa có tên thử thách. Quỹ: ",
                "Challenge name unavailable. Fund: ",
              ) +
                item.escrow.slice(0, 8) +
                "…" +
                item.escrow.slice(-6),
            );
            title.className = "challenge-label";
            card.appendChild(title);
            const action = node(
              "button",
              item.claimable
                ? text("Nhận thưởng", "Claim reward")
                : text("Xem chi tiết", "View details"),
            ) as HTMLButtonElement;
            action.type = "button";
            action.addEventListener("click", () => {
              if (!options.busy()) void options.inspect(item.escrow, wallet);
            });
            card.appendChild(action);
            card.appendChild(explorer(item.escrow));
            el(item.submission.paid ? "history" : "rewards").appendChild(card);
          }
          if (!items.some((i) => !i.submission.paid))
            el("rewards").appendChild(
              node(
                "p",
                text(
                  "Không tìm thấy phần thưởng đang chờ cho ví này.",
                  "No pending rewards found for this wallet.",
                ),
              ),
            );
          if (!items.some((i) => i.submission.paid))
            el("history").appendChild(
              node(
                "p",
                text(
                  "Chưa có phần thưởng đã nhận.",
                  "No claimed rewards found.",
                ),
              ),
            );
        })
        .catch(() => {
          if (run === generation) {
            el("rewards").replaceChildren(node("p", errorText));
            el("history").replaceChildren(node("p", errorText));
          }
          return false;
        });
      const badgeTask = discoverBadges(rpc, wallet, __SKILLBRIDGE_ISSUERS__)
        .then((items) => {
          if (run !== generation) return;
          el("badge-count").textContent = String(
            items.filter((b) => b.status === "active").length,
          );
          el("badges").replaceChildren();
          const labels: Record<string, string> = {
            active: text("Còn hiệu lực", "Active"),
            expired: text("Đã hết hạn", "Expired"),
            paused: text("Đang tạm dừng", "Paused"),
            unauthorized: text(
              "Người ký không còn được ủy quyền",
              "Signer no longer authorized",
            ),
          };
          for (const item of items) {
            const card = node("article", "");
            card.className = "lookup-card";
            card.dataset.challengeId = item.challengeId;
            card.appendChild(
              node("h3", text("Huy hiệu kỹ năng", "Skill badge")),
            );
            card.appendChild(node("strong", labels[item.status]));
            const title = node(
              "p",
              text("Mã thử thách: ", "Challenge ID: ") + item.challengeId,
            );
            title.className = "challenge-label";
            card.appendChild(title);
            card.appendChild(
              node("p", text("Đơn vị cấp: ", "Issuer: ") + item.issuerName),
            );
            card.appendChild(
              node(
                "p",
                text("Điểm chính thức: ", "Official score: ") +
                  item.score +
                  "/100",
              ),
            );
            if (item.expiresAt !== "0")
              card.appendChild(
                node(
                  "p",
                  text("Hết hạn: ", "Expires: ") +
                    new Date(Number(item.expiresAt) * 1000).toLocaleDateString(
                      vi ? "vi-VN" : "en-US",
                    ),
                ),
              );
            card.appendChild(explorer(item.address));
            el("badges").appendChild(card);
          }
          if (!items.length)
            el("badges").appendChild(
              node(
                "p",
                text(
                  "Không tìm thấy huy hiệu SkillBridge cho ví này.",
                  "No SkillBridge badges found for this wallet.",
                ),
              ),
            );
        })
        .catch((error) => {
          if (run === generation)
            el("badges").replaceChildren(
              node(
                "p",
                error instanceof Error &&
                  error.message === "ISSUERS_NOT_CONFIGURED"
                  ? text(
                      "Chưa cấu hình đơn vị cấp huy hiệu. Số huy hiệu chưa thể xác định.",
                      "Issuer configuration is missing. Badge count is unavailable.",
                    )
                  : errorText,
              ),
            );
          return false;
        });
      const results = await Promise.all([rewardTask, badgeTask]);
      if (run !== generation) return;
      el("lookup-status").textContent = results.includes(false)
        ? text(
            "Một phần dữ liệu chưa tải được. Bạn vẫn có thể xem phần đã xác minh.",
            "Some data could not be loaded. Verified results remain available.",
          )
        : text(
            "Đã kiểm tra xong trên Solana Devnet.",
            "Solana Devnet check complete.",
          );
      if (selectedFund) {
        try {
          address(selectedFund);
          await options.inspect(selectedFund, wallet);
        } catch {
          /* Advanced inspection shows its own error. */
        }
      }
    } catch {
      el("lookup-status").textContent = errorText;
    } finally {
      loading = false;
      field("lookup-submit").disabled = false;
      el("lookup-form").setAttribute("aria-busy", "false");
    }
  }
  el("lookup-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void lookup();
  });
  document.addEventListener("reward-refresh", () => {
    if (lastWallet === field("lookup-wallet").value.trim()) void lookup();
  });
  el("load-names").addEventListener("click", async () => {
    const button = el("load-names") as HTMLButtonElement;
    button.disabled = true;
    const requestGeneration = generation;
    try {
      const source = new URL(field("metadata-origin").value);
      if (
        source.protocol !== "https:" &&
        source.hostname !== "127.0.0.1" &&
        source.hostname !== "localhost"
      )
        throw new Error();
      const cards = [...document.querySelectorAll<HTMLElement>(".lookup-card")];
      const ids = [
        ...new Set(cards.map((c) => c.dataset.challengeId).filter(Boolean)),
      ];
      const escrows = [
        ...new Set(cards.map((c) => c.dataset.escrow).filter(Boolean)),
      ];
      const url = new URL("/api/verification/catalog", source);
      url.searchParams.set("ids", ids.slice(0, 50).join(","));
      url.searchParams.set("escrows", escrows.slice(0, 50).join(","));
      const response = await fetch(url, {
        credentials: "omit",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error();
      const data = (await response.json()) as {
        challenges: Array<{
          id: string;
          title: string;
          escrow_address: string | null;
        }>;
      };
      if (requestGeneration !== generation) return;
      for (const card of cards) {
        const row = data.challenges.find(
          (c) =>
            (card.dataset.challengeId && c.id === card.dataset.challengeId) ||
            (card.dataset.escrow && c.escrow_address === card.dataset.escrow),
        );
        if (row && typeof row.title === "string")
          card.querySelector(".challenge-label")!.textContent = row.title;
      }
      el("names-status").textContent = text(
        "Đã tải tên hiển thị từ SkillBridge. Những thử thách riêng tư hoặc chưa có thông tin vẫn hiển thị mã.",
        "Display names loaded from SkillBridge. Private or unavailable challenges retain their IDs.",
      );
    } catch {
      el("names-status").textContent = text(
        "Chưa tải được tên thử thách. Kết quả xác minh trên Solana vẫn giữ nguyên.",
        "Names could not be loaded. Solana verification results are unchanged.",
      );
    } finally {
      button.disabled = false;
    }
  });
  el("connect-lookup").addEventListener("click", async () => {
    if (loading || options.busy()) return;
    try {
      field("lookup-wallet").value = await options.connect();
      await lookup();
    } catch (error) {
      el("lookup-status").textContent =
        error instanceof Error ? error.message : errorText;
    }
  });
  el("share-wallet").addEventListener("click", async () => {
    if (!lastWallet) return;
    const url = new URL(location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("wallet", lastWallet);
    if (!vi) url.searchParams.set("lang", "en");
    const share = el("share-url") as HTMLAnchorElement;
    share.href = url.href;
    share.textContent = url.href;
    el("share-area").hidden = false;
    try {
      await QRCode.toCanvas(el("share-qr") as HTMLCanvasElement, url.href, {
        width: 220,
        margin: 2,
      });
      await navigator.clipboard.writeText(url.href);
      el("share-status").textContent = text(
        "Đã sao chép liên kết.",
        "Link copied.",
      );
    } catch {
      el("share-status").textContent = text(
        "Bạn có thể sao chép liên kết bên dưới.",
        "You can copy the link below.",
      );
    }
  });
  if (suppliedWallet) void lookup();
}

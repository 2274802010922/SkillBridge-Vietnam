import { env } from "@/lib/runtime-env";
import { jsonError, requireSessionUser } from "../../../../lib/auth";
import { formatSolAtomic, formatUsdcAtomic } from "../../../../lib/payments";

type TokenAccount = { account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string } } } } } };

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const rpcUrl = env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    const rpc = async <T,>(method: string, params: unknown[]): Promise<T> => {
      const response = await fetch(rpcUrl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: method, method, params }),
      });
      if (!response.ok) throw new Error("Solana Devnet không phản hồi.");
      const payload = await response.json() as { result?: T; error?: { message?: string } };
      if (payload.error) throw new Error(payload.error.message || "Không thể đọc số dư ví.");
      if (payload.result === undefined) throw new Error("Không nhận được dữ liệu số dư ví.");
      return payload.result;
    };
    const [balance, tokenAccounts] = await Promise.all([
      rpc<{ value: number }>("getBalance", [user.walletAddress, { commitment: "confirmed" }]),
      rpc<{ value: TokenAccount[] }>("getTokenAccountsByOwner", [user.walletAddress, { mint: env.SOLANA_USDC_MINT }, { encoding: "jsonParsed", commitment: "confirmed" }]),
    ]);
    const usdcAtomic = tokenAccounts.value.reduce((sum, entry) => sum + BigInt(entry.account?.data?.parsed?.info?.tokenAmount?.amount || "0"), BigInt(0));
    return Response.json({
      network: "solana:devnet", walletAddress: user.walletAddress,
      assets: [
        { symbol: "SOL", amountAtomic: String(balance.value), display: formatSolAtomic(String(balance.value)) },
        { symbol: "USDC", amountAtomic: usdcAtomic.toString(), display: formatUsdcAtomic(usdcAtomic.toString()), mint: env.SOLANA_USDC_MINT },
      ],
      explorerUrl: `https://explorer.solana.com/address/${encodeURIComponent(user.walletAddress)}?cluster=devnet`,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

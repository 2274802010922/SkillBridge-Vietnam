import { env } from "@/backend/config/runtime-env";
import { getSessionUser, jsonError } from "@/backend/auth/auth";
import {
  assertEscrowDevnet,
  readEscrowAccount,
  SYSTEM,
  DEVNET_USDC,
  hashBytes,
  escrowAddress,
} from "@/solana/client/challenge-escrow";
import { formatAtomic } from "@/solana/client/wallet-discovery";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const c = await env.DB.prepare(
      "SELECT c.status,c.access_type,c.organization_id,c.reviewer_organization_id,e.escrow_address,f.vault_wallet,f.funding_tx,f.status AS fund_status,f.required_display,f.asset FROM challenges c LEFT JOIN challenge_escrows e ON e.challenge_id=c.id LEFT JOIN challenge_funds f ON f.challenge_id=c.id WHERE c.id=? AND c.deleted_at IS NULL",
    )
      .bind(id)
      .first<{
        status: string;
        access_type: string;
        organization_id: string;
        reviewer_organization_id: string;
        escrow_address: string | null;
        vault_wallet: string | null;
        funding_tx: string | null;
        fund_status: string | null;
        required_display: string | null;
        asset: string | null;
      }>();
    if (!c) return Response.json({ error: "Not found" }, { status: 404 });
    if (!["published","closed"].includes(c.status) || c.access_type !== "public") {
      const user = await getSessionUser(request);
      if (!user)
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      const permission = await env.DB.prepare(
        "SELECT 1 FROM memberships WHERE user_id=? AND organization_id IN (?,?) AND status='active' UNION ALL SELECT 1 FROM participations WHERE student_user_id=? AND challenge_id=? LIMIT 1",
      )
        .bind(
          user.id,
          c.organization_id,
          c.reviewer_organization_id,
          user.id,
          id,
        )
        .first();
      if (!permission)
        return Response.json({ error: "Not found" }, { status: 404 });
    }
    const headers = { "Cache-Control": "private, no-store" };
    if (c.escrow_address) {
      const rpc = env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
      try {
        await assertEscrowDevnet(rpc);
        const state = await readEscrowAccount(rpc, c.escrow_address, "Escrow");
        if (!state)
          return Response.json(
            {
              kind: "escrow",
              address: c.escrow_address,
              status: "not_funded",
              verified: false,
            },
            { headers },
          );
        if(state.id !== (await hashBytes(id)).toString("hex") || c.escrow_address !== await escrowAddress({funder:state.funder,challengeId:id}))throw new Error("Fund does not belong to this challenge");
        const decimals = state.mint === SYSTEM ? 9 : 6,
          asset =
            state.mint === SYSTEM
              ? "SOL Devnet"
              : state.mint === DEVNET_USDC
                ? "USDC Devnet"
                : "Unknown";
        if (asset === "Unknown") throw new Error("Unsupported mint");
        const required = BigInt(state.amount) * BigInt(state.slots);
        const status =
          BigInt(state.refunded) > BigInt(0)
            ? "refunded"
            : BigInt(state.paid) > BigInt(0)
              ? "paid"
              : BigInt(state.allocated) > BigInt(0)
                ? "allocated"
                : BigInt(state.funded) >= required
                  ? "funded"
                  : "not_funded";
        return Response.json(
          {
            kind: "escrow",
            address: c.escrow_address,
            status,
            verified: true,
            asset,
            slots: state.slots,
            perWinner: formatAtomic(state.amount, decimals),
            required: formatAtomic(required.toString(), decimals),
            funded: formatAtomic(state.funded, decimals),
            allocated: formatAtomic(state.allocated, decimals),
            paid: formatAtomic(state.paid, decimals),
            remaining: formatAtomic(
              (
                BigInt(state.funded) -
                BigInt(state.paid) -
                BigInt(state.refunded)
              ).toString(),
              decimals,
            ),
            checkedAt: new Date().toISOString(),
            slot: state.observedSlot,
          },
          { headers },
        );
      } catch {
        return Response.json(
          {
            kind: "escrow",
            address: c.escrow_address,
            status: "unavailable",
            verified: false,
          },
          { headers },
        );
      }
    }
    return Response.json(
      c.vault_wallet
        ? {
            kind: "legacy",
            address: c.vault_wallet,
            status: c.fund_status,
            verified: false,
            fundingTx: c.funding_tx,
            required: c.required_display,
            asset: c.asset === "sol" ? "SOL Devnet" : "USDC Devnet",
          }
        : { kind: "none", status: "not_funded", verified: false },
      { headers },
    );
  } catch (error) {
    return jsonError(error);
  }
}

import { CASHOUT_PAYOUT_METHODS, payoutProviderForMethod, type CashoutPayoutMethod } from "@/lib/cashout";
import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../../lib/auth";
import { auditStatement } from "../../../../lib/audit";

function maskHolderName(value: string) {
  return value.trim().replace(/\s+/g, " ").split(" ").map((part) => `${part.slice(0, 1)}${"•".repeat(Math.min(4, Math.max(1, part.length - 1)))}`).join(" ");
}

function validMethod(value: string): value is CashoutPayoutMethod {
  return (CASHOUT_PAYOUT_METHODS as readonly string[]).includes(value);
}

function labelForMethod(method: CashoutPayoutMethod) {
  if (method === "momo") return "MOMO";
  if (method === "zalopay") return "ZALOPAY";
  return "BANK";
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const beneficiaries = await env.DB.prepare(`
      SELECT id, bank_code, account_last4, account_holder_masked, payout_method, payout_provider,
        verification_state, status, created_at
      FROM cashout_beneficiaries WHERE user_id = ? ORDER BY created_at DESC LIMIT 8
    `).bind(user.id).all();
    return Response.json({ beneficiaries: beneficiaries.results }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

/**
 * Tokenizes a sandbox destination. Full bank account numbers and phone numbers
 * are never persisted by SkillBridge; a production provider would return its
 * own destination token after account verification.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as {
      method?: string; bankCode?: string; accountNumber?: string; destination?: string; accountHolder?: string;
    };
    const method = body.method?.trim().toLowerCase() || "bank";
    if (!validMethod(method)) return Response.json({ error: "Phương thức nhận tiền không hợp lệ." }, { status: 400 });
    const destination = (body.destination || body.accountNumber || "").replace(/\s+/g, "");
    const bankCode = method === "bank" ? (body.bankCode?.trim().toUpperCase() ?? "") : labelForMethod(method);
    const accountHolder = body.accountHolder?.trim() ?? "";
    if (method === "bank" && !/^[A-Z0-9_-]{2,20}$/.test(bankCode)) return Response.json({ error: "Chọn ngân hàng hợp lệ." }, { status: 400 });
    if (method === "bank" && !/^\d{6,24}$/.test(destination)) return Response.json({ error: "Số tài khoản thử nghiệm phải có 6–24 chữ số." }, { status: 400 });
    if (method !== "bank" && !/^0\d{8,10}$/.test(destination)) return Response.json({ error: "Số điện thoại ví thử nghiệm phải bắt đầu bằng 0 và có 9–11 chữ số." }, { status: 400 });
    if (accountHolder.length < 2 || accountHolder.length > 80) return Response.json({ error: "Tên người nhận phải có 2–80 ký tự." }, { status: 400 });
    const payoutProvider = payoutProviderForMethod(method, env);
    const providerBeneficiaryId = `sbx_${await sha256(`${user.id}|${method}|${bankCode}|${destination}`)}`;
    const existing = await env.DB.prepare(`
      SELECT id, bank_code, account_last4, account_holder_masked, payout_method, payout_provider,
        verification_state, status, created_at
      FROM cashout_beneficiaries WHERE provider_beneficiary_id = ? AND user_id = ?
    `).bind(providerBeneficiaryId, user.id).first();
    if (existing) return Response.json({ beneficiary: existing, reused: true });
    const id = crypto.randomUUID();
    const accountLast4 = destination.slice(-4);
    const accountHolderMasked = maskHolderName(accountHolder);
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO cashout_beneficiaries
          (id, user_id, provider_beneficiary_id, bank_code, account_last4, account_holder_masked,
           payout_method, payout_provider, verification_state)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sandbox_verified')
      `).bind(id, user.id, providerBeneficiaryId, bankCode, accountLast4, accountHolderMasked, method, payoutProvider),
      auditStatement(env.DB, {
        actorUserId: user.id, action: "cashout.beneficiary_tokenized", targetType: "cashout_beneficiary", targetId: id,
        metadata: { method, payoutProvider, bankCode, accountLast4, sandbox: true },
      }),
    ]);
    return Response.json({
      beneficiary: {
        id, bank_code: bankCode, account_last4: accountLast4, account_holder_masked: accountHolderMasked,
        payout_method: method, payout_provider: payoutProvider, verification_state: "sandbox_verified", status: "sandbox_verified",
      },
    }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

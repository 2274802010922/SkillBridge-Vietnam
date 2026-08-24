import { env } from "@/lib/runtime-env";
import { assertSameOrigin, jsonError, requireSessionUser, sha256 } from "../../../../lib/auth";
import { auditStatement } from "../../../../lib/audit";

function maskHolderName(value: string) {
  return value.trim().replace(/\s+/g, " ").split(" ").map((part) => `${part.slice(0, 1)}${"•".repeat(Math.min(4, Math.max(1, part.length - 1)))}`).join(" ");
}

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const beneficiaries = await env.DB.prepare(`
      SELECT id, bank_code, account_last4, account_holder_masked, status, created_at
      FROM cashout_beneficiaries WHERE user_id = ? ORDER BY created_at DESC LIMIT 8
    `).bind(user.id).all();
    return Response.json({ beneficiaries: beneficiaries.results }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}

/** Sandbox-tokenize a beneficiary. The raw account number and holder name are never persisted. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const body = await request.json() as { bankCode?: string; accountNumber?: string; accountHolder?: string };
    const bankCode = body.bankCode?.trim().toUpperCase() ?? "";
    const accountNumber = body.accountNumber?.replace(/\s+/g, "") ?? "";
    const accountHolder = body.accountHolder?.trim() ?? "";
    if (!/^[A-Z0-9_-]{2,20}$/.test(bankCode)) return Response.json({ error: "Chọn ngân hàng hợp lệ." }, { status: 400 });
    if (!/^\d{6,24}$/.test(accountNumber)) return Response.json({ error: "Số tài khoản thử nghiệm phải có 6–24 chữ số." }, { status: 400 });
    if (accountHolder.length < 2 || accountHolder.length > 80) return Response.json({ error: "Tên chủ tài khoản phải có 2–80 ký tự." }, { status: 400 });
    const providerBeneficiaryId = `sbx_${await sha256(`${user.id}|${bankCode}|${accountNumber}`)}`;
    const existing = await env.DB.prepare(`
      SELECT id, bank_code, account_last4, account_holder_masked, status, created_at
      FROM cashout_beneficiaries WHERE provider_beneficiary_id = ? AND user_id = ?
    `).bind(providerBeneficiaryId, user.id).first();
    if (existing) return Response.json({ beneficiary: existing, reused: true });
    const id = crypto.randomUUID();
    const accountLast4 = accountNumber.slice(-4);
    const accountHolderMasked = maskHolderName(accountHolder);
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO cashout_beneficiaries
          (id, user_id, provider_beneficiary_id, bank_code, account_last4, account_holder_masked)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(id, user.id, providerBeneficiaryId, bankCode, accountLast4, accountHolderMasked),
      auditStatement(env.DB, {
        actorUserId: user.id, action: "cashout.beneficiary_tokenized", targetType: "cashout_beneficiary", targetId: id,
        metadata: { bankCode, accountLast4, sandbox: true },
      }),
    ]);
    return Response.json({ beneficiary: { id, bank_code: bankCode, account_last4: accountLast4, account_holder_masked: accountHolderMasked, status: "sandbox_verified" } }, { status: 201 });
  } catch (error) { return jsonError(error); }
}

import bs58 from "bs58";
import { rewardProgress, operationSatisfied } from "@/shared/validation/reward-progress";
import { rewardEligibility } from "@/backend/services/escrow/reward-assessment";
import { createKeyPairSignerFromBytes } from "gill";
import { env } from "@/backend/config/runtime-env";
import {
  assertSameOrigin,
  jsonError,
  requireSessionUser,
  validSolanaAddress,
} from "@/backend/auth/auth";
import { requireChallengeManager } from "@/backend/auth/authorization";
import { consumeRateLimit } from "@/backend/auth/rate-limit";
import { escrowRow, readAndSyncEscrow } from "@/backend/services/escrow/escrow-store";
import {
  ESCROW_PROGRAM,
  SYSTEM,
  DEVNET_USDC,
  escrowAddress,
  disc,
  hashBytes,
  assertEscrowDevnet,
  buildEscrowTransaction,
  escrowInstructions,
  escrowRpc,
  type EscrowConfig,
  type EscrowAction,
} from "@/solana/client/challenge-escrow";

async function registrar() {
  const raw = env.SOLANA_AUTHORIZED_SIGNER_SECRET;
  if (!raw) throw new Error("Chưa cấu hình ví xác nhận bài nộp.");
  return createKeyPairSignerFromBytes(
    raw.trim().startsWith("[")
      ? Uint8Array.from(JSON.parse(raw))
      : bs58.decode(raw),
  );
}
export async function access(id: string, user: { id: string; walletAddress: string }) {
  const c = await env.DB.prepare(
    `SELECT c.* FROM challenges c WHERE c.id=? AND c.deleted_at IS NULL`,
  )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!c) throw new Response("Không tìm thấy thử thách.", { status: 404 });
  const row = await escrowRow(id);
  const config = row ? (JSON.parse(row.config_json) as EscrowConfig) : null;
  const membership = await env.DB.prepare(
    `SELECT id FROM memberships WHERE user_id=? AND organization_id IN(?,?) AND status='active'`,
  )
    .bind(user.id, c.organization_id, c.reviewer_organization_id)
    .first();
  const participation = await env.DB.prepare(
    "SELECT id FROM participations WHERE challenge_id=? AND student_user_id=?",
  )
    .bind(id, user.id)
    .first();
  if (
    !membership &&
    !participation &&
    config?.backup !== user.walletAddress &&
    config?.reviewer !== user.walletAddress &&
    !(c.status === "published" && c.access_type === "public")
  )
    throw new Response("Bạn không có quyền xem quỹ này.", { status: 403 });
  return { c, row, config, membership };
}
async function presentEscrow(c: Record<string, unknown>, row: NonNullable<Awaited<ReturnType<typeof escrowRow>>>, user: {walletAddress: string}, data: Awaited<ReturnType<typeof readAndSyncEscrow>>) {
  const isReviewer = [data.config.reviewer, data.config.backup].includes(user.walletAddress);
  const rows = await env.DB.prepare(`
    SELECT s.id,u.display_name AS name,w.address AS wallet,a.status AS assessment_status,a.final_result_hash,
      (SELECT review_json FROM reviews r WHERE r.assessment_id=a.id ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1) AS review_json
    FROM submissions s JOIN participations p ON p.id=s.participation_id JOIN wallets w ON w.user_id=p.student_user_id
    JOIN users u ON u.id=p.student_user_id LEFT JOIN assessments a ON a.submission_id=s.id
    WHERE p.challenge_id=? AND (?=1 OR w.address=?)`)
    .bind(c.id,isReviewer ? 1 : 0,user.walletAddress).all<{id:string;name:string;wallet:string;assessment_status:string|null;final_result_hash:string|null;review_json:string|null}>();
  const now = Math.floor(Date.now()/1000);
  const dbSubmissions = await Promise.all(rows.results.map(async sub => {
    const eligible = await rewardEligibility({...sub,termsText:data.config.termsText});
    const hash=(await hashBytes(sub.id)).toString("hex");
    const receipt = data.submissions.find(s=>s.student===sub.wallet && s.submissionId===hash) || null;
    return {id:sub.id,name:sub.name,wallet:sub.wallet,assessment_status:sub.assessment_status,eligible,
      progress:rewardProgress(data.config,data.state,receipt,sub.assessment_status,eligible,sub.wallet,user.walletAddress,now)};
  }));
  return {challenge:{id:c.id,title:c.title,status:c.status,reward_type:c.reward_type},...data,
    submissions:data.submissions.filter(s=>isReviewer||s.student===user.walletAddress),dbSubmissions,
    wallet:user.walletAddress,escrowAddress:row.escrow_address,serverTime:now,checkedAt:new Date().toISOString()};
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    const { c, row } = await access(id, user);
    const canConfigure = Boolean(
      await env.DB.prepare(
        "SELECT id FROM memberships WHERE organization_id=? AND user_id=? AND status='active' AND role IN('business_admin','challenge_manager')",
      )
        .bind(c.organization_id, user.id)
        .first(),
    );
    const reviewerOptions = canConfigure
      ? (
          await env.DB.prepare(
            "SELECT DISTINCT w.address,u.display_name AS name FROM memberships m JOIN wallets w ON w.user_id=m.user_id JOIN users u ON u.id=m.user_id WHERE m.organization_id=? AND m.status='active' AND m.role IN('business_admin','challenge_manager','reviewer','university_admin')",
          )
            .bind(c.reviewer_organization_id)
            .all()
        ).results
      : [];
    if (!row)
      return Response.json(
        {
          challenge: c,
          config: null,
          canConfigure,
          reviewerOptions,
          state: null,
          submissions: [],
          wallet: user.walletAddress,
        },
        { headers: { "cache-control": "no-store" } },
      );
    const data = await readAndSyncEscrow(row);
    return Response.json(await presentEscrow(c, row, user, data), {headers:{"cache-control":"no-store"}});
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    assertSameOrigin(request);
    const user = await requireSessionUser(request);
    const { id } = await params;
    await consumeRateLimit(env.DB, "escrow_action", user.id, 100, 3600);
    const body = (await request.json()) as {
      action?: EscrowAction | "configure" | "sync";
      senderWallet?: string;
      reviewer?: string;
      backup?: string;
      submitDeadline?: string;
      reviewDeadline?: string;
      submissionId?: string;
      eligible?: boolean;
      signature?: string;
      operationId?: string;
    };
    const { c, row } = await access(id, user);
    const rpc = env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
    await assertEscrowDevnet(rpc);
    if (body.action === "configure") {
      await requireChallengeManager(user.id, id);
      if (row) return Response.json({ ok: true });
      if (
        c.status !== "draft" ||
        !["sol", "usdc"].includes(String(c.reward_type))
      )
        throw new Response(
          "Chỉ bản nháp có phần thưởng SOL/USDC mới tạo quỹ.",
          { status: 409 },
        );
      if (
        await env.DB.prepare(
          "SELECT id FROM challenge_funds WHERE challenge_id=?",
        )
          .bind(id)
          .first()
      )
        throw new Response(
          "Quỹ cũ tiếp tục dùng cơ chế hiện tại; không nạp lại.",
          { status: 409 },
        );
      if (
        !validSolanaAddress(body.reviewer || "") ||
        !validSolanaAddress(body.backup || "") ||
        body.backup === body.reviewer ||
        body.backup === user.walletAddress
      )
        throw new Response("Chọn ví đánh giá và ví dự phòng khác ví nạp quỹ.", {
          status: 400,
        });
      const reviewerMember = await env.DB.prepare(
        `SELECT m.id FROM memberships m JOIN wallets w ON w.user_id=m.user_id WHERE m.organization_id=? AND w.address=? AND m.status='active' AND m.role IN('business_admin','challenge_manager','reviewer','university_admin')`,
      )
        .bind(c.reviewer_organization_id, body.reviewer)
        .first();
      if (!reviewerMember)
        throw new Response(
          "Ví đánh giá phải có quyền trong đơn vị đánh giá đã chọn.",
          { status: 400 },
        );
      const backupMember = await env.DB.prepare(
        "SELECT m.id FROM memberships m JOIN wallets w ON w.user_id=m.user_id WHERE m.organization_id=? AND w.address=? AND m.status='active' AND m.role IN('business_admin','challenge_manager','reviewer','university_admin')",
      )
        .bind(c.reviewer_organization_id, body.backup)
        .first();
      if (!backupMember)
        throw new Response(
          "Mời ví dự phòng vào đơn vị đánh giá với quyền chấm bài trước khi thiết lập quỹ.",
          { status: 400 },
        );
      const submitDeadline = Math.floor(
          Date.parse(body.submitDeadline || "") / 1000,
        ),
        reviewDeadline = Math.floor(
          Date.parse(body.reviewDeadline || "") / 1000,
        );
      if (
        !Number.isSafeInteger(submitDeadline) ||
        !Number.isSafeInteger(reviewDeadline) ||
        submitDeadline < Date.now() / 1000 + 60 ||
        reviewDeadline <= submitDeadline
      )
        throw new Response(
          "Hạn nộp phải ở tương lai và hạn đánh giá phải sau hạn nộp.",
          { status: 400 },
        );
      const signer = await registrar();
      const amount = String(c.reward_amount_atomic);
      const slots = Number(c.reward_slots);
      if (
        !/^\d+$/.test(amount) ||
        BigInt(amount) <= BigInt("0") ||
        BigInt(amount) * BigInt(slots) > BigInt("18446744073709551615")
      )
        throw new Response("Ngân sách không hợp lệ.", { status: 400 });
      const termsText = JSON.stringify({
        version: "escrow-v1",
        challengeId: id,
        title: c.title,
        brief: c.brief,
        content: c.content_json,
        rubric: c.rubric_json,
        reward: c.reward,
        minimumScore: c.minimum_score,
        access: c.access_type,
        asset: c.reward_type,
        amount,
        slots,
        reviewer: body.reviewer,
        backup: body.backup,
        submitDeadline,
        reviewDeadline,
        refund:
          "Before publication: funder cancels. After publication: only unused budget after all submissions are resolved. Allocated rewards never expire or refund.",
        trust:
          "Humans judge evidence. Registrar admits submissions. Program upgrade authority remains disclosed.",
        stalledReview: "If primary and backup reviewers do not act, funds remain pending. No automatic refund or reviewer replacement.",
      });
      const config: EscrowConfig = {
        challengeId: id,
        funder: user.walletAddress,
        reviewer: body.reviewer!,
        backup: body.backup!,
        registrar: String(signer.address),
        mint: c.reward_type === "sol" ? SYSTEM : DEVNET_USDC,
        amount,
        slots,
        submitDeadline,
        reviewDeadline,
        termsText,
        termsHash: (await hashBytes(termsText)).toString("hex"),
      };
      await env.DB.prepare(
        "INSERT INTO challenge_escrows(challenge_id,program_id,escrow_address,config_json) VALUES(?,?,?,?)",
      )
        .bind(
          id,
          ESCROW_PROGRAM,
          await escrowAddress(config),
          JSON.stringify(config),
        )
        .run();
      return Response.json({ ok: true });
    }
    if (!row) throw new Response("Hãy thiết lập quỹ trước.", { status: 409 });
    if (body.action === "sync") {
      const signature = body.signature?.trim();
      // Check the signature first. The escrow account can lag behind a finalized
      // transaction on the first RPC read, so never decide from a pre-status snapshot.
      const statuses = signature
        ? await escrowRpc<{
            value: Array<{ confirmationStatus?: string; err: unknown } | null>;
          }>(rpc, "getSignatureStatuses", [
            [signature],
            { searchTransactionHistory: true },
          ])
        : null;
      const status = statuses?.value[0] ?? null;
      if (status?.err)
        return Response.json(
          {
            error:
              "Giao dịch bị từ chối. Kiểm tra ví, điều kiện và mã giao dịch.",
            failed: true,
            code: "TX_FAILED",
          },
          { status: 409 },
        );
      if (signature && status?.confirmationStatus !== "finalized") {
        return Response.json({
          ok: true,
          finalized: false,
          code: status ? "NOT_FINALIZED" : "TX_NOT_FOUND",
          message: status
            ? "Giao dịch chưa finalized. Hãy chờ thêm rồi kiểm tra lại; không nạp thêm tiền."
            : "Không tìm thấy transaction signature trên Solana Devnet.",
          escrowAddress: row.escrow_address,
          state: null,
        });
      }
      let observedInstructions:Array<{programId:string;accounts?:string[];data?:string}>=[];
      if (signature) {
        const tx = await escrowRpc<{
          meta: { err: unknown } | null;
          transaction: {
            message: { accountKeys: Array<string | { pubkey: string }>; instructions:Array<{programId:string;accounts?:string[];data?:string}> };
          };
        } | null>(rpc, "getTransaction", [
          signature,
          { encoding: "jsonParsed", commitment: "finalized", maxSupportedTransactionVersion: 0 },
        ]);
        observedInstructions=tx?.transaction.message.instructions??[];
        const accounts = tx?.transaction.message.accountKeys.map((k) =>
          typeof k === "string" ? k : k.pubkey,
        ) ?? [];
        if (!tx) return Response.json({ok:true,finalized:false,code:"TX_NOT_FOUND",message:"Chưa đọc được giao dịch. Hãy kiểm tra lại; không gửi thêm tiền."});
        if (tx.meta?.err) {
          return Response.json({ error: "Giao dịch đã thất bại trên Devnet.", code: "TX_FAILED", escrowAddress: row.escrow_address }, { status: 409 });
        }
        if (!accounts.includes(row.escrow_address) || !accounts.includes(ESCROW_PROGRAM)) {
          return Response.json({
            error: "Transaction không thuộc escrow của challenge này.",
            code: "ESCROW_MISMATCH",
            expectedEscrow: row.escrow_address,
            transactionAccounts: accounts.filter((account) => account !== ESCROW_PROGRAM),
          }, { status: 409 });
        }
      }
      const op = body.operationId ? await env.DB.prepare(
        "SELECT id,action,submission_id FROM escrow_operations WHERE id=? AND challenge_id=? AND actor_user_id=?"
      ).bind(body.operationId,id,user.id).first<{id:string;action:string;submission_id:string|null}>() : null;
      if (body.operationId && !op) return Response.json({error:"Không tìm thấy yêu cầu giao dịch này.",code:"OPERATION_NOT_FOUND"},{status:404});
      if(op && signature){
        const expectedDisc=await disc("global:"+op.action);
        const matching=observedInstructions.find(ix=>ix.programId===ESCROW_PROGRAM && ix.accounts?.includes(row.escrow_address) && ix.accounts?.includes(user.walletAddress) && ix.data && Buffer.from(bs58.decode(ix.data)).subarray(0,8).equals(expectedDisc));
        if(!matching)return Response.json({error:"Giao dịch không thực hiện thao tác đã chọn.",code:"OPERATION_MISMATCH"},{status:409});
        const expected=await env.DB.prepare("SELECT instructions_json FROM escrow_operation_expectations WHERE operation_id=?").bind(op.id).first<{instructions_json:string}>();
        if(expected){
          const instructions=JSON.parse(expected.instructions_json) as Array<{data:string;accounts:string[]}>;
          if(!instructions.every(e=>observedInstructions.some(ix=>ix.programId===ESCROW_PROGRAM && ix.data===e.data && JSON.stringify(ix.accounts)===JSON.stringify(e.accounts))))
            return Response.json({error:"Nội dung giao dịch không khớp yêu cầu đã chuẩn bị.",code:"OPERATION_PAYLOAD_MISMATCH"},{status:409});
        }
      }
      // Re-read finalized account state after the signature check. This is the
      // important recovery path for Initialize + Fund transactions.
      let synced;
      try {
        synced = await readAndSyncEscrow(row, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Không thể đồng bộ trạng thái escrow.";
        return Response.json({ error: message, code: "ESCROW_SYNC_FAILED", escrowAddress: row.escrow_address }, { status: 409 });
      }
      const receiptHash = op?.submission_id ? (await hashBytes(op.submission_id)).toString("hex") : "";
      const matchingReceipt = op?.submission_id
        ? synced.submissions.find(s=>s.submissionId===receiptHash) : undefined;
      const completed = op ? operationSatisfied(op.action,synced.config,synced.state,matchingReceipt,user.walletAddress) : false;
      if (signature && op && completed) await env.DB.prepare("UPDATE escrow_operations SET signature=? WHERE id=? AND (signature IS NULL OR signature=?)").bind(signature,op.id,signature).run();
      return Response.json({
        ok:true, finalized:Boolean(synced.state), operationComplete:completed,
        funded:operationSatisfied("initialize",synced.config,synced.state),
        code:synced.state?"ESCROW_FINALIZED":"ESCROW_STATE_PENDING",
        detail:await presentEscrow(c,row,user,synced),
      });

    }
    const data = await readAndSyncEscrow(row, true);
    const config = data.config;
    if (body.senderWallet !== user.walletAddress)
      throw new Response("Dùng đúng ví đang đăng nhập để ký.", { status: 403 });
    const action = body.action as EscrowAction;
    const allowed = [
      "initialize",
      "accept_role",
      "publish",
      "register_submission",
      "record_result",
      "allocate_award",
      "claim_award",
      "refund_unused",
      "finalize_results",
      "cancel_empty",
    ];
    if (!allowed.includes(action))
      throw new Response("Thao tác không hợp lệ.", { status: 400 });
    if (
      ["initialize", "publish", "cancel_empty"].includes(action) &&
      config.funder !== user.walletAddress
    )
      throw new Response("Chỉ ví tạo quỹ được thực hiện.", { status: 403 });
    if (
      [
        "accept_role",
        "record_result",
        "allocate_award",
        "finalize_results",
      ].includes(action) &&
      ![config.reviewer, config.backup].includes(user.walletAddress)
    )
      throw new Response("Cần ví người đánh giá được chỉ định.", {
        status: 403,
      });
    if (action === "initialize" && data.state)
      throw new Response("Quỹ đã tồn tại. Hãy kiểm tra lại thay vì nạp thêm.", {
        status: 409,
      });
    if (action !== "initialize" && !data.state)
      throw new Response("Quỹ chưa được xác nhận trên blockchain.", {
        status: 409,
      });
    const extra: {
      student?: string;
      submissionId?: string;
      evidenceHash?: string;
      resultHash?: string;
      eligible?: boolean;
    } = {};
    let partialSigner;
    if (
      [
        "register_submission",
        "record_result",
        "allocate_award",
        "claim_award",
      ].includes(action)
    ) {
      const sub = await env.DB.prepare(
        `SELECT s.*,p.student_user_id,w.address AS wallet,a.status AS assessment_status,a.final_result_hash,
        (SELECT review_json FROM reviews r WHERE r.assessment_id=a.id ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1) AS review_json FROM submissions s JOIN participations p ON p.id=s.participation_id JOIN wallets w ON w.user_id=p.student_user_id LEFT JOIN assessments a ON a.submission_id=s.id WHERE s.id=? AND p.challenge_id=?`,
      )
        .bind(body.submissionId || "", id)
        .first<Record<string, unknown>>();
      if (!sub) throw new Response("Không tìm thấy bài nộp.", { status: 404 });
      extra.student = String(sub.wallet);
      extra.submissionId = String(sub.id);
      if (action === "register_submission") {
        if (sub.student_user_id !== user.id)
          throw new Response("Chỉ chủ bài nộp được xác nhận.", { status: 403 });
        if (!["draft", "signing"].includes(String(sub.state)))
          throw new Response("Bài nộp đã khóa.", { status: 409 });
        const files = await env.DB.prepare(
          "SELECT id,sha256 FROM submission_files WHERE submission_id=? ORDER BY id",
        )
          .bind(sub.id)
          .all();
        if (!files.results.length)
          throw new Response(
            "Tải ít nhất một tệp và lưu ghi chú trước khi nộp.",
            { status: 400 },
          );
        const lock = await env.DB.prepare(
          "SELECT evidence_hash FROM escrow_submission_locks WHERE submission_id=?",
        )
          .bind(sub.id)
          .first<{ evidence_hash: string }>();
        extra.evidenceHash =
          lock?.evidence_hash ||
          (
            await hashBytes(
              JSON.stringify({
                note: sub.reflection,
                evidence: sub.evidence_json,
                files: files.results,
              }),
            )
          ).toString("hex");
        partialSigner = await registrar();
        if (String(partialSigner.address) !== config.registrar)
          throw new Response(
            "Ví xác nhận bài nộp đã thay đổi cấu hình; cần khôi phục đúng ví.",
            { status: 503 },
          );
        await env.DB.batch([
          env.DB.prepare(
            "INSERT OR IGNORE INTO escrow_submission_locks(submission_id,challenge_id,student_wallet,evidence_hash) SELECT ?,?,?,' ' WHERE EXISTS(SELECT 1 FROM submission_files WHERE submission_id=?)",
          ).bind(sub.id, id, user.walletAddress, sub.id),
          env.DB.prepare(
            "UPDATE submissions SET state='signing',locked_at=CURRENT_TIMESTAMP WHERE id=? AND state='draft' AND EXISTS(SELECT 1 FROM escrow_submission_locks l WHERE l.submission_id=submissions.id)",
          ).bind(sub.id),
        ]);
        const frozen = await env.DB.prepare(
          "SELECT reflection,evidence_json FROM submissions WHERE id=?",
        )
          .bind(sub.id)
          .first<{ reflection: string; evidence_json: string }>();
        const frozenFiles = await env.DB.prepare(
          "SELECT id,sha256 FROM submission_files WHERE submission_id=? ORDER BY id",
        )
          .bind(sub.id)
          .all();
        if (!frozenFiles.results.length)
          throw new Response("Bài nộp chưa có tệp. Tải tệp rồi thử lại.", {
            status: 409,
          });
        extra.evidenceHash = (
          await hashBytes(
            JSON.stringify({
              note: frozen?.reflection,
              evidence: frozen?.evidence_json,
              files: frozenFiles.results,
            }),
          )
        ).toString("hex");
        await env.DB.prepare(
          "UPDATE escrow_submission_locks SET evidence_hash=? WHERE submission_id=? AND evidence_hash=' '",
        )
          .bind(extra.evidenceHash, sub.id)
          .run();
      }
      if (action === "record_result") {
        if (!["approved", "rejected"].includes(String(sub.assessment_status)))
          throw new Response(
            "Hãy chấm thủ công hoặc phê duyệt kết quả trong mục Đánh giá trước.",
            { status: 409 },
          );
        const eligible = await rewardEligibility({
          assessment_status:String(sub.assessment_status),final_result_hash:sub.final_result_hash as string|null,
          review_json:sub.review_json as string|null,termsText:config.termsText});
        if (eligible === null) throw new Response("Điểm hoặc điều khoản chưa khớp; cần đối soát trước khi ghi kết quả.",{status:409});
        extra.eligible = eligible;
        extra.resultHash = (
          await hashBytes(
            JSON.stringify({
              submissionId: sub.id,
              status: sub.assessment_status,
              finalHash: sub.final_result_hash,
            }),
          )
        ).toString("hex");
      }
      if (action === "allocate_award" && await rewardEligibility({
        assessment_status:sub.assessment_status as string|null,final_result_hash:sub.final_result_hash as string|null,
        review_json:sub.review_json as string|null,termsText:config.termsText}) !== true)
        throw new Response("Bài chưa đạt theo kết quả chính thức.", {
          status: 409,
        });
      if(["record_result","allocate_award","claim_award"].includes(action)){
        const hash=(await hashBytes(String(sub.id))).toString("hex");
        const receipt=data.submissions.find(s=>s.submissionId===hash && s.student===sub.wallet)??null;
        const eligible=await rewardEligibility({assessment_status:sub.assessment_status as string|null,final_result_hash:sub.final_result_hash as string|null,review_json:sub.review_json as string|null,termsText:config.termsText});
        const progress=rewardProgress(config,data.state,receipt,sub.assessment_status as string|null,eligible,String(sub.wallet),user.walletAddress,Math.floor(Date.now()/1000));
        if(!progress.available || progress.action!==action)return Response.json({error:progress.reason.vi,code:"ACTION_NOT_READY",progress},{status:409});
      }
      if (action === "claim_award" && sub.student_user_id !== user.id)
        throw new Response("Chỉ chủ bài nộp nhận thưởng qua giao diện này.", {
          status: 403,
        });
    }
    if (["record_result","allocate_award","finalize_results"].includes(action)) {
      const activeReviewer = Date.now()/1000 > config.reviewDeadline ? config.backup : config.reviewer;
      if (user.walletAddress !== activeReviewer) return Response.json({error:"Quyền đánh giá hiện thuộc ví: "+activeReviewer,code:"WRONG_ACTIVE_REVIEWER"},{status:403});
    }
    const instructions = await escrowInstructions(
      config,
      user.walletAddress,
      action,
      extra,
    );
    const transaction = await buildEscrowTransaction(
      rpc,
      user.walletAddress,
      instructions,
      partialSigner,
    );
    const operationId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("INSERT INTO escrow_operations(id,challenge_id,actor_user_id,action,submission_id) VALUES(?,?,?,?,?)")
        .bind(operationId,id,user.id,action,body.submissionId||null),
      env.DB.prepare("INSERT INTO escrow_operation_expectations(operation_id,instructions_json) VALUES(?,?)")
        .bind(operationId,JSON.stringify(instructions.filter(ix=>String(ix.programAddress)===ESCROW_PROGRAM).map(ix=>({
          data:bs58.encode(new Uint8Array(ix.data??[])),accounts:ix.accounts?.map(a=>String(a.address))??[]
        }))))
    ]);
    return Response.json(
      { transaction, operationId },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    return jsonError(e);
  }
}

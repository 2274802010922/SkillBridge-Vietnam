import { access } from "../handler";
import { jsonError, requireSessionUser } from "@/backend/auth/auth";
import { ESCROW_PROGRAM, hashBytes } from "@/solana/client/challenge-escrow";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await params;
    const { row, config } = await access(id, user);
    if (!row || !config)
      return Response.json({ error: "Chưa có cam kết quỹ." }, { status: 404 });
    if (
      (await hashBytes(config.termsText)).toString("hex") !== config.termsHash
    )
      return Response.json(
        { error: "Cam kết lưu trữ không khớp mã băm." },
        { status: 409 },
      );
    return Response.json(
      {
        format: "skillbridge.commitment.v1",
        network: "solana:devnet",
        program: ESCROW_PROGRAM,
        escrow: row.escrow_address,
        termsHash: config.termsHash,
        termsText: config.termsText,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Disposition":
            'attachment; filename="skillbridge-commitment.json"',
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}

import { parseVietQrPayload } from "@/lib/bank-directory";
import {
  assertSameOrigin,
  jsonError,
  requireSessionUser,
} from "../../../../../lib/auth";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireSessionUser(request);
    const body = (await request.json()) as { payload?: string };
    const parsed = parseVietQrPayload(body.payload || "");
    if (!parsed)
      return Response.json(
        {
          error:
            "Không đọc được payload VietQR. Bạn có thể chọn ngân hàng và nhập số tài khoản thủ công.",
        },
        { status: 400 },
      );
    return Response.json(parsed, {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}

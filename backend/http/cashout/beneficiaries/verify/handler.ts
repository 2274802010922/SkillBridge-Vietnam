import { findBank } from "@/shared/data/bank-directory";
import {
  assertSameOrigin,
  jsonError,
  requireSessionUser,
} from "../../../../auth/auth";

/**
 * P0 intentionally verifies format and bank BIN only. It does not claim to
 * know the account owner until an approved name-inquiry provider is enabled.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await requireSessionUser(request);
    const body = (await request.json()) as {
      method?: string;
      bankCode?: string;
      destination?: string;
      accountHolder?: string;
    };
    const method = body.method?.trim().toLowerCase() || "bank";
    const destination = body.destination?.replace(/\D/g, "") || "";
    if (method === "bank") {
      const bank = findBank(body.bankCode);
      if (!bank)
        return Response.json(
          { error: "Chọn ngân hàng từ danh sách để tiếp tục." },
          { status: 400 },
        );
      if (!/^\d{6,24}$/.test(destination))
        return Response.json(
          { error: "Số tài khoản cần có 6–24 chữ số." },
          { status: 400 },
        );
      return Response.json({
        verification: {
          state: "sandbox_confirmed",
          provider: "sandbox_directory",
          accountName: null,
          bank,
          message:
            "Đã xác nhận mã BIN và định dạng số tài khoản. Tên chủ tài khoản chưa được ngân hàng xác minh trong Devnet.",
        },
      });
    }
    if (!/^0\d{8,10}$/.test(destination))
      return Response.json(
        { error: "Số điện thoại ví cần bắt đầu bằng 0 và có 9–11 chữ số." },
        { status: 400 },
      );
    return Response.json({
      verification: {
        state: "sandbox_confirmed",
        provider: "sandbox_directory",
        accountName: null,
        bank: null,
        message:
          "Đã xác nhận định dạng số điện thoại. Chủ ví chưa được đối tác xác minh trong Devnet.",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

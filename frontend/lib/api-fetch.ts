/** Bounded application requests; wallet signing itself is never timed out here. */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 55_000): Promise<Response> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  const vi = typeof document === "undefined" || document.documentElement.lang !== "en";
  let response: Response;
  try {
    response = await fetch(input, { ...init, signal });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new Error(timeout.aborted
      ? vi ? "Yêu cầu quá thời gian chờ. Kiểm tra lại trạng thái trước khi gửi giao dịch mới." : "Request timed out. Recheck the status before sending a new transaction."
      : vi ? "Mất kết nối. Hãy kiểm tra mạng rồi thử lại." : "Connection lost. Check your network and retry.");
  }
  if (!response.ok && !response.headers.get("content-type")?.includes("application/json")) {
    const raw = await response.text();
    const message = response.status === 401
      ? vi ? "Phiên đã hết hạn. Hãy kết nối và xác minh ví lại." : "Session expired. Reconnect and verify your wallet."
      : raw.trim().startsWith("<") || !raw.trim()
        ? vi ? "Máy chủ chưa xử lý được yêu cầu. Hãy thử lại sau." : "The server could not process the request. Please retry later."
        : raw.slice(0, 600);
    return Response.json({ error: message, code: "HTTP_" + response.status }, { status: response.status });
  }
  return response;
}

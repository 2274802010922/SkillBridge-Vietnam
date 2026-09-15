import { GET as readFile } from "../handler";
import { env } from "@/backend/config/runtime-env";
import { extractDocumentSections } from "@/backend/ai/document-text";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const response = await readFile(request, context);
  if (!response.ok) return response;
  const { id } = await context.params;
  const file = await env.DB.prepare(
    "SELECT original_name,content_type,sha256,size_bytes FROM submission_files WHERE id=?",
  )
    .bind(id)
    .first<{
      original_name: string;
      content_type: string;
      sha256: string;
      size_bytes: string;
    }>();
  if (!file || Number(file.size_bytes) > 20 * 1024 * 1024) {
    await response.body?.cancel();
    return Response.json(
      { error: "Tệp quá lớn hoặc không tồn tại." },
      { status: 413 },
    );
  }
  const bytes = await response.arrayBuffer();
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  if (hash !== file.sha256)
    return Response.json(
      { error: "Tệp không khớp mã băm đã lưu." },
      { status: 409 },
    );
  const extracted = await extractDocumentSections([
    { filename: file.original_name, contentType: file.content_type, bytes },
  ]);
  return Response.json(
    {
      ...extracted,
      file: { id, name: file.original_name, type: file.content_type, hash },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

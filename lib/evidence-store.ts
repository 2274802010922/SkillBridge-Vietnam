import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

export type EvidenceObject = {
  body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function localPath(key: string) {
  const root = path.resolve(process.cwd(), ".data", "evidence");
  const target = path.resolve(root, key.replaceAll("/", path.sep));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Evidence key không hợp lệ.");
  }
  return { root, target };
}

function hasVercelBlobToken() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

function requireRemoteStoreOnVercel() {
  if (process.env.VERCEL && !hasVercelBlobToken()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN chưa được cấu hình. Hãy tạo Private Blob store trong Vercel Storage.",
    );
  }
}

export async function putEvidence(
  key: string,
  bytes: ArrayBuffer,
  contentType: string,
) {
  requireRemoteStoreOnVercel();
  if (hasVercelBlobToken()) {
    await put(key, bytes, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType,
    });
    return;
  }
  const { target } = localPath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, new Uint8Array(bytes));
}

export async function getEvidence(key: string): Promise<EvidenceObject | null> {
  requireRemoteStoreOnVercel();
  if (hasVercelBlobToken()) {
    const result = await get(key, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    let cached: ArrayBuffer | null = null;
    return {
      body: result.stream,
      async arrayBuffer() {
        if (!cached) cached = await new Response(result.stream).arrayBuffer();
        return cached;
      },
    };
  }
  try {
    const bytes = await readFile(/* turbopackIgnore: true */ localPath(key).target);
    const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    return {
      body: new Response(exact).body,
      async arrayBuffer() { return exact; },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function deleteEvidence(key: string) {
  requireRemoteStoreOnVercel();
  if (hasVercelBlobToken()) {
    await del(key);
    return;
  }
  try {
    await unlink(localPath(key).target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

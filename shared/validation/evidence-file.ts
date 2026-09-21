export function evidenceMime(name: string, supplied: string): string {
  const type=supplied.toLowerCase().split(";")[0].trim();
  if(type && !["application/octet-stream","text/plain"].includes(type)) return type;
  const ext=name.toLowerCase().split(".").pop();
  if(ext==="md" || ext==="markdown")return "text/markdown";
  return type || (ext==="txt"?"text/plain":"application/octet-stream");
}
export function validTextEvidence(bytes: Uint8Array, mime: string): boolean {
  if(!["text/markdown","text/plain"].includes(mime))return true;
  try {const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);return !text.includes("\u0000");}catch{return false;}
}

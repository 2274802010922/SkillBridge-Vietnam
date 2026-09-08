export type BankDirectoryEntry = {
  code: string;
  bin: string;
  shortName: string;
  name: string;
};

/**
 * Product-facing directory for the pilot. The bank BIN is selected explicitly;
 * an account number alone must never be used to guess a bank.
 */
export const BANK_DIRECTORY: BankDirectoryEntry[] = [
  {
    code: "VCB",
    bin: "970436",
    shortName: "Vietcombank",
    name: "Ngân hàng TMCP Ngoại thương Việt Nam",
  },
  {
    code: "BIDV",
    bin: "970418",
    shortName: "BIDV",
    name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
  },
  {
    code: "CTG",
    bin: "970415",
    shortName: "VietinBank",
    name: "Ngân hàng TMCP Công thương Việt Nam",
  },
  {
    code: "TCB",
    bin: "970407",
    shortName: "Techcombank",
    name: "Ngân hàng TMCP Kỹ thương Việt Nam",
  },
  {
    code: "MB",
    bin: "970422",
    shortName: "MB Bank",
    name: "Ngân hàng TMCP Quân đội",
  },
  {
    code: "ACB",
    bin: "970416",
    shortName: "ACB",
    name: "Ngân hàng TMCP Á Châu",
  },
  {
    code: "VPB",
    bin: "970432",
    shortName: "VPBank",
    name: "Ngân hàng TMCP Việt Nam Thịnh Vượng",
  },
  {
    code: "VIB",
    bin: "970441",
    shortName: "VIB",
    name: "Ngân hàng TMCP Quốc tế Việt Nam",
  },
  {
    code: "TPB",
    bin: "970423",
    shortName: "TPBank",
    name: "Ngân hàng TMCP Tiên Phong",
  },
  {
    code: "STB",
    bin: "970403",
    shortName: "Sacombank",
    name: "Ngân hàng TMCP Sài Gòn Thương Tín",
  },
  {
    code: "HDB",
    bin: "970437",
    shortName: "HDBank",
    name: "Ngân hàng TMCP Phát triển TP.HCM",
  },
  {
    code: "MSB",
    bin: "970426",
    shortName: "MSB",
    name: "Ngân hàng TMCP Hàng Hải Việt Nam",
  },
];

export function findBank(value: string | undefined | null) {
  const normalized = value?.trim().toUpperCase() || "";
  return (
    BANK_DIRECTORY.find(
      (bank) => bank.code === normalized || bank.bin === normalized,
    ) || null
  );
}

type TlvField = { id: string; value: string };

function readTlv(payload: string): TlvField[] {
  const fields: TlvField[] = [];
  let offset = 0;
  while (offset + 4 <= payload.length) {
    const id = payload.slice(offset, offset + 2);
    const length = Number.parseInt(payload.slice(offset + 2, offset + 4), 10);
    if (
      !Number.isInteger(length) ||
      length < 0 ||
      offset + 4 + length > payload.length
    )
      break;
    fields.push({ id, value: payload.slice(offset + 4, offset + 4 + length) });
    offset += 4 + length;
  }
  return fields;
}

/**
 * Parses the NAPAS/VietQR merchant-account template enough to prefill the
 * bank BIN and account number. It is deliberately a convenience parser, not
 * an account-owner verification service.
 */
export function parseVietQrPayload(raw: string) {
  const payload = raw.replace(/\s/g, "").trim();
  if (payload.length < 20 || !/^[A-Za-z0-9]+$/.test(payload)) return null;
  for (const field of readTlv(payload)) {
    if (!/^(26|38|64)$/.test(field.id)) continue;
    const nested = readTlv(field.value);
    const aid = nested.find((item) => item.id === "00")?.value || "";
    if (!aid.includes("A000000727")) continue;
    const bankToken = nested.find((item) => item.id === "01")?.value || "";
    const accountNumber =
      nested.find((item) => item.id === "02")?.value.replace(/\D/g, "") || "";
    const binMatch = bankToken.match(/9704\d{2}/);
    const bank = findBank(binMatch?.[0]);
    if (bank && /^[0-9]{6,24}$/.test(accountNumber))
      return { bank, accountNumber };
  }
  return null;
}

import * as XLSX from "xlsx";
import * as FileSystem from "expo-file-system/legacy"; // ✅ SDK 54 fix [web:197]
import * as Sharing from "expo-sharing"; // [web:177]

export type TxRow = {
  date: string;
  title: string;
  category: string;
  amountPkr: number;
  by: string;
  receipt: "Yes" | "No";
};

function toISODate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export async function exportXlsx(params: {
  filePrefix?: string;
  summary: Record<string, any>[];
  transactions: TxRow[];
}) {
  const filePrefix = params.filePrefix ?? "FamilyMate_Analytics";

  const wsSummary = XLSX.utils.json_to_sheet(params.summary);
  const wsTx = XLSX.utils.json_to_sheet(params.transactions);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
  XLSX.utils.book_append_sheet(wb, wsTx, "Transactions");

  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

  const fileName = `${filePrefix}_${toISODate()}.xlsx`;

  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error("FileSystem.documentDirectory not available"); // safety

  const uri = dir + fileName;

  await FileSystem.writeAsStringAsync(uri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  }); // [web:164][web:197]

  // User can save to Downloads/Files/Drive/WhatsApp from Share
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      dialogTitle: "Save analytics Excel file",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    }); // [web:177]
  }

  return { uri, fileName };
}
 
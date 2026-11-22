import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
GlobalWorkerOptions.workerSrc = workerUrl;
export async function extractPDF(file: File) {
  if (file.size > 10_000_000) throw new Error("PDF limit is 10 MB.");
  const loading = getDocument({ data: await file.arrayBuffer() });
  const doc = await loading.promise;
  if (doc.numPages > 100)
    throw new Error("Import at most 100 PDF pages at once.");
  let text = "";
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text +=
        `\n\n## Page ${i}\n` +
        content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
      if (text.length > 80000) {
        text = text.slice(0, 80000) + "\n[Truncated at 80,000 characters]";
        break;
      }
    }
  } finally {
    await loading.destroy();
  }
  if (!text.trim())
    throw new Error(
      "This PDF has no readable text. Use a screenshot with the authenticated image assistant, or enter the schedule manually.",
    );
  return text;
}

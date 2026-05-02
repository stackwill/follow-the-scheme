import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export type TextItem = {
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function extractPdfTextItems(filePath: string) {
  const pdf = await getDocument(filePath).promise;
  const items: TextItem[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item) || !("transform" in item)) {
        continue;
      }

      const [, , , , x, y] = item.transform;
      items.push({
        pageNumber,
        text: item.str,
        x,
        y,
        width: item.width ?? 0,
        height: item.height ?? 0,
      });
    }
  }

  return items;
}

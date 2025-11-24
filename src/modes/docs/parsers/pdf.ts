let cachedPdfLib: typeof import('pdfjs-dist') | null = null;

async function getPdfJs() {
  if (!cachedPdfLib) {
    cachedPdfLib = await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.mjs?worker&url');
    (cachedPdfLib as any).GlobalWorkerOptions.workerSrc = worker.default;
  }
  return cachedPdfLib;
}

export async function parsePdfFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdfjsLib = await getPdfJs();
  const pdf = await (pdfjsLib as any).getDocument({ data: buf }).promise;
  let out = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const s = content.items.map((it: any) => it.str).join(' ');
    out += s + '\n';
  }
  return out.trim();
}



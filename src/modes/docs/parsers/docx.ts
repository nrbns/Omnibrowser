type MammothModule = typeof import('mammoth');

async function loadMammoth(): Promise<MammothModule> {
  const mod = await import('mammoth');
  return mod;
}

export async function parseDocxFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const mammoth = await loadMammoth();
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return (res.value || '').trim();
}



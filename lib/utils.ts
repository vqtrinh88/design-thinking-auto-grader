export function roundToHalf(value: number) {
  return Math.round(value * 2) / 2;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeText(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function estimateWordCount(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function normalizeHeader(input: string) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function sanitizeWorksheetName(name: string) {
  return name.replace(/[\\/?*\[\]:]/g, '_').slice(0, 31);
}

export function decodeFilename(filename: string) {
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

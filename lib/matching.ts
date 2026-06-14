import { normalizeText } from './utils';

export type StudentRow = {
  rowIndex: number;
  mssv: string;
  fullName: string;
  raw: Record<string, unknown>;
};

export type MatchResult = {
  student: StudentRow | null;
  confidence: number;
  basis: string;
};

function extractStudentSignals(text: string, fileName: string) {
  const combined = `${fileName} ${text}`;
  // Extract runs of 6-12 digits even when glued to letters/underscores
  // (e.g. "2012345_baitap.pdf" or "MSSV2012345.docx"). A plain \b boundary
  // fails here because "_" counts as a word character.
  const mssvMatches = combined.match(/(?<!\d)\d{6,12}(?!\d)/g) || [];
  const normalized = normalizeText(combined);
  return {
    possibleMssv: [...new Set(mssvMatches)],
    normalized,
    // Compact form (no spaces) catches glued/CamelCase filenames like
    // "BaiLuan_TranThiBinh.docx" => "...tranthibinh...".
    compact: normalized.replace(/\s+/g, ''),
    tokens: new Set(normalized.split(' ').filter(Boolean))
  };
}

export function matchStudentFromEssay(students: StudentRow[], essayText: string, fileName: string): MatchResult {
  const { possibleMssv, normalized, compact, tokens } = extractStudentSignals(essayText, fileName);

  for (const mssv of possibleMssv) {
    const exact = students.find((student) => student.mssv && student.mssv === mssv);
    if (exact) {
      return {
        student: exact,
        confidence: 0.99,
        basis: `Khớp MSSV ${mssv} từ tên file hoặc nội dung.`
      };
    }
  }

  let best: StudentRow | null = null;
  let bestScore = 0;

  for (const student of students) {
    const name = normalizeText(student.fullName);
    if (!name) continue;

    let score = 0;
    const nameCompact = name.replace(/\s+/g, '');
    if (name.length >= 4 && (normalized.includes(name) || (nameCompact.length >= 6 && compact.includes(nameCompact)))) {
      score += 0.9;
    }

    // Only count name parts with at least 2 chars and require whole-token
    // matches to avoid false positives like single letter "a" hitting "baitap".
    const parts = name.split(' ').filter((part) => part.length >= 2);
    if (parts.length) {
      const matchedParts = parts.filter((part) => tokens.has(part)).length;
      score += (matchedParts / parts.length) * 0.4;
    }

    if (score > bestScore) {
      bestScore = score;
      best = student;
    }
  }

  // Require a meaningful signal before claiming a match; otherwise route to
  // manual review instead of guessing.
  if (!best || bestScore < 0.4) {
    return {
      student: null,
      confidence: 0,
      basis: 'Không đối sánh được sinh viên từ tên file hoặc nội dung.'
    };
  }

  return {
    student: best,
    confidence: Math.min(bestScore, 0.95),
    basis: `Khớp tên gần đúng với độ tin cậy ${Math.min(bestScore, 0.95).toFixed(2)}.`
  };
}

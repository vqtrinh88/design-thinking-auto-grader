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
  const mssvMatches = combined.match(/\b\d{6,12}\b/g) || [];
  return {
    possibleMssv: [...new Set(mssvMatches)],
    normalized: normalizeText(combined)
  };
}

export function matchStudentFromEssay(students: StudentRow[], essayText: string, fileName: string): MatchResult {
  const { possibleMssv, normalized } = extractStudentSignals(essayText, fileName);

  for (const mssv of possibleMssv) {
    const exact = students.find((student) => student.mssv === mssv);
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
    if (normalized.includes(name)) score += 0.9;

    const parts = name.split(' ').filter(Boolean);
    const matchedParts = parts.filter((part) => normalized.includes(part)).length;
    if (parts.length) score += (matchedParts / parts.length) * 0.4;

    if (score > bestScore) {
      bestScore = score;
      best = student;
    }
  }

  if (!best) {
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

import * as XLSX from 'xlsx';
import type { StudentRow } from './matching';
import { normalizeHeader, sanitizeWorksheetName } from './utils';

const REQUIRED_OUTPUT_COLUMNS = [
  'DT_1_Gioi_thieu_DT',
  'DT_2_Qua_trinh_ca_nhan_va_nhom',
  'DT_3_Cam_nhan_ve_mon_hoc',
  'DT_4_Ung_dung_tuong_lai',
  'DT_Tong',
  'DT_5_Gop_y_cho_giang_vien',
  'DT_Nhan_xet_chung',
  'DT_Co_nghi_AI',
  'DT_Ly_do_nghi_AI',
  'DT_Duoi_1500_tu',
  'DT_So_tu_uoc_tinh',
  'DT_File_match',
  'DT_Muc_do_tin_cay_match'
] as const;

export type RosterColumns = {
  mssvKey: string | null;
  nameKey: string | null;
  firstNameKey: string | null;
  lastNameKey: string | null;
};

const MSSV_HEADER_HINTS = ['mssv', 'masosinhvien', 'masinhvien', 'maso', 'masv', 'msv', 'studentid', 'studentcode', 'mahocvien', 'mahs', 'idsinhvien'];
const NAME_HEADER_HINTS = ['hovaten', 'hoten', 'hovten', 'tenhocvien', 'fullname', 'studentname', 'name', 'hovaten'];

function pickColumn(headers: string[], predicate: (normalized: string, original: string) => boolean): string | null {
  for (const header of headers) {
    if (predicate(normalizeHeader(header), header)) return header;
  }
  return null;
}

export function detectRosterColumns(rows: Record<string, unknown>[]): RosterColumns {
  const headerSet = new Set<string>();
  for (const row of rows.slice(0, 25)) {
    Object.keys(row).forEach((key) => headerSet.add(key));
  }
  const headers = [...headerSet];

  const mssvKey = pickColumn(headers, (n) => MSSV_HEADER_HINTS.some((hint) => n.includes(hint)));
  const nameKey = pickColumn(headers, (n) => NAME_HEADER_HINTS.some((hint) => n === hint || n.includes(hint)));

  // Support rosters that split the name into separate "Họ" / "Tên" columns.
  const lastNameKey = nameKey ? null : pickColumn(headers, (n) => n === 'ho' || n === 'holot' || n === 'hodem');
  const firstNameKey = nameKey ? null : pickColumn(headers, (n) => n === 'ten' || n === 'tengoi');

  return { mssvKey, nameKey, firstNameKey, lastNameKey };
}

function readMssv(row: Record<string, unknown>, columns: RosterColumns) {
  if (columns.mssvKey && row[columns.mssvKey] != null) {
    return String(row[columns.mssvKey]).trim();
  }
  // Fallback to legacy fixed keys for backwards compatibility.
  return String(row.MSSV || row['Mã số sinh viên'] || row['Ma so sinh vien'] || '').trim();
}

function readName(row: Record<string, unknown>, columns: RosterColumns) {
  if (columns.nameKey && row[columns.nameKey] != null) {
    const value = String(row[columns.nameKey]).trim();
    if (value) return value;
  }
  if (columns.lastNameKey || columns.firstNameKey) {
    const last = columns.lastNameKey ? String(row[columns.lastNameKey] ?? '').trim() : '';
    const first = columns.firstNameKey ? String(row[columns.firstNameKey] ?? '').trim() : '';
    const combined = `${last} ${first}`.trim();
    if (combined) return combined;
  }
  return String(row['Họ tên'] || row['Ho ten'] || row['Họ và tên'] || row['Ho va ten'] || '').trim();
}

export function readRosterWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const columns = detectRosterColumns(rows);

  const students: StudentRow[] = rows.map((row, index) => ({
    rowIndex: index,
    mssv: readMssv(row, columns),
    fullName: readName(row, columns),
    raw: row
  }));

  return { workbook, firstSheetName, rows, students, columns };
}

export function applyResultsToWorkbook(params: {
  workbook: XLSX.WorkBook;
  sheetName: string;
  rows: Record<string, unknown>[];
  resultsByMssv: Map<string, any>;
  manualReviewRows: Array<Record<string, unknown>>;
  columns: RosterColumns;
}) {
  const { workbook, sheetName, rows, resultsByMssv, manualReviewRows, columns } = params;

  const updatedRows = rows.map((row) => {
    const mssv = readMssv(row, columns);
    const result = resultsByMssv.get(mssv);

    const next: Record<string, unknown> = { ...row };
    for (const col of REQUIRED_OUTPUT_COLUMNS) {
      if (!(col in next)) next[col] = '';
    }

    if (!result) return next;

    next.DT_1_Gioi_thieu_DT = result.score_1_intro;
    next.DT_2_Qua_trinh_ca_nhan_va_nhom = result.score_2_process;
    next.DT_3_Cam_nhan_ve_mon_hoc = result.score_3_positive;
    next.DT_4_Ung_dung_tuong_lai = result.score_4_future;
    next.DT_Tong = result.final_total;
    next.DT_5_Gop_y_cho_giang_vien = result.lecturer_feedback_note;
    next.DT_Nhan_xet_chung = result.overall_comment;
    next.DT_Co_nghi_AI = result.ai_likely;
    next.DT_Ly_do_nghi_AI = result.ai_reason;
    next.DT_Duoi_1500_tu = result.under_1500_words;
    next.DT_So_tu_uoc_tinh = result.estimated_word_count;
    next.DT_File_match = result._matchedFileName || '';
    next.DT_Muc_do_tin_cay_match = result.matched_student?.confidence ?? '';

    return next;
  });

  workbook.Sheets[sheetName] = XLSX.utils.json_to_sheet(updatedRows);

  const reviewSheetName = sanitizeWorksheetName('Review_Manual');
  workbook.Sheets[reviewSheetName] = XLSX.utils.json_to_sheet(manualReviewRows.length ? manualReviewRows : [{ Note: 'Không có dòng review thủ công.' }]);
  if (!workbook.SheetNames.includes(reviewSheetName)) workbook.SheetNames.push(reviewSheetName);

  return workbook;
}

export function workbookToBuffer(workbook: XLSX.WorkBook) {
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

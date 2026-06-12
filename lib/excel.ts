import * as XLSX from 'xlsx';
import type { StudentRow } from './matching';
import { sanitizeWorksheetName } from './utils';

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

export function readRosterWorkbook(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const students: StudentRow[] = rows.map((row, index) => {
    const mssv = String(row.MSSV || row['Mã số sinh viên'] || row['Ma so sinh vien'] || '').trim();
    const fullName = String(row['Họ tên'] || row['Ho ten'] || row['Họ và tên'] || row['Ho va ten'] || '').trim();
    return {
      rowIndex: index,
      mssv,
      fullName,
      raw: row
    };
  });

  return { workbook, firstSheetName, rows, students };
}

export function applyResultsToWorkbook(params: {
  workbook: XLSX.WorkBook;
  sheetName: string;
  rows: Record<string, unknown>[];
  resultsByMssv: Map<string, any>;
  manualReviewRows: Array<Record<string, unknown>>;
}) {
  const { workbook, sheetName, rows, resultsByMssv, manualReviewRows } = params;

  const updatedRows = rows.map((row) => {
    const mssv = String(row.MSSV || row['Mã số sinh viên'] || row['Ma so sinh vien'] || '').trim();
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

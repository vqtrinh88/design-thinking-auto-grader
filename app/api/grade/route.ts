import { NextResponse } from 'next/server';
import { applyResultsToWorkbook, readRosterWorkbook, workbookToBuffer } from '@/lib/excel';
import { extractEssayText } from '@/lib/extract';
import { gradeEssayFromFile, gradeEssayFromText } from '@/lib/grading';
import { matchStudentFromEssay } from '@/lib/matching';
import { clamp, roundToHalf } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 300;

type PreviewRow = {
  fileName: string;
  mssv: string;
  fullName: string;
  total: number;
  aiFlag: string;
  under1500: string;
  status: string;
};

function normalizeScoring(result: any) {
  result.score_1_intro = clamp(roundToHalf(Number(result.score_1_intro || 0)), 0, 2);
  result.score_2_process = clamp(roundToHalf(Number(result.score_2_process || 0)), 0, 3);
  result.score_3_positive = clamp(roundToHalf(Number(result.score_3_positive || 0)), 0, 2);
  result.score_4_future = clamp(roundToHalf(Number(result.score_4_future || 0)), 0, 3);
  result.raw_total = roundToHalf(result.score_1_intro + result.score_2_process + result.score_3_positive + result.score_4_future);
  result.final_total = clamp(Math.max(7, result.raw_total), 7, 10);
  return result;
}

export async function POST(request: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'Thiếu OPENAI_API_KEY trong biến môi trường.' }, { status: 500 });
    }

    const formData = await request.formData();
    const roster = formData.get('roster');
    const essays = formData.getAll('essays');

    if (!(roster instanceof File)) {
      return NextResponse.json({ error: 'Thiếu file Excel danh sách lớp.' }, { status: 400 });
    }

    if (!essays.length) {
      return NextResponse.json({ error: 'Thiếu file bài luận.' }, { status: 400 });
    }

    const rosterBuffer = Buffer.from(await roster.arrayBuffer());
    const { workbook, firstSheetName, rows, students } = readRosterWorkbook(rosterBuffer);
    const resultsByMssv = new Map<string, any>();
    const manualReviewRows: Array<Record<string, unknown>> = [];
    const previewRows: PreviewRow[] = [];

    let processed = 0;
    let matched = 0;
    let review = 0;
    let aiFlagged = 0;
    let under1500 = 0;
    let duplicates = 0;

    for (const item of essays) {
      if (!(item instanceof File)) continue;

      const extracted = await extractEssayText(item);
      const match = matchStudentFromEssay(students, extracted.text, item.name);

      if (!match.student) {
        review += 1;
        manualReviewRows.push({
          File: item.name,
          Reason: 'Không match được sinh viên',
          ExtractedBy: extracted.extractedBy,
          WordCount: extracted.wordCount
        });
        continue;
      }

      let result: any;
      const fileBuffer = Buffer.from(await item.arrayBuffer());

      if (extracted.wordCount >= 200) {
        result = await gradeEssayFromText({
          essayText: extracted.text,
          fileName: item.name,
          matchedStudent: match.student,
          matchConfidence: match.confidence,
          matchBasis: match.basis
        });
      } else {
        result = await gradeEssayFromFile({
          fileBuffer,
          fileName: item.name,
          matchedStudent: match.student,
          matchConfidence: match.confidence,
          matchBasis: match.basis
        });
      }

      result = normalizeScoring(result);
      result._matchedFileName = item.name;

      if (resultsByMssv.has(match.student.mssv)) {
        duplicates += 1;
        const existing = resultsByMssv.get(match.student.mssv);
        const existingConfidence = existing?.matched_student?.confidence ?? 0;
        if (match.confidence <= existingConfidence) {
          manualReviewRows.push({
            File: item.name,
            MSSV: match.student.mssv,
            FullName: match.student.fullName,
            Reason: 'Trùng MSSV, giữ lại file trước đó có confidence cao hơn',
            Confidence: match.confidence
          });
          continue;
        }
      }

      resultsByMssv.set(match.student.mssv, result);
      processed += 1;

      const status = match.confidence >= 0.8 ? 'Matched' : 'Review';
      if (status === 'Matched') matched += 1;
      else review += 1;

      if (result.ai_likely === 'Có' || result.ai_likely === 'Cần xem lại') aiFlagged += 1;
      if (result.under_1500_words === 'Có') under1500 += 1;

      previewRows.push({
        fileName: item.name,
        mssv: result.matched_student?.mssv || match.student.mssv,
        fullName: result.matched_student?.full_name || match.student.fullName,
        total: result.final_total,
        aiFlag: result.ai_likely,
        under1500: result.under_1500_words,
        status
      });
    }

    const updatedWorkbook = applyResultsToWorkbook({
      workbook,
      sheetName: firstSheetName,
      rows,
      resultsByMssv,
      manualReviewRows
    });

    const output = workbookToBuffer(updatedWorkbook);
    const summary = JSON.stringify({ processed, matched, review, aiFlagged, under1500, duplicates });
    const preview = JSON.stringify(previewRows.slice(0, 30));
    const filename = 'bang-tong-hop-diem-da-cham.xlsx';

    return new NextResponse(output, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'x-grading-summary': summary,
        'x-preview-rows': preview,
        'x-download-filename': filename
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi hệ thống khi chấm bài.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

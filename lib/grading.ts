import OpenAI, { toFile } from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { estimateWordCount } from './utils';
import type { StudentRow } from './matching';

const MODEL = process.env.OPENAI_MODEL || 'gpt-5.5';

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Thiếu OPENAI_API_KEY trong biến môi trường.');
  }

  return new OpenAI({ apiKey });
}

const GradingOutputSchema = z.object({
  matched_student: z.object({
    mssv: z.string(),
    full_name: z.string(),
    confidence: z.number(),
    match_basis: z.string()
  }),
  score_1_intro: z.number(),
  score_2_process: z.number(),
  score_3_positive: z.number(),
  score_4_future: z.number(),
  raw_total: z.number(),
  final_total: z.number(),
  lecturer_feedback_note: z.string(),
  overall_comment: z.string(),
  ai_likely: z.enum(['Không', 'Có', 'Cần xem lại']),
  ai_reason: z.string(),
  under_1500_words: z.enum(['Có', 'Không']),
  estimated_word_count: z.number(),
  evidence_summary: z.array(z.string())
});

export type GradingOutput = z.infer<typeof GradingOutputSchema>;

const GRADING_INSTRUCTIONS = `
Bạn là giảng viên chấm bài luận môn Design Thinking.

Nhiệm vụ:
1. Đọc bài luận của sinh viên.
2. Chấm điểm theo đúng rubrik dưới đây.
3. Chỉ dùng bước điểm 0.5.
4. Tổng điểm bài hợp lệ trong khoảng 7.0-10.0; chỉ bài thật sự xuất sắc mới cho 9.0-10.0.
5. Không tự động trừ điểm vì bài dưới 1500 từ, nhưng phải note lại.
6. Nếu nghi ngờ bài mang tính AI viết, phải gắn cờ để giảng viên đọc lại, nhưng KHÔNG kết luận tuyệt đối.
7. Nếu không tìm thấy phần góp ý cho giảng viên, để 'Không nêu'.
8. Trả đúng schema, không thêm lời giải thích ngoài schema.

Rubrik:
(1) Giới thiệu về Design Thinking: 0-2 điểm
(2) Mô tả quá trình làm việc cá nhân và nhóm để xây dựng giải pháp, cùng bài học rút ra: 0-3 điểm
(3) Điều tích cực về môn học và mức độ đáp ứng kỳ vọng ban đầu: 0-2 điểm
(4) Ứng dụng Design Thinking trong tương lai: 0-3 điểm
(5) Góp ý cho giảng viên: không tính điểm, chỉ tóm tắt

Yêu cầu chấm:
- Bài càng cao càng phải có chiều sâu chiêm nghiệm, ví dụ cụ thể, kể lại quá trình rõ ràng.
- Tránh chấm quá rộng tay.
- Các score 1-4 phải là bội số của 0.5.
- Nếu dữ liệu không đủ để chấm chắc chắn, vẫn chấm trên căn cứ hiện có nhưng ghi rõ trong overall_comment.
`;

function buildUserContent(params: {
  fileName: string;
  matchedStudent: StudentRow | null;
  matchConfidence: number;
  matchBasis: string;
  essayText: string;
}) {
  const { fileName, matchedStudent, matchConfidence, matchBasis, essayText } = params;
  const preWordCount = estimateWordCount(essayText);

  return [
    {
      type: 'input_text' as const,
      text: [
        `Tên file: ${fileName}`,
        `Sinh viên đối sánh sơ bộ:`,
        `- MSSV: ${matchedStudent?.mssv || 'Không rõ'}`,
        `- Họ tên: ${matchedStudent?.fullName || 'Không rõ'}`,
        `- Độ tin cậy match: ${matchConfidence}`,
        `- Căn cứ match: ${matchBasis}`,
        `- Số từ ước tính trước khi chấm: ${preWordCount}`,
        '',
        'BÀI LUẬN:',
        essayText.slice(0, 120000)
      ].join('\n')
    }
  ];
}

export async function gradeEssayFromText(params: {
  essayText: string;
  fileName: string;
  matchedStudent: StudentRow | null;
  matchConfidence: number;
  matchBasis: string;
}) {
  const input = [
    {
      role: 'user' as const,
      content: buildUserContent(params)
    }
  ];

  const client = getClient();
  const response = await client.responses.parse({
    model: MODEL,
    instructions: GRADING_INSTRUCTIONS,
    input,
    text: {
      format: zodTextFormat(GradingOutputSchema, 'design_thinking_grading')
    },
    store: false
  });

  return response.output_parsed;
}

export async function gradeEssayFromFile(params: {
  fileBuffer: Buffer;
  fileName: string;
  matchedStudent: StudentRow | null;
  matchConfidence: number;
  matchBasis: string;
}) {
  const client = getClient();
  const file = await client.files.create({
    file: await toFile(params.fileBuffer, params.fileName),
    purpose: 'user_data'
  });

  const response = await client.responses.parse({
    model: MODEL,
    instructions: GRADING_INSTRUCTIONS,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_file',
            file_id: file.id
          },
          {
            type: 'input_text',
            text: [
              `Tên file: ${params.fileName}`,
              `Sinh viên đối sánh sơ bộ:`,
              `- MSSV: ${params.matchedStudent?.mssv || 'Không rõ'}`,
              `- Họ tên: ${params.matchedStudent?.fullName || 'Không rõ'}`,
              `- Độ tin cậy match: ${params.matchConfidence}`,
              `- Căn cứ match: ${params.matchBasis}`,
              '',
              'Hãy đọc file bài luận và chấm theo schema yêu cầu.'
            ].join('\n')
          }
        ]
      }
    ],
    text: {
      format: zodTextFormat(GradingOutputSchema, 'design_thinking_grading')
    },
    store: false
  });

  return response.output_parsed;
}

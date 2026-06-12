'use client';

import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  ShieldAlert,
  Sparkles,
  Upload,
  X
} from 'lucide-react';

type Summary = {
  processed: number;
  matched: number;
  review: number;
  aiFlagged: number;
  under1500: number;
  duplicates: number;
};

type PreviewRow = {
  fileName: string;
  mssv: string;
  fullName: string;
  total: number;
  aiFlag: string;
  under1500: string;
  status: string;
};

const RUBRIC = [
  { key: '(1)', label: 'Giới thiệu về Design Thinking', score: '0–2' },
  { key: '(2)', label: 'Quá trình cá nhân & nhóm, giải pháp, bài học rút ra', score: '0–3' },
  { key: '(3)', label: 'Cảm nhận tích cực về môn học & mức độ đáp ứng kỳ vọng', score: '0–2' },
  { key: '(4)', label: 'Ứng dụng Design Thinking trong tương lai', score: '0–3' },
  { key: '(5)', label: 'Góp ý cho giảng viên', score: 'Không tính điểm' }
];

const OUTPUT_COLUMNS = [
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
];

export default function Page() {
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [essayFiles, setEssayFiles] = useState<File[]>([]);
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logMessage, setLogMessage] = useState('Sẵn sàng nhận dữ liệu đầu vào.');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState('bang-tong-hop-diem-da-cham.xlsx');

  const rosterInputRef = useRef<HTMLInputElement | null>(null);
  const essayInputRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => {
    const avgScore = previewRows.length
      ? (previewRows.reduce((sum, item) => sum + item.total, 0) / previewRows.length).toFixed(1)
      : '0.0';

    return {
      matched: summary?.matched ?? 0,
      review: summary?.review ?? 0,
      aiFlagged: summary?.aiFlagged ?? 0,
      under1500: summary?.under1500 ?? 0,
      avgScore
    };
  }, [previewRows, summary]);

  const handleRoster = (files: FileList | null) => {
    if (!files?.length) return;
    setRosterFile(files[0]);
    setError(null);
    setLogMessage(`Đã nạp file roster: ${files[0].name}`);
  };

  const handleEssays = (files: FileList | null) => {
    if (!files?.length) return;

    setEssayFiles((prev) => {
      const map = new Map<string, File>();
      [...prev, ...Array.from(files)].forEach((file) => {
        map.set(`${file.name}_${file.size}`, file);
      });
      return Array.from(map.values());
    });

    setError(null);
    setLogMessage(`Đã nhận thêm ${files.length} file bài luận.`);
  };

  const removeEssay = (name: string, size: number) => {
    setEssayFiles((prev) => prev.filter((file) => !(file.name === name && file.size === size)));
    setLogMessage(`Đã loại bỏ file: ${name}`);
  };

  const startGrading = async () => {
    if (!rosterFile || essayFiles.length === 0) {
      setError('Cần có file roster và ít nhất 1 bài luận để bắt đầu.');
      setLogMessage('Thiếu dữ liệu đầu vào để chấm điểm.');
      return;
    }

    setIsGrading(true);
    setError(null);
    setLogMessage('Đang tải file lên server và chấm điểm...');
    setSummary(null);
    setPreviewRows([]);

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      const formData = new FormData();
      formData.append('roster', rosterFile);
      essayFiles.forEach((file) => formData.append('essays', file));

      const response = await fetch('/api/grade', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Không thể chấm bài.');
      }

      const summaryHeader = response.headers.get('x-grading-summary');
      const previewHeader = response.headers.get('x-preview-rows');
      const fileNameHeader = response.headers.get('x-download-filename');

      if (summaryHeader) {
        setSummary(JSON.parse(summaryHeader) as Summary);
      }

      if (previewHeader) {
        setPreviewRows(JSON.parse(previewHeader) as PreviewRow[]);
      }

      if (fileNameHeader) {
        setDownloadFileName(fileNameHeader);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setLogMessage('Đã chấm xong. Có thể tải file tổng hợp điểm đã chấm.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi chấm bài.';
      setError(message);
      setLogMessage(message);
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.12),_transparent_28%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 overflow-hidden rounded-[30px] bg-gradient-to-r from-blue-600 via-sky-600 to-orange-500 p-[1px] shadow-2xl"
        >
          <div className="rounded-[29px] bg-white/90 p-8 backdrop-blur">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
              <div className="max-w-3xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                  <Sparkles className="h-3.5 w-3.5" /> OpenAI + Excel Grading
                </div>
                <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                  Trang chấm bài luận Design Thinking tự động
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Nạp file Excel danh sách lớp và các bài luận. Hệ thống đối sánh MSSV/Họ tên, chấm theo rubrik,
                  gắn cờ bài cần xem lại và xuất file tổng hợp điểm đã chấm dạng Excel.
                </p>
              </div>

              <div className="grid min-w-[320px] grid-cols-2 gap-4 xl:grid-cols-4">
                <StatCard label="Roster" value={rosterFile ? '1 file' : '0'} sub={rosterFile ? 'Đã nạp' : 'Chưa có'} />
                <StatCard label="Essays" value={String(essayFiles.length)} sub="Đã nhận" />
                <StatCard label="Matched" value={String(stats.matched)} sub="Đối sánh tốt" />
                <StatCard label="Avg" value={stats.avgScore} sub="Điểm TB" />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg backdrop-blur">
              <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Tải dữ liệu đầu vào</h2>
                  <p className="mt-1 text-sm text-slate-500">Kéo thả file hoặc bấm chọn từ máy tính.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={startGrading}
                    disabled={isGrading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isGrading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {isGrading ? 'Đang chấm...' : 'Bắt đầu chấm điểm'}
                  </button>
                  <a
                    href={downloadUrl || undefined}
                    download={downloadFileName}
                    aria-disabled={!downloadUrl}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium text-white shadow ${
                      downloadUrl ? 'bg-orange-500' : 'pointer-events-none bg-orange-300'
                    }`}
                  >
                    <Download className="h-4 w-4" /> Tải file tổng hợp điểm đã chấm
                  </a>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DropBox
                  title={rosterFile ? rosterFile.name : 'Excel danh sách lớp'}
                  subtitle=".xlsx / .xls"
                  accent="blue"
                  icon={<FileSpreadsheet className="h-7 w-7" />}
                  onClick={() => rosterInputRef.current?.click()}
                  onFiles={handleRoster}
                />
                <DropBox
                  title={essayFiles.length ? `${essayFiles.length} bài luận đã nạp` : 'Bài luận sinh viên'}
                  subtitle="PDF / DOCX / TXT / MD"
                  accent="orange"
                  icon={<Upload className="h-7 w-7" />}
                  onClick={() => essayInputRef.current?.click()}
                  onFiles={handleEssays}
                />
              </div>

              <input ref={rosterInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleRoster(e.target.files)} />
              <input
                ref={essayInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                multiple
                className="hidden"
                onChange={(e) => handleEssays(e.target.files)}
              />
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg backdrop-blur">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Trạng thái chấm điểm</h2>
                  <p className="mt-1 text-sm text-slate-500">Theo dõi log hệ thống và các chỉ số đầu ra.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={downloadUrl || undefined}
                    download={downloadFileName}
                    aria-disabled={!downloadUrl}
                    className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium shadow-sm ${
                      downloadUrl
                        ? 'border-slate-200 bg-white text-slate-700'
                        : 'pointer-events-none border-slate-200 bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Download className="h-4 w-4" /> Tải file tổng hợp điểm đã chấm
                  </a>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                    {summary?.processed ?? 0} / {essayFiles.length || 0} processed
                  </span>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {logMessage}
              </div>

              {error && (
                <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MiniMetric icon={<ShieldAlert className="h-4 w-4" />} label="AI review" value={String(stats.aiFlagged)} tone="orange" />
                <MiniMetric icon={<AlertTriangle className="h-4 w-4" />} label="Under 1500" value={String(stats.under1500)} tone="blue" />
                <MiniMetric icon={<FileText className="h-4 w-4" />} label="Manual review" value={String(stats.review)} tone="slate" />
                <MiniMetric icon={<CheckCircle2 className="h-4 w-4" />} label="Match tốt" value={String(stats.matched)} tone="emerald" />
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-medium">File bài luận</th>
                      <th className="px-4 py-3 font-medium">Sinh viên</th>
                      <th className="px-4 py-3 font-medium">Điểm</th>
                      <th className="px-4 py-3 font-medium">Cờ cảnh báo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.length ? (
                      previewRows.map((item) => (
                        <tr key={`${item.fileName}_${item.mssv}`} className="border-t border-slate-100">
                          <td className="px-4 py-3 text-slate-700">{item.fileName}</td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-medium">{item.fullName || 'Cần kiểm tra thủ công'}</div>
                            <div className="text-xs text-slate-500">{item.mssv || '—'}</div>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">{item.total.toFixed(1)}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <StatusBadge type={item.status === 'Matched' ? 'success' : 'warning'}>{item.status}</StatusBadge>
                            <div className="mt-1 text-xs text-slate-500">
                              {item.aiFlag !== 'Không' ? `${item.aiFlag} · ` : ''}
                              {item.under1500 === 'Có' ? 'Under 1500' : '—'}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                          Chưa có kết quả. Hãy nạp file và chạy chấm điểm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg backdrop-blur">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Danh sách bài luận đã nhận</h2>
                  <p className="mt-1 text-sm text-slate-500">Có thể loại bỏ file không cần thiết trước khi chấm.</p>
                </div>
                <div className="text-sm text-slate-500">{essayFiles.length} file</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {essayFiles.length ? (
                  essayFiles.map((file) => (
                    <div key={`${file.name}_${file.size}`} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-900">{file.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{Math.round(file.size / 1024)} KB</div>
                      </div>
                      <button
                        onClick={() => removeEssay(file.name, file.size)}
                        className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Chưa có file bài luận nào được nạp.
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg backdrop-blur">
              <h2 className="text-xl font-semibold">Rubrik chấm điểm</h2>
              <div className="mt-4 space-y-3">
                {RUBRIC.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {item.key} {item.label}
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                        {item.score}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg backdrop-blur">
              <h2 className="text-xl font-semibold">Nguyên tắc chấm</h2>
              <div className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
                <Rule>Chỉ dùng bước điểm 0.5 cho từng barem.</Rule>
                <Rule>Mức sàn bài hợp lệ là 7.0; chỉ bài thật sự xuất sắc mới đạt 9.0–10.0.</Rule>
                <Rule>Bài dưới 1.500 từ được gắn cờ riêng, không tự động trừ điểm.</Rule>
                <Rule>Cờ nghi AI chỉ phục vụ rà soát lại, không phải kết luận tuyệt đối.</Rule>
                <Rule>Trường hợp trùng MSSV hoặc đối sánh mơ hồ sẽ được đưa vào diện review thủ công.</Rule>
              </div>
            </section>

            <section className="rounded-3xl border border-white/60 bg-white/85 p-6 shadow-lg backdrop-blur">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold">Cấu trúc đầu ra vào Excel</h2>
                <a
                  href={downloadUrl || undefined}
                  download={downloadFileName}
                  aria-disabled={!downloadUrl}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-medium text-white shadow ${
                    downloadUrl ? 'bg-slate-900' : 'pointer-events-none bg-slate-300'
                  }`}
                >
                  <Download className="h-4 w-4" /> Tải file tổng hợp điểm đã chấm
                </a>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {OUTPUT_COLUMNS.map((col) => (
                  <span key={col} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    {col}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function DropBox({
  title,
  subtitle,
  accent,
  icon,
  onClick,
  onFiles
}: {
  title: string;
  subtitle: string;
  accent: 'blue' | 'orange';
  icon: React.ReactNode;
  onClick: () => void;
  onFiles: (files: FileList | null) => void;
}) {
  const styles = accent === 'blue' ? 'border-blue-200 bg-blue-50/70 text-blue-700' : 'border-orange-200 bg-orange-50/70 text-orange-700';

  return (
    <div
      onClick={onClick}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        onFiles(e.dataTransfer.files);
      }}
      className={`cursor-pointer rounded-3xl border-2 border-dashed p-8 text-center transition hover:shadow-md ${styles}`}
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm">{icon}</div>
      <div className="text-base font-semibold">{title}</div>
      <div className="mt-2 text-sm opacity-80">{subtitle}</div>
    </div>
  );
}

function StatusBadge({ children, type }: { children: React.ReactNode; type: 'success' | 'warning' }) {
  const styles = type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700';
  return <span className={`rounded-full px-3 py-1 text-xs font-medium ${styles}`}>{children}</span>;
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-slate-50 p-3">
      <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
      <div>{children}</div>
    </div>
  );
}

function MiniMetric({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'orange' | 'blue' | 'slate' | 'emerald';
}) {
  const map: Record<string, string> = {
    orange: 'from-orange-500/10 to-orange-100 text-orange-700',
    blue: 'from-blue-500/10 to-blue-100 text-blue-700',
    slate: 'from-slate-500/10 to-slate-100 text-slate-700',
    emerald: 'from-emerald-500/10 to-emerald-100 text-emerald-700'
  };

  return (
    <div className={`rounded-2xl bg-gradient-to-br ${map[tone]} p-4`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Design Thinking Auto Grader',
  description: 'Tự động chấm bài luận Design Thinking và xuất file Excel tổng hợp điểm.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}

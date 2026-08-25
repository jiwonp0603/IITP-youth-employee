import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2026년 청년고용 의무채용 현황 확인",
  description: "수행 중인 과제의 청년 의무채용 현황을 확인하는 서비스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

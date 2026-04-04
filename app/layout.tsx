import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "유압브레이커 타격 분석기",
  description: "Hydraulic breaker impact sound analyzer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}

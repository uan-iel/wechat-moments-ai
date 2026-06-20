import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "WeChat Moments AI",
  description: "朋友圈智能营销 AI Agent"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "多 Agent Runner",
  description: "发起同一任务到多个 Agent 运行，并集中查看最终报告与运行过程。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <div className="toolbar" style={{ justifyContent: "space-between", marginBottom: 16 }}>
            <Link href="/" className="eyebrow">
              多 Agent Runner
            </Link>
            <div className="subtle">报告优先的 Agent 运行台</div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}

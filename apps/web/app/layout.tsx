import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import { Sparkles } from "lucide-react";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "多 Agent Runner",
  description: "发起同一任务到多个 Agent 运行，并集中查看最终报告与运行过程。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${sans.variable} ${display.variable}`}>
        <div className="app-shell">
          <header className="topbar">
            <Link href="/" className="inline-flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-strong)]">
                <Sparkles className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold tracking-[-0.03em]">Harness Runner</div>
                <div className="text-xs text-[color:var(--color-muted-foreground)]">Report-first AI workspace</div>
              </div>
            </Link>
            <div className="hidden text-sm text-[color:var(--color-muted-foreground)] md:block">
              一个输入框发起，多 Runner 回收结果
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}

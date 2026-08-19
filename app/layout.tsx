import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "澜盾防水 · 经销商工作台",
  description: "清晰掌握每家门店的铺货产品与拜访进度。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}

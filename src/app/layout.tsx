import "./globals.css";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/theme-toggle";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}

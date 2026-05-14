import "./globals.css";
import type { ReactNode } from "react";
import Script from "next/script";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive">
          {`
            try {
              var savedTheme = window.localStorage.getItem("followthescheme-theme");
              var theme = savedTheme === "dark" || savedTheme === "light"
                ? savedTheme
                : "light";
              document.documentElement.dataset.theme = theme;
            } catch (_) {}
          `}
        </Script>
        {children}
      </body>
    </html>
  );
}

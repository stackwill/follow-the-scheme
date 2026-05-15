import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

export const metadata: Metadata = {
  title: {
    default: "IHateGCSE",
    template: "%s | IHateGCSE",
  },
  applicationName: "IHateGCSE",
};

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

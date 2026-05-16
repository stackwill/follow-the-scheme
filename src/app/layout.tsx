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
  const plausibleDomain = process.env.PLAUSIBLE_DOMAIN;
  const plausibleScriptSrc = process.env.PLAUSIBLE_SCRIPT_SRC ?? "https://plausible.io/js/script.js";

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
        {plausibleDomain ? (
          <>
            <Script id="plausible-queue" strategy="beforeInteractive">
              {`
                window.plausible = window.plausible || function() {
                  (window.plausible.q = window.plausible.q || []).push(arguments);
                };
              `}
            </Script>
            <Script
              data-domain={plausibleDomain}
              defer
              src={plausibleScriptSrc}
              strategy="afterInteractive"
            />
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}

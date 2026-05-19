import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Catalyst — Corporate Detective Dashboard",
  description:
    "Predict market-moving catalysts before they hit the tape. Tender intelligence + real-time SEBI disclosures for Indian listed companies.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex flex-1 flex-col">
              <Topbar />
              <main className="flex-1 overflow-x-hidden">{children}</main>
            </div>
          </div>
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}

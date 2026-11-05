import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "AdAstra — Better, together.",
  description:
    "A little accountability. A lot of possibility. Your local space for shared ambition.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

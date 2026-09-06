import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./skillbridge-ui.css";
import "./profile.css";
import "./escrow.css";
import { LanguageProvider } from "./components/i18n";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "vietnamese"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "vietnamese"],
});

const title = "Bài làm tốt không nên biến mất.";
const description =
  "SkillBridge Vietnam biến sản phẩm sinh viên thành bằng chứng kỹ năng có thể kiểm chứng để mở khóa cơ hội từ trường học và doanh nghiệp.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const imageUrl = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: `${title} | SkillBridge Vietnam`,
      template: "%s | SkillBridge Vietnam",
    },
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: "SkillBridge Vietnam",
      title,
      description,
      url: metadataBase.toString(),
      images: [
        {
          url: imageUrl,
          width: 1733,
          height: 907,
          alt: "SkillBridge Vietnam — Evidence to credential to opportunity",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}

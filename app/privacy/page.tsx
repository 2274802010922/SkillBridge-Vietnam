import type { Metadata } from "next";
import { LocalizedLegalPage } from "../../frontend/features/legal/localized-legal-page";
export const metadata: Metadata = { title: "Chính sách dữ liệu" };
export default function PrivacyPage() { return <LocalizedLegalPage kind="privacy" />; }

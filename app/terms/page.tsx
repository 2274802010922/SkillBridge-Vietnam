import type { Metadata } from "next";
import { LocalizedLegalPage } from "../../frontend/features/legal/localized-legal-page";
export const metadata: Metadata = { title: "Điều khoản sử dụng" };
export default function TermsPage() { return <LocalizedLegalPage kind="terms" />; }

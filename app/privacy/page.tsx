import type { Metadata } from "next";
import { LocalizedLegalPage } from "../components/localized-legal-page";
export const metadata: Metadata = { title: "Chính sách dữ liệu" };
export default function PrivacyPage() { return <LocalizedLegalPage kind="privacy" />; }

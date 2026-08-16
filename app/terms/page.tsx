import type { Metadata } from "next";
import { LocalizedLegalPage } from "../components/localized-legal-page";
export const metadata: Metadata = { title: "Điều khoản sử dụng" };
export default function TermsPage() { return <LocalizedLegalPage kind="terms" />; }

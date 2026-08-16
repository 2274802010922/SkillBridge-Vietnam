import type { Metadata } from "next";
import { LocalizedLegalPage } from "../components/localized-legal-page";
export const metadata: Metadata = { title: "Công bố rủi ro" };
export default function RiskPage() { return <LocalizedLegalPage kind="risk" />; }

import type { Metadata } from "next";
import { LocalizedLegalPage } from "../../frontend/features/legal/localized-legal-page";
export const metadata: Metadata = { title: "Công bố rủi ro" };
export default function RiskPage() { return <LocalizedLegalPage kind="risk" />; }

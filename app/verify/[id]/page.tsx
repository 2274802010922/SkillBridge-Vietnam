import { VerificationPageCopy } from "../../../frontend/features/verification/verification-page-copy";

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VerificationPageCopy id={id} />;
}

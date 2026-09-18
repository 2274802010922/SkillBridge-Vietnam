import type { Metadata } from "next";
import { HomeCopy } from "../frontend/features/landing/home-copy";

export const metadata: Metadata = { title: "SkillBridge Vietnam — Proof-of-Skill trên Solana Devnet", description: "SkillBridge biến bài làm thành bằng chứng kỹ năng: AI hỗ trợ, con người phê duyệt và Solana Devnet giúp kiểm chứng." };
export default function Home() { return <HomeCopy />; }

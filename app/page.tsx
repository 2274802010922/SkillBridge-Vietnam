import type { Metadata } from "next";
import { HomeCopy } from "./components/home-copy";

export const metadata: Metadata = { title: "Bằng chứng kỹ năng mở khóa cơ hội", description: "SkillBridge biến sản phẩm sinh viên thành bằng chứng kỹ năng có thể kiểm chứng." };
export default function Home() { return <HomeCopy />; }

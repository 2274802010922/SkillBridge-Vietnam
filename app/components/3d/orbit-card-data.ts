export interface OrbitNodeItem {
  id: string;
  index: string;
  name: string;
  subtitleVi: string;
  subtitleEn: string;
  categoryVi: string;
  categoryEn: string;
  image: string;
  imageFit: "contain" | "cover";
  tagVi: string;
  tagEn: string;
  accentColor: string;
  href?: string;
  external?: boolean;
}

export const ORBIT_NODES: OrbitNodeItem[] = [
  {
    id: "solana",
    index: "01",
    name: "SOLANA DEVNET",
    subtitleVi: "Xác minh trên chuỗi nhanh & chi phí thấp",
    subtitleEn: "High-speed & low-cost on-chain verification",
    categoryVi: "HẠ TẦNG XÁC MINH",
    categoryEn: "VERIFICATION LAYER",
    image: "/brands/solana-wordmark.png",
    imageFit: "contain",
    tagVi: "Solana Devnet",
    tagEn: "Solana Devnet",
    accentColor: "#14F195",
    href: "https://solana.com",
    external: true,
  },
  {
    id: "vlu",
    index: "02",
    name: "TRƯỜNG ĐẠI HỌC VĂN LANG",
    subtitleVi: "Đối tác thí điểm & nguồn sinh viên năng động",
    subtitleEn: "Pilot university partner & talent ecosystem",
    categoryVi: "ĐỐI TÁC HỌC THUẬT",
    categoryEn: "ACADEMIC PARTNER",
    image: "/brands/vlu-wordmark.jpg",
    imageFit: "contain",
    tagVi: "VLU Pilot",
    tagEn: "VLU Pilot",
    accentColor: "#E31B23",
    href: "https://vlu.edu.vn",
    external: true,
  },
  {
    id: "unihackfest",
    index: "03",
    name: "UNIHACKFEST 2026",
    subtitleVi: "Sân chơi kiến tạo sản phẩm thật cho sinh viên",
    subtitleEn: "Real-world builder arena for student talent",
    categoryVi: "SỰ KIỆN & THỬ THÁCH",
    categoryEn: "CHALLENGE ARENA",
    image: "/brands/unihackfest-wordmark.png",
    imageFit: "contain",
    tagVi: "UniHackFest",
    tagEn: "UniHackFest",
    accentColor: "#7B2CBF",
    href: "#flow",
  },
  {
    id: "corelia",
    index: "04",
    name: "CORELIA ACADEMY",
    subtitleVi: "Đào tạo & ươm mầm tài năng Web3 Việt Nam",
    subtitleEn: "Web3 training & developer incubator Vietnam",
    categoryVi: "HỌC VIỆN ĐÀO TẠO",
    categoryEn: "INCUBATOR",
    image: "/brands/corelia-academy.png",
    imageFit: "cover",
    tagVi: "Web3 Academy",
    tagEn: "Web3 Academy",
    accentColor: "#00B4D8",
    href: "https://corelia.academy",
    external: true,
  },
  {
    id: "usdc",
    index: "05",
    name: "USDC PAYOUT",
    subtitleVi: "Thanh toán thưởng non-custodial trực tiếp vào ví",
    subtitleEn: "Direct non-custodial wallet payouts",
    categoryVi: "THANH TOÁN MINH BẠCH",
    categoryEn: "INSTANT PAYOUTS",
    image: "/brands/usdc-symbol.png",
    imageFit: "contain",
    tagVi: "Non-custodial USDC",
    tagEn: "Non-custodial USDC",
    accentColor: "#2775CA",
    href: "#product",
  },
  {
    id: "phantom",
    index: "06",
    name: "PHANTOM WALLET",
    subtitleVi: "Đăng nhập an toàn & xác thực chữ ký SIWS",
    subtitleEn: "Secure SIWS wallet authentication",
    categoryVi: "DANH TÍNH KỸ THUẬT SỐ",
    categoryEn: "WALLET IDENTITY",
    image: "/brands/phantom.svg",
    imageFit: "contain",
    tagVi: "Phantom Auth",
    tagEn: "Phantom Auth",
    accentColor: "#AB9FF2",
    href: "/auth",
  },
  {
    id: "solflare",
    index: "07",
    name: "SOLFLARE WALLET",
    subtitleVi: "Ví Solana thay thế tương thích Web3 hoàn chỉnh",
    subtitleEn: "Alternative full-featured Web3 Solana wallet",
    categoryVi: "DANH TÍNH KỸ THUẬT SỐ",
    categoryEn: "WALLET IDENTITY",
    image: "/brands/solflare.svg",
    imageFit: "contain",
    tagVi: "Solflare Auth",
    tagEn: "Solflare Auth",
    accentColor: "#FC7227",
    href: "/auth",
  },
];

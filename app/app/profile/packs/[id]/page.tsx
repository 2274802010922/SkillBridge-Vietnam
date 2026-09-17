import { PortfolioWorkspace } from "@/frontend/features/portfolios/portfolio-workspace";
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PortfolioWorkspace id={id}/>;}

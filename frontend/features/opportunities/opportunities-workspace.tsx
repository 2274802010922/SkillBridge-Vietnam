"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useState} from "react";
import {useLanguage} from "../../i18n/i18n";
import {ContentSkeleton} from "../../components/feedback/loading-ui";
import styles from "./opportunities.module.css";
type Membership={organization_id:string;organization_name:string;organization_kind:string;role:string};
type Opportunity={id:string;title:string;description:string;organization_name:string;required_issuer_name:string;minimum_score:string;status:string;closes_at:string|null;can_manage:number};
export function OpportunitiesWorkspace({memberships,universities}:{memberships:Membership[];universities:{id:string;name:string}[]}){
 const {locale}=useLanguage(),vi=locale==="vi";const router=useRouter();
 const businesses=memberships.filter(m=>m.organization_kind==="business"&&["business_admin","challenge_manager"].includes(m.role));
 const [items,setItems]=useState<Opportunity[]|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [org,setOrg]=useState(businesses[0]?.organization_id||""),[issuer,setIssuer]=useState(universities[0]?.id||"");
 const [title,setTitle]=useState(""),[description,setDescription]=useState(""),[requirements,setRequirements]=useState(""),[score,setScore]=useState(80),[deadline,setDeadline]=useState("");
 useEffect(()=>{const abort=new AbortController();fetch("/api/opportunities",{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error();setItems(((await r.json()) as {opportunities:Opportunity[]}).opportunities);}).catch(()=>{if(!abort.signal.aborted)setNotice(vi?"Không tải được cơ hội. Hãy tải lại trang.":"Unable to load opportunities. Reload the page.");});return()=>abort.abort();},[vi]);
 async function create(e:React.FormEvent){e.preventDefault();setBusy(true);setNotice("");try{const r=await fetch("/api/opportunities",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({organizationId:org,requiredIssuerOrganizationId:issuer,title,description,requirements,minimumScore:score,closesAt:deadline?new Date(deadline).toISOString():undefined,draft:true})});const d=await r.json() as {error?:string;opportunity?:{id:string}};if(!r.ok)throw Error(d.error);router.push("/app/opportunities/"+d.opportunity!.id);}catch(e){setNotice(e instanceof Error?e.message:"Error");}finally{setBusy(false);}}
 return <div id="workspace-main" tabIndex={-1} className={"workspace-product-content "+styles.workspace}><h1>{vi?"Cơ hội từ kỹ năng đã chứng minh":"Opportunities for proven skills"}</h1><p>{vi?"Sử dụng chứng nhận còn hiệu lực để kiểm tra điều kiện và gửi hồ sơ đến doanh nghiệp.":"Use an active credential to check eligibility and apply to a business."}</p>
 {businesses.length>0&&<details className="app-panel"><summary>{vi?"Tạo cơ hội mới":"Create an opportunity"}</summary><form onSubmit={create} className={styles.form}>
 <label>{vi?"Doanh nghiệp":"Business"}<select value={org} onChange={e=>setOrg(e.target.value)}>{businesses.map(m=><option key={m.organization_id} value={m.organization_id}>{m.organization_name}</option>)}</select></label>
 <label>{vi?"Chấp nhận chứng nhận từ":"Accept credentials from"}<select required value={issuer} onChange={e=>setIssuer(e.target.value)}>{universities.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
 {!universities.length&&<p>{vi?"Đơn vị phát hành cần khởi tạo chứng nhận trước.":"An issuer must initialize credentials first."}</p>}
 <label>{vi?"Tên cơ hội":"Title"}<input required minLength={4} maxLength={200} value={title} onChange={e=>setTitle(e.target.value)}/></label>
 <label>{vi?"Mô tả":"Description"}<textarea required minLength={20} maxLength={8000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
 <label>{vi?"Yêu cầu công việc":"Requirements"}<textarea maxLength={8000} value={requirements} onChange={e=>setRequirements(e.target.value)}/></label>
 <label>{vi?"Điểm tối thiểu":"Minimum score"}<input type="number" min={0} max={100} value={score} onChange={e=>setScore(Number(e.target.value))}/></label>
 <label>{vi?"Hạn ứng tuyển (tùy chọn)":"Deadline (optional)"}<input type="datetime-local" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label>
 <button className="button button-primary" disabled={busy||!issuer}>{busy?(vi?"Đang lưu…":"Saving…"):(vi?"Lưu bản nháp":"Save draft")}</button></form></details>}
 {notice&&<p role="alert">{notice}</p>}{!items&&!notice?<ContentSkeleton delayed variant="list"/>:<div className={styles.cards}>{items?.length===0&&<p>{vi?"Chưa có cơ hội.":"No opportunities yet."}</p>}{items?.map(op=><article className="app-panel" key={op.id}><small>{op.organization_name}</small><h2>{op.title}</h2><p>{op.description}</p><p>{vi?"Chứng nhận từ: ":"Credential issuer: "}{op.required_issuer_name} · {op.minimum_score}/100</p><p>{op.status==="draft"?(vi?"Bản nháp":"Draft"):op.status==="active"?(vi?"Đang nhận hồ sơ":"Open"):(vi?"Đã đóng / chưa sẵn sàng":"Closed / not ready")}</p>{op.closes_at&&<p>{new Date(op.closes_at).toLocaleString(locale)}</p>}<Link className="button button-primary" href={"/app/opportunities/"+op.id}>{op.can_manage?(vi?"Quản lý và xem ứng viên":"Manage applicants"):(vi?"Xem và ứng tuyển":"View and apply")}</Link></article>)}</div>}</div>;
}

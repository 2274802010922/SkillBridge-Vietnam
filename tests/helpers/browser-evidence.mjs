// Optional browser QA with a separately installed Playwright runtime; no production dependency.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||"playwright");
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH});
await mkdir(".data/evidence-ui",{recursive:true});
const errors=[];
try{
  const context=await browser.newContext(),page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  for(const locale of ["vi","en"]){
    await context.addInitScript(value=>localStorage.setItem("skillbridge-locale",value),locale);
    await page.goto("http://localhost:3343/__qa/student");
    await page.goto(page.url().replace(":3343",":3342"));
    await page.getByRole("heading",{name:locale==="vi"?"Chuẩn bị hồ sơ của bạn":"Prepare your portfolio"}).waitFor();
    await page.getByRole("button",{name:locale==="vi"?"Lưu phiên bản":"Save version",exact:true}).waitFor();
    for(const width of [375,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
      assert.equal(overflow,false,`Portfolio horizontal overflow ${locale} ${width}`);
      await page.screenshot({path:`.data/evidence-ui/portfolio-${locale}-${width}.png`,fullPage:true});
    }
    const aiConsent=page.getByLabel(locale==="vi"?"Tôi đồng ý gửi các nguồn này cho OpenRouter để tạo bản nháp.":"I consent to sending these sources to OpenRouter for a draft.");
    await aiConsent.check();
    await page.getByRole("button",{name:locale==="vi"?"Tạo bản nháp có nguồn":"Generate grounded draft",exact:true}).click();
    await page.getByText("QA draft based on the selected source",{exact:true}).waitFor();
    await page.evaluate(()=>localStorage.setItem("skillbridge-role","business"));
    await page.goto("http://localhost:3343/__qa/employer");
    await page.goto(page.url().replace(":3343",":3342"));
    await page.getByRole("heading",{name:locale==="vi"?"So sánh bằng chứng ứng viên":"Compare applicant evidence",exact:true}).waitFor();
    await page.getByRole("checkbox").nth(0).check();await page.getByRole("checkbox").nth(1).check();
    await page.getByRole("button",{name:locale==="vi"?"So sánh hồ sơ đã chọn":"Compare selected applicants",exact:true}).click();
    await page.getByText(locale==="vi"?"Lý do / ghi chú nội bộ":"Internal reasoning / note",{exact:true}).first().waitFor();
    for(const width of [375,768,1024,1440]){
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Comparison horizontal overflow ${locale} ${width}`);
      await page.screenshot({path:`.data/evidence-ui/comparison-${locale}-${width}.png`,fullPage:true});
    }
  }
  assert.deepEqual(errors,[]);
  console.log("Browser QA passed: VI/EN, portfolio and comparison at 375/768/1024/1440; AI fixture click; no page errors. Screenshots: .data/evidence-ui.");
}finally{await browser.close();}

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root=process.cwd();
const problems=[];
function walk(dir){
  if(!fs.existsSync(dir))return [];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    if(["node_modules","target",".next",".data"].includes(entry.name))return [];
    const item=path.join(dir,entry.name);
    return entry.isDirectory()?walk(item):[item];
  });
}
const relative=f=>path.relative(root,f).replaceAll("\\","/");
const configFile=ts.readConfigFile(path.join(root,"tsconfig.json"),ts.sys.readFile);
if(configFile.error)throw new Error("Unable to read tsconfig");
const {options}=ts.parseJsonConfigFileContent(configFile.config,ts.sys,root);
const source=["app","frontend","backend","solana/client","solana/server","shared","tools/claim-verifier"].flatMap(d=>walk(path.join(root,d))).filter(f=>/\.(ts|tsx)$/.test(f));
for(const file of source){
  const parsed=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
  for(const statement of parsed.statements){
    if(!ts.isImportDeclaration(statement)&&!ts.isExportDeclaration(statement))continue;
    const specifier=statement.moduleSpecifier;
    if(!specifier||!ts.isStringLiteral(specifier))continue;
    const name=specifier.text;
    if(!name.startsWith(".")&&!name.startsWith("@/"))continue;
    if(name.endsWith(".css")){
      const cssPath=name.startsWith("@/")?path.join(root,name.slice(2)):path.resolve(path.dirname(file),name);
      if(!fs.existsSync(cssPath))problems.push(relative(file)+": missing stylesheet "+name);
      continue;
    }
    const resolved=ts.resolveModuleName(name,file,options,ts.sys).resolvedModule;
    if(!resolved){problems.push(relative(file)+": unresolved "+name);continue;}
    const clause=ts.isImportDeclaration(statement)?statement.importClause:null;
    const typeOnly=statement.isTypeOnly||clause?.isTypeOnly||
      (clause&&!clause.name&&clause.namedBindings&&ts.isNamedImports(clause.namedBindings)&&clause.namedBindings.elements.every(e=>e.isTypeOnly));
    const from=relative(file),to=relative(resolved.resolvedFileName);
    if(!typeOnly&&from.startsWith("frontend/")&&(to.startsWith("backend/")||to.startsWith("solana/server/")))
      problems.push(from+": runtime import crosses server boundary: "+to);
    if(!typeOnly&&from.startsWith("shared/")&&(to.startsWith("backend/")||to.startsWith("solana/server/")))
      problems.push(from+": shared module imports server code: "+to);
  }
}
// Small persistent-context invariants; factual freshness still needs human review.
const harnessFiles=[
  "AGENTS.md","solana/AGENTS.md","docs/README.md",
  "docs/harness/README.md",
  "docs/harness/context/CURRENT_STATE.md","docs/harness/context/HANDOFF.md",
  "docs/harness/plans/README.md","docs/harness/plans/PLAN_TEMPLATE.md",
  "docs/harness/decisions/README.md","docs/harness/decisions/ADR_TEMPLATE.md",
];
for(const file of harnessFiles){
  const target=path.join(root,file);
  if(!fs.existsSync(target)||!fs.statSync(target).isFile()||!fs.readFileSync(target,"utf8").trim())
    problems.push("Missing or empty harness file: "+file);
}
const planNames=new Set();
for(const [folder,allowed] of [["active",["active","blocked"]],["completed",["completed","cancelled"]]]){
  const dir=path.join(root,"docs/harness/plans",folder);
  if(!fs.existsSync(dir)||!fs.statSync(dir).isDirectory()){
    problems.push("Missing plan directory: docs/harness/plans/"+folder);continue;
  }
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name===".gitkeep"&&entry.isFile())continue;
    const file=path.join(dir,entry.name);
    if(!entry.isFile()||!entry.name.endsWith(".md")){
      problems.push(relative(file)+": plans must be flat Markdown files");continue;
    }
    const name=entry.name.toLowerCase();
    if(planNames.has(name))problems.push("Duplicate active/completed plan: "+entry.name);
    planNames.add(name);
    const statuses=[...fs.readFileSync(file,"utf8").matchAll(/^Status:[\t ]*([^\r\n]+)\r?$/gm)];
    if(statuses.length!==1||!allowed.includes(statuses[0][1].trim()))
      problems.push(relative(file)+": expected one Status: "+allowed.join(" or "));
  }
}
const markdown=["AGENTS.md","README.md","README.vi.md","CONTRIBUTING.md","CHANGELOG.md",
  ...["docs","frontend","backend","solana","shared","tests","tooling"].flatMap(d=>walk(d)).filter(f=>f.endsWith(".md")&&!f.includes("agent-skills"))];
for(const file of markdown){
  if(!fs.existsSync(file)){problems.push("Missing "+file);continue;}
  const text=fs.readFileSync(file,"utf8");
  for(const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
    const target=match[1];
    if(/^(https?:|mailto:|#|data:)/.test(target))continue;
    const local=decodeURIComponent(target.split("#")[0]);
    if(!fs.existsSync(path.resolve(path.dirname(file),local)))problems.push(file+": broken link "+target);
  }
}
if(problems.length){console.error(problems.join("\n"));process.exitCode=1;}
else console.log("Repository checks passed: "+source.length+" source modules; "+markdown.length+" documentation files.");

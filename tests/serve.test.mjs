import {spawn} from "node:child_process";
import {mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,basename,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {connect} from "node:net";

const HERE=dirname(fileURLToPath(import.meta.url));
const sandbox=mkdtempSync(join(tmpdir(),"serve-test-"));
const sibling=sandbox+"-rollblock-notes";
mkdirSync(sibling);
writeFileSync(join(sibling,"secret.txt"),"TOPSECRET");
writeFileSync(join(sandbox,"index.html"),"<html>ok</html>");
copyFileSync(join(HERE,"..","serve.js"),join(sandbox,"serve.js"));
const srv=spawn(process.execPath,["serve.js"],{cwd:sandbox,env:{...process.env,PORT:"0"},stdio:["ignore","pipe","pipe"]});
let port=null;
srv.stdout.on("data",d=>{ const m=String(d).match(/:(\d+)/); if(m&&!port)port=m[1]; });
async function get(p){ try{ return await fetch(`http://127.0.0.1:${port}${p}`);}catch(e){return {status:-1}} }
function rawGet(p){ return new Promise(resolve=>{
  const s=connect(port,"127.0.0.1",()=>{ s.write(`GET ${p} HTTP/1.1\r\nHost: t\r\nConnection: close\r\n\r\n`); });
  let buf="";
  s.on("data",d=>buf+=String(d));
  s.on("error",()=>resolve({status:-1,body:""}));
  s.on("end",()=>{ const m=buf.match(/HTTP\/1\.[01] (\d{3})/); resolve({status:m?+m[1]:-1,body:buf.split("\r\n\r\n")[1]??""}); });
});}
{
  const t0=Date.now();
  while(!(port&&(await get("/index.html")).status===200)){
    if(Date.now()-t0>10000) throw new Error(`server never reported a usable bound port (last candidate: ${port})`);
    await new Promise(r=>setTimeout(r,50));
    if(!port)continue;
  }
}

let pass=0,fail=0;
const check=(n,c,d)=>{c?pass++:fail++;console.log((c?"  PASS ":"  FAIL ")+n+(d?" -> "+d:""));}

check("serves index.html",(await get("/index.html")).status===200);
check("GET / serves index.html",(await get("/")).status===200);
check("rejects encoded parent traversal",(await rawGet("/%2e%2e/AGENTS.md")).status===403);
check("rejects encoded sibling-prefix dir",(await rawGet(`/%2e%2e/${basename(sibling)}/secret.txt`)).status===403);
{
  const r=await rawGet(`/../${basename(sibling)}/secret.txt`);
  check("rejects raw literal-dot sibling traversal (no secret leaked)",r.status===403&&!r.body.includes("TOPSECRET"),`${r.status}`);
}
check("400 on malformed percent-encoding",(await get("/%zz")).status===400);
{
  const r=await rawGet("/%2e"); // decodes to "/." -> resolves to ROOT itself
  check("ROOT-itself request is 404 (not 403, no listing)",r.status===404,r.status+"");
}
check("no wildcard CORS header",!((await get("/index.html")).headers.get("access-control-allow-origin")));

// await child exit before rmSync: killing and immediately deleting the cwd
// raced the process still holding sandbox paths (flaky EBUSY/ENOENT)
srv.kill();
await new Promise(resolve=>{
  const done=()=>resolve();
  srv.once("exit",done);
  setTimeout(()=>{ srv.removeListener("exit",done); resolve(); },2000);
 });
rmSync(sandbox,{recursive:true,force:true}); rmSync(sibling,{recursive:true,force:true});
console.log(fail? "SERVE FAIL":"SERVE OK");
process.exit(fail?1:0);

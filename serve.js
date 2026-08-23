/* Minimal, safe, zero-dep static file server for native ES modules.
   Usage: `node serve.js` or `npm start` → http://127.0.0.1:8080/index.html
   Binds loopback only; PORT env overrides (0 = ephemeral, printed on boot). */
import http from "http";
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const PORT=process.env.PORT||8080;
const ROOT=__dirname;

const MIME={
  ".html":"text/html; charset=utf-8",
  ".js"  :"text/javascript; charset=utf-8",
  ".mjs" :"text/javascript; charset=utf-8",
  ".json":"application/json; charset=utf-8",
  ".png" :"image/png",
  ".jpg" :"image/jpeg",
  ".jpeg":"image/jpeg",
  ".svg" :"image/svg+xml",
  ".css" :"text/css; charset=utf-8",
};

function safePath(p){
  const rel=path.relative(ROOT,path.normalize(p));
  if(rel===""||rel.startsWith("..")||path.isAbsolute(rel)) return null;
  return path.normalize(p);
}
const server=http.createServer((req,res)=>{
  let url=req.url.split("?")[0];
  if(url==="/"||url==="") url="/index.html";
  try{
    let decoded;
    try{ decoded=decodeURIComponent(url); }
    catch{ res.writeHead(400);res.end("bad request"); return; }
    const fp=safePath(path.join(ROOT,decoded));
    if(!fp){ res.writeHead(403);res.end("forbidden"); return; }
    fs.stat(fp,(err,stats)=>{
      if(err||!stats.isFile()){ res.writeHead(404);res.end("not found"); return; }
      const ext=path.extname(fp).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext]||"application/octet-stream",
        "Cache-Control":"no-cache"
      });
      fs.createReadStream(fp).on("error",()=>{ if(!res.headersSent)res.writeHead(404); res.end(); }).pipe(res);
    });
  } catch(e){ res.writeHead(500); res.end("internal"); }
});
server.listen(PORT,"127.0.0.1",()=>{
  console.log(`neo-bomberman serving ${ROOT} on http://127.0.0.1:${server.address().port}`);
});

/* Minimal, safe, zero-dep static file server for native ES modules.
   Usage: `node serve.js` or `npm start` → http://localhost:8080/index.html
   Not required for local play (double-click index.html works too if your
   browser allows file:// ES modules, which most modern ones do), but the
   recommended dev entry so module imports work everywhere. */
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

function safePath(urlPath){
  const p=path.normalize(decodeURIComponent(urlPath));
  if(!p.startsWith(ROOT)) return null;
  return p;
}
const server=http.createServer((req,res)=>{
  let url=req.url.split("?")[0];
  if(url==="/"||url==="") url="/index.html";
  try{
    const fp=safePath(path.join(ROOT, url));
    if(!fp){ res.writeHead(403);res.end("forbidden"); return; }
    fs.stat(fp,(err,stats)=>{
       if(err||!stats.isFile()){ res.writeHead(404);res.end("not found"); return; }
      const ext=path.extname(fp).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME[ext]||"application/octet-stream",
        "Cache-Control":"no-cache",
        "Access-Control-Allow-Origin":"*"
       });
      fs.createReadStream(fp).pipe(res);
      });
    } catch(e){ res.writeHead(500); res.end("internal"); }
   });
server.listen(PORT, ()=>{
  console.log(`neo-bomberman serving ${ROOT} on http://localhost:${PORT}`);
  console.log(`  open http://localhost:${PORT}/index.html in a browser`);
});

import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, basename } from "node:path";

const argv = process.argv.slice(2);
const arg = (k, d) => {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const OUT = resolve(arg("--out", "tools/bounce/out"));
const PORT = Number(arg("--port", "8081"));
mkdirSync(OUT, { recursive: true });

createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method !== "POST") return res.writeHead(405).end("POST only");
  const name = basename(decodeURIComponent(req.url || "")).replace(
    /[^a-z0-9._-]/gi,
    "",
  );
  if (!/^[a-z0-9._-]+\.wav$/i.test(name))
    return res.writeHead(400).end("bad name");
  const parts = [];
  req.on("data", (c) => parts.push(c));
  req.on("end", () => {
    const b = Buffer.concat(parts);
    writeFileSync(resolve(OUT, name), b);
    console.log(name + "  " + b.length + " bytes");
    res.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
  });
}).listen(PORT, "127.0.0.1", () =>
  console.log("bounce sink -> " + OUT + "  on http://127.0.0.1:" + PORT),
);

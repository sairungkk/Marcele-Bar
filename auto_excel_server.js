/*
  auto_excel_server.js — Bar Stock Control: local Excel mirror server
  --------------------------------------------------------------------
  The app (Bar_Stock_Control.html) keeps working exactly as before
  (localStorage is still the master data store). On every data save the
  page also builds its normal ".xlsx" export in the browser and POSTs it
  here; this server writes the bytes over Bar_Stock_Control_Auto.xlsx.

  No npm packages needed. Run with:
      node auto_excel_server.js
  or double-click  start_excel_sync.bat

  Optional env:
      PORT      server port            (default 8765)
      OUT_FILE  full path of the xlsx  (default: Bar_Stock_Control_Auto.xlsx
                                        next to this script)

  Endpoints (all CORS-enabled, local only):
      GET  /status   -> { ok, file, exists, bytes, modified }
      POST /save     -> body must be the .xlsx bytes (starts with PK..)
      OPTIONS        -> CORS preflight
*/

const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = parseInt(process.env.PORT, 10) || 8765;
const OUT_FILE = process.env.OUT_FILE
  ? path.resolve(process.env.OUT_FILE)
  : path.join(__dirname, "Bar_Stock_Control_Auto.xlsx");

const MAX_BODY = 200 * 1024 * 1024; // 200 MB safety cap

/* ---------- small helpers ---------- */

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Private-Network": "true"
  });
  res.end(body);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Excel keeps the file locked while it is open, so retry a few times.
async function writeWithRetry(buf) {
  const attempts = 8;
  for (let i = 1; i <= attempts; i++) {
    try {
      await fs.promises.writeFile(OUT_FILE, buf);
      return { ok: true };
    } catch (err) {
      const code = err && err.code;
      const locky = code === "EPERM" || code === "EACCES" || code === "EBUSY";
      if (i === attempts || !locky) return { ok: false, code: code || "ERR" };
      await sleep(500); // wait ~0.5 s and retry while the user closes Excel
    }
  }
  return { ok: false, code: "ERR" };
}

/* ---------- request handling ---------- */

const server = http.createServer(async (req, res) => {
  // CORS preflight (the page runs from file:// so it is cross-origin)
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Private-Network": "true",
      "Access-Control-Max-Age": "600"
    });
    return res.end();
  }

  // GET /status — used by the page to show connected / offline in the UI
  if (req.method === "GET" && req.url.split("?")[0] === "/status") {
    let exists = false, size = 0, modified = null;
    try {
      const st = await fs.promises.stat(OUT_FILE);
      exists = st.isFile(); size = st.size; modified = st.mtime.toISOString();
    } catch (_) { /* not created yet */ }
    return json(res, 200, {
      ok: true,
      app: "Bar Stock Control auto-Excel mirror",
      file: path.basename(OUT_FILE),
      exists,
      bytes: exists ? size : 0,
      modified
    });
  }

  // POST /save — store the .xlsx bytes the browser generated
  if (req.method === "POST" && req.url.split("?")[0] === "/save") {
    const chunks = [];
    let received = 0;
    try {
      for await (const chunk of req) {
        received += chunk.length;
        if (received > MAX_BODY) {
          json(res, 413, { ok: false, reason: "body too large" });
          return;
        }
        chunks.push(chunk);
      }
    } catch (_) {
      return json(res, 400, { ok: false, reason: "read failed" });
    }
    const buf = Buffer.concat(chunks);
    if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
      return json(res, 400, { ok: false, reason: "not an .xlsx (zip) payload" });
    }
    const written = await writeWithRetry(buf);
    if (!written.ok) {
      console.log(new Date().toISOString(),
        "- SAVE FAILED (file locked by Excel?) code=" + written.code);
      return json(res, 423, { ok: false, reason: "file locked", code: written.code });
    }
    console.log(new Date().toISOString(),
      "- saved", (buf.length / 1024).toFixed(1) + " KB ->", path.basename(OUT_FILE));
    return json(res, 200, {
      ok: true,
      file: path.basename(OUT_FILE),
      bytes: buf.length,
      at: new Date().toISOString()
    });
  }

  return json(res, 404, { ok: false, reason: "not found — use GET /status or POST /save" });
});

server.listen(PORT, HOST, () => {
  const line = "=".repeat(64);
  console.log(line);
  console.log("  Bar Stock Control — auto Excel mirror server");
  console.log(line);
  console.log("  Excel file : " + OUT_FILE);
  console.log("  Listening  : http://" + HOST + ":" + PORT);
  console.log("  Endpoints  : GET /status   |  POST /save");
  console.log("");
  console.log("  Keep this window open while using Bar_Stock_Control.html.");
  console.log("  Every save in the app rewrites the Excel file above.");
  console.log("  If the file is open in Excel the write is skipped and retried");
  console.log("  on the next save - the app itself keeps working normally.");
  console.log("  Press Ctrl+C to stop.");
  console.log(line);
});

["SIGINT", "SIGTERM"].forEach(sig =>
  process.on(sig, () => {
    console.log("\nStopping server...");
    server.close(() => process.exit(0));
  })
);

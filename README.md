# DevSkill VS Code Extension (MVP)

This MVP lets you submit the currently opened JS/TS file to the DevSkill backend for a single demo problem:
- Problem: `runtime-server-hello` – implement a tiny server that returns `{status:'ok'}` on GET /health using Node.js, Deno, or Bun.

## Commands
- DevSkill: Hello World
- DevSkill: Submit Current File (command id: `devskill.submitCurrent`)

## How to use
1. Open a JS/TS file that contains your solution (Node/Deno/Bun). Example (Node.js):
```js
const http = require('http');
http.createServer((req,res)=>{
  if(req.url === '/health'){
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok'}));
  } else { res.writeHead(404); res.end(); }
}).listen(3000);
```
2. Run the command: DevSkill: Submit Current File.
3. Pick the runtime (Node, Deno, or Bun).
4. You will see the stubbed evaluation result (passed/failed, score).

## Configuration
- `devskill.apiBase` (string): Backend base URL. Defaults to `https://devskill-backend-go.fly.dev` (change to your deployed or local URL like `http://localhost:8080`).

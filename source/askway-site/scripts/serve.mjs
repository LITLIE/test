import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteConfig } from '../site.config.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.PORT||4173);
const base=(process.env.SITE_BASE||siteConfig.base).replace(/\/$/,'');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.ttf':'font/ttf','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
createServer(async(request,response)=>{
  try{
    const requested=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    if(base&&requested==='/'){response.writeHead(302,{Location:base+'/'});response.end();return;}
    const pathname=base&&requested.startsWith(base+'/')?requested.slice(base.length):requested;
    let target=resolve(root,'.'+pathname);
    if(!target.startsWith(root+sep)&&target!==root){response.writeHead(403);response.end();return;}
    try{if((await stat(target)).isDirectory())target=resolve(target,'index.html');}
    catch{target=resolve(root,'404.html');response.statusCode=404;}
    const body=await readFile(target);
    response.setHeader('Content-Type',types[extname(target)]||'application/octet-stream');
    response.setHeader('Cache-Control','no-cache');response.end(body);
  }catch{response.writeHead(500);response.end('Preview unavailable');}
}).listen(port,'127.0.0.1',()=>console.log('AskWay preview: http://127.0.0.1:'+port+base+'/'));

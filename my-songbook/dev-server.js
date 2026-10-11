import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {dirname} from 'node:path';
import handler from './api/search.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webmanifest':'application/manifest+json','.json':'application/json'};
createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/search'){
   const query=Object.fromEntries(url.searchParams);
   res.status=(code)=>{res.statusCode=code;return res;};
   res.json=(value)=>{res.setHeader('content-type','application/json; charset=utf-8');res.end(JSON.stringify(value));return res;};
   req.query=query;
   return await handler(req,res);
  }
  const requested=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file=resolve(root,requested);
  if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403);return res.end('Forbidden');}
  if(!(await stat(file)).isFile())throw new Error('Not file');
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'});res.end(data);
 }catch(error){res.writeHead(404);res.end('Not found');}
}).listen(4173,()=>console.log('My Songbook: http://localhost:4173'));

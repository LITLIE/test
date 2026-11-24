import { build } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { siteConfig } from '../site.config.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const safe=path=>{const final=resolve(root,path);if(!final.startsWith(root+'/')&&!final.startsWith(root+'\\'))throw Error('Output must remain inside the site');return final;};
const out=safe('dist'),ssr=safe('.agent_tmp/ssr');
process.env.TEMP=safe('.agent_tmp');process.env.TMP=process.env.TEMP;
await mkdir(process.env.TEMP,{recursive:true});
const siteUrl=(process.env.SITE_URL||siteConfig.url).replace(/\/$/,'');
const base=process.env.SITE_BASE||siteConfig.base;
process.env.VITE_SITE_URL=siteUrl;process.env.SITE_BASE=base;
await build({root,build:{outDir:out,emptyOutDir:true}});
await build({root,build:{ssr:'src/entry-server.tsx',outDir:ssr,emptyOutDir:true},});
const {render}=await import(pathToFileURL(resolve(ssr,'entry-server.js')).href);
const template=await readFile(resolve(out,'index.html'),'utf8');
const pages={
  '/':['问途 AskWay · 让城市探索，自有方向','问途连接出游偏好、可行行程与现场游览。从珠海出发，让每一次城市探索，都有清晰的方向。'],
  '/product/':['产品体验 · 问途 AskWay','从说出想法到带上旅程，体验问途的规划思路和珠海交互演示。'],
  '/cooperation/':['一起探索 · 问途 AskWay','与问途共同探索城市内容共建、城市体验试点与目的地服务衔接。'],
  '/about/':['关于问途 · AskWay','从珠海的城市场景出发，探索更连贯的规划与现场体验。'],
};
for(const [path,[title,description]] of Object.entries(pages)){
  const url=siteUrl+(path==='/'?'/':path);
  const meta='<link rel="canonical" href="'+url+'"/><meta property="og:title" content="'+title+'"/><meta property="og:description" content="'+description+'"/><meta property="og:url" content="'+url+'"/><meta property="og:type" content="website"/><meta property="og:image" content="'+siteUrl+'/assets/hero.webp"/>';
  let html=template.replace(/<title>.*?<\/title>/, '<title>'+title+'</title>').replace(/<meta name="description" content="[^"]*"\s*\/>/,'<meta name="description" content="'+description+'"/>').replace('</head>',meta+'</head>').replace('<div id="root"></div>','<div id="root">'+render(path,base)+'</div>');
  if(path==='/')html=html.replace('</head>','<link rel="preload" as="image" href="'+base+'assets/hero.webp"/></head>');
  const destination=path==='/'?out:resolve(out,path.slice(1));
  await mkdir(destination,{recursive:true});await writeFile(resolve(destination,'index.html'),html);
}
await writeFile(resolve(out,'404.html'),template.replace(/<title>.*?<\/title>/,'<title>页面未找到 · 问途 AskWay</title>').replace('</head>','<meta name="robots" content="noindex"/></head>').replace('<div id="root"></div>','<div id="root">'+render('/not-found/',base)+'</div>'));
await writeFile(resolve(out,'.nojekyll'),'');
const hostname=new URL(siteUrl).hostname;
if(!hostname.endsWith('.github.io'))await writeFile(resolve(out,'CNAME'),hostname+'\n');
await writeFile(resolve(out,'robots.txt'),'User-agent: *\nAllow: /\nSitemap: '+siteUrl+'/sitemap.xml\n');
await writeFile(resolve(out,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+Object.keys(pages).map(path=>'<url><loc>'+siteUrl+path+'</loc></url>').join('')+'</urlset>');
console.log('Prerendered four pages, 404, sitemap and preserved Pages CNAME.');

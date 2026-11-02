'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'); let php=0,js=0,json=0;
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){
 if(['.git','node_modules','vendor','data','backups','dist-packages','scratch','dist'].includes(e.name)||e.name==='cms_config.php')continue;
 const p=path.join(dir,e.name);
 if(e.isDirectory())walk(p);else if(p.endsWith('.php')){execFileSync('php',['-l',p],{stdio:'pipe'});php++;}
 else if(p.endsWith('.js')||p.endsWith('.mjs')){execFileSync('node',['--check',p],{stdio:'pipe'});js++;}
 else if(p.endsWith('.json')){JSON.parse(fs.readFileSync(p,'utf8'));json++;}
}}
walk(root);console.log(`Syntax checks passed: ${php} PHP files, ${js} JavaScript files, ${json} JSON files; JSX syntax is checked by Vite build.`);

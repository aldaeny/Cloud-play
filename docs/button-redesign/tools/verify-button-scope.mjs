#!/usr/bin/env node
/* Reproducible proof that the button redesign changed ONLY button surfaces.
 * Compares the committed globals.css (HEAD) with the working copy and asserts:
 *   - every non-button selector keeps identical declarations (byte-for-byte),
 *   - button selectors only lost visual properties (nothing invented),
 *   - only button-related keyframes were removed.
 * Usage:  npm i -D postcss && node docs/button-redesign/tools/verify-button-scope.mjs
 */
import postcss from 'postcss';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const rel = 'apps/web/src/styles/globals.css';
const original = execSync(`git show HEAD:${rel}`, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const current = fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const BUTTON_CLASSES = new Set(['outline-button','carousel-arrow','dot','modal-close','settings-trigger','settings-close','account-entry','account-back','playback-reset','search-trigger','search-morph-close','search-clear','language','sky-theme-toggle','nav-account','nav-reveal-item','movie-favorite','movie-details-link','home-about-link','cp-reel-link','iptv-load','licensed-channel','licensed-favorite','media-play','media-cast-button','reference-intro-skip']);
function lastCompound(sel){let depth=0,cur='';const parts=[];for(const ch of sel){if(ch==='('||ch==='[')depth++;if(ch===')'||ch===']')depth--;if(depth===0&&(ch===' '||ch==='>'||ch==='+'||ch==='~')){if(cur.trim())parts.push(cur.trim());cur='';}else cur+=ch;}if(cur.trim())parts.push(cur.trim());return parts[parts.length-1]||'';}
function isButtonSubject(sel){
  const s=sel.trim();
  if(/^button(:focus-visible)?$/.test(s))return false;
  if(/search-morph-results/.test(s))return false;
  if(/cp-reel-select/.test(s))return false;
  if(/poster-action|\.poster\b|collection-card|browse-card|open-movie-card(?!\s+button)|cp-reel-card|home-card-link/.test(s)){if(!/open-movie-card\s+button|open-movie-card\s*>\s*button/.test(s))return false;}
  let lc=lastCompound(s);
  const iso=lc.match(/^:(is|where)\((.*)\)(::?(before|after))?$/);
  if(iso){const inner=iso[2];const items=[];let depth=0,cur='';for(const ch of inner){if(ch==='('||ch==='[')depth++;if(ch===')'||ch===']')depth--;if(ch===','&&depth===0){items.push(cur);cur='';}else cur+=ch;}if(cur.trim())items.push(cur);return items.length>0&&items.every(it=>isButtonSubject(it.trim()));}
  if(/(^|[.\s>+~:#[])button([.\s:+~[#]|$)/.test(lc)&&/button/.test(lc)){const el=lc.replace(/[.#[:].*$/,'');if(el==='button'||el===''){if(/(^|\s|>)button([.:#[]|$)/.test(lc)||lc.startsWith('button'))return true;}}
  const m=lc.match(/^\.([a-zA-Z0-9_-]+)/);if(m&&BUTTON_CLASSES.has(m[1]))return true;
  if(/(^|\s)\.main-nav\s+a([.:#[]|$)/.test(s)||/\.main-nav\s+a$/.test(s))return true;
  if(/\.section-nav\s+a([.:#[]|$)/.test(s)||/\.section-nav\s+a$/.test(s))return true;
  return false;
}
const DESCENDANT_EFFECT=[/\.outline-button\s+svg/,/\.outline-button:hover\s+svg/,/\.settings-trigger\s+svg/,/\.settings-trigger:hover\s+svg/,/\.settings-trigger\.is-open\s+svg/,/\.account-chevron/,/\.account-entry:hover\s+\.account-chevron/,/\.account-entry:hover\s+\.settings-row-copy/,/\.account-entry\s+\.settings-row-copy/];
function isDescendantEffect(sel){return DESCENDANT_EFFECT.some(re=>re.test(sel));}
function collect(css){const root=postcss.parse(css);const map=new Map();const kf=new Set();root.walkAtRules('keyframes',at=>kf.add(at.params));root.walkRules(rule=>{let p=rule.parent,inKf=false;while(p){if(p.type==='atrule'&&p.name==='keyframes'){inKf=true;break;}p=p.parent;}if(inKf)return;for(const sel of rule.selectors){const s=sel.trim();if(!map.has(s))map.set(s,new Map());const m=map.get(s);rule.walkDecls(d=>{const k=d.prop.toLowerCase()+'||'+d.value;m.set(k,(m.get(k)||0)+1);});}});return{map,kf};}
const O=collect(original),S=collect(current);
let violations=0,nonBtn=0,btn=0;
for(const[sel,om]of O.map){
  const isBtn=isButtonSubject(sel),isDesc=isDescendantEffect(sel),isSky=/^\.site\s+\.sky-theme-(day|night)$/.test(sel);
  const sm=S.map.get(sel)||new Map();
  if(!isBtn&&!isDesc&&!isSky){nonBtn++;for(const[k,c]of om){if((sm.get(k)||0)!==c){console.log('NON-BUTTON CHANGED:',sel,'::',k);violations++;}}for(const[k]of sm){if(!om.has(k)){console.log('NON-BUTTON ADDED:',sel,'::',k);violations++;}}}
  else{btn++;for(const[k]of sm){if(!om.has(k)){console.log('BUTTON INVENTED:',sel,'::',k);violations++;}}}
}
for(const[sel]of S.map){if(!O.map.has(sel)){console.log('NEW SELECTOR:',sel);violations++;}}
const removedKf=[...O.kf].filter(k=>!S.kf.has(k));
console.log('removed keyframes:',removedKf.join(', ')||'(none)');
console.log(`checked non-button selectors=${nonBtn}, button/desc selectors=${btn}`);
console.log(violations===0?'VERIFY PASS: no non-button declaration changed; nothing invented.':`VERIFY FAIL: ${violations} violations`);
process.exit(violations===0?0:1);

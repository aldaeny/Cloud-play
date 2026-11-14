/**
 * The pre-paint boot script.
 *
 * It runs synchronously in <head> before the first paint, so:
 *   · the document opens in the stored language and direction (never a flash of
 *     the wrong direction, never a mixed-direction first frame),
 *   · the stored / system appearance is applied before any surface is painted,
 *   · viewing preferences (motion, text size, contrast, transparency, glow) are
 *     on <html> immediately, so no component has to flash a default state,
 *   · the platform / device flags exist before CSS evaluates.
 *
 * Keep this dependency-free and defensive: storage can throw in private mode.
 */
export const BOOT_SCRIPT = `(function(){try{
var d=document.documentElement;
var get=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
/* ---- language & direction ---- */
var lang=get('cloudplay-language')==='en'?'en':'ar';
var dir=lang==='ar'?'rtl':'ltr';
d.lang=lang; d.dir=dir; d.setAttribute('data-lang',lang); d.setAttribute('data-dir',dir);
/* The server always renders Arabic; if the device prefers English we mask the
   content for a beat until React hydrates with the right copy (max 900ms). */
if(lang!=='ar') d.setAttribute('data-lang-pending','1');
/* ---- appearance ---- */
var mode=get('cloudplay-theme');
if(mode!=='dark'&&mode!=='light') mode='system';
var mq=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)');
var theme=mode==='system'?(mq&&mq.matches?'light':'dark'):mode;
d.setAttribute('data-theme',theme); d.setAttribute('data-theme-mode',mode);
d.style.colorScheme=theme;
d.classList.toggle('theme-light',theme==='light');
d.classList.toggle('theme-dark',theme==='dark');
if(mode==='system'&&mq){
  var sync=function(e){var next=e.matches?'light':'dark';d.setAttribute('data-theme',next);d.style.colorScheme=next;
    d.classList.toggle('theme-light',next==='light');d.classList.toggle('theme-dark',next==='dark');};
  if(mq.addEventListener) mq.addEventListener('change',sync); else if(mq.addListener) mq.addListener(sync);
}
/* ---- viewing preferences ---- */
var flag=function(name,key,on){ if(on) d.classList.add(name); else d.classList.remove(name); };
flag('motion-off',null,get('cloudplay-reduce-motion')==='true');
flag('text-large',null,get('cloudplay-text-size')==='large');
flag('high-contrast',null,get('cloudplay-high-contrast')==='true');
flag('solid-panels',null,get('cloudplay-solid-panels')==='true');
flag('no-glow',null,get('cloudplay-glow')==='false');
/* ---- platform / device ---- */
var ua=navigator.userAgent||'';
var coarse=window.matchMedia&&window.matchMedia('(pointer: coarse)').matches;
var w=window.innerWidth||1024;
var platform='web';
if(/iPad|iPhone|iPod/.test(ua)||(/Macintosh/.test(ua)&&coarse)) platform='ios';
else if(/Android/i.test(ua)) platform='android';
var device='desktop';
if(/TV|SmartTV|Tizen|webOS|NetCast|BRAVIA|Roku|AppleTV|AFT|HbbTV/i.test(ua)) device='tv';
else if(w<=480) device='phone';
else if(w<=1024) device=(coarse||/Android|iPad/i.test(ua))?'tablet':'desktop';
d.setAttribute('data-platform',platform); d.setAttribute('data-device',device);
if(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches) d.setAttribute('data-standalone','true');
}catch(e){}})();`;

/** Inline script element used by both routers (App Router + Pages Router). */
export function bootScriptTag() {
  return { __html: BOOT_SCRIPT };
}

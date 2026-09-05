// Webview surface. The page is untrusted: it only renders what the handlers return and sends intents.
// NOTE: client JS is injected as a source string; it must not use backticks or ${ } (kept inside String.raw).
import { wxSim } from "../game/wuxing.js";
import { pack, UNPACK_SRC } from "../util/lz.js";

// the puzzle simulator is shipped to the page verbatim so a move can be checked without a round trip
const WX_SIM_SRC = wxSim.toString();

export function pageHtml(ctx) {
  const name = ctx?.user?.username ?? "";
  return '<div id="wd" data-user="' + String(name).replace(/[^\w\-一-龥]/g, "") + '">' +
    '<div id="top"></div><div id="app"><div class="center muted">问道中…</div></div><div id="tabs"></div>' +
    '<div id="toasts"></div><div id="overlay" class="hidden"></div></div>';
}

export function pageCss() {
  return String.raw`
#wd{--bg:#0B0F1A;--panel:#111C25;--panel2:#0d1620;--gold:#D6B36A;--gold2:#F3E2B3;--dgold:#7D693F;--jade:#5fa37a;--cinnabar:#9E3F3F;--moon:#e6e3da;--mist:#8a95a6;--blue:#314A5E;--paper:#D8C9A7;--line:rgba(214,179,106,.3);--glow:rgba(214,179,106,.16);--kai:"STKaiti","KaiTi","Noto Serif SC","Songti SC",serif;--song:"Songti SC","SimSun","STSong","Noto Serif SC",serif;
font-family:var(--song);color:var(--moon);background:var(--bg);max-width:760px;margin:0 auto;min-height:100vh;position:relative;padding-bottom:80px;line-height:1.6;overflow:hidden}
#wd::before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;background:
radial-gradient(1100px 560px at 50% -12%,rgba(214,179,106,.09),transparent 62%),
url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='760' height='420' viewBox='0 0 760 420'><g fill='%23f1e1b5'><circle cx='90' cy='60' r='1.2'/><circle cx='210' cy='30' r='.9'/><circle cx='330' cy='80' r='1.1'/><circle cx='470' cy='40' r='.8'/><circle cx='600' cy='70' r='1.3'/><circle cx='700' cy='25' r='.9'/><circle cx='150' cy='130' r='.7'/><circle cx='520' cy='120' r='.8'/><circle cx='660' cy='150' r='.6'/></g><path d='M0 330 L80 250 L150 300 L230 210 L320 290 L400 240 L480 300 L560 230 L640 280 L760 220 L760 420 L0 420Z' fill='%2314213a' opacity='.92'/><path d='M0 380 L60 330 L140 360 L220 310 L300 350 L390 320 L470 360 L560 320 L650 350 L760 310 L760 420 L0 420Z' fill='%230e1930'/></svg>") no-repeat top center/100% auto}
#wd>*{position:relative;z-index:1}
#wd *{box-sizing:border-box}
#wd .hidden{display:none!important}
#wd .item.fe{cursor:pointer;border-style:dashed}#wd .item.fe.on{border-color:var(--gold2);box-shadow:0 0 10px rgba(214,179,106,.3)}
#wd .opt.hid{border-color:rgba(243,226,179,.7);box-shadow:0 0 10px rgba(214,179,106,.35),inset 0 0 12px rgba(214,179,106,.12);animation:wdhid 2.4s ease-in-out infinite}@keyframes wdhid{50%{box-shadow:0 0 16px rgba(214,179,106,.6),inset 0 0 14px rgba(214,179,106,.2)}}
#wd .muted{color:var(--mist);font-size:12px}
#wd .center{text-align:center;padding:24px}
#wd .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#wd .sb{justify-content:space-between}
#wd .grow{flex:1;min-width:0}
/* ---- scroll card: vertical kai side label + one gilt rail (circle, 1px line, gold dust) */
#wd .tut{display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px dashed rgba(214,179,106,.25)}.tut .mk{width:22px;height:22px;border:1px solid #7D693F;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#D6B36A;font-size:13px;flex:0 0 22px}.tut.ok .mk{background:#D6B36A;color:#0B0F1A}.tut.ok b{color:#7D693F;text-decoration:line-through}.card{position:relative;background:linear-gradient(180deg,rgba(17,28,37,.94),rgba(10,15,24,.97));border:14px solid transparent;border-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='48' height='48'><rect x='1.5' y='1.5' width='45' height='45' fill='none' stroke='%23D6B36A' stroke-opacity='.5'/><g fill='none' stroke='%23D6B36A' stroke-width='1.2'><path d='M5 15 V5 H15 M33 5 H43 V15 M5 33 V43 H15 M33 43 H43 V33'/></g><g fill='%23D6B36A'><circle cx='5' cy='5' r='1.6'/><circle cx='43' cy='5' r='1.6'/><circle cx='5' cy='43' r='1.6'/><circle cx='43' cy='43' r='1.6'/></g></svg>") 14 / 14px stretch;border-radius:0;padding:1px;margin:12px;box-shadow:0 8px 22px rgba(0,0,0,.45)}
#wd .card.ct{padding:3px 0 1px 29px;min-height:calc(var(--tl,2)*19px + 34px)}
#wd .card h3{margin:0 0 9px;font-family:var(--kai);font-weight:400;font-size:17px;letter-spacing:.16em;color:var(--gold2)}
#wd .card.ct>h3{position:absolute;left:-3px;top:4px;bottom:2px;width:25px;margin:0;padding:0 7px 0 0;writing-mode:vertical-rl;font-size:15px;letter-spacing:.22em;overflow:hidden;border-right:1px solid var(--line)}
#wd .card.ct::before{content:"";position:absolute;left:17px;top:-8px;width:9px;height:9px;border-radius:50%;border:1px solid var(--gold);background:rgba(214,179,106,.2)}
#wd .card.ct::after{content:"";position:absolute;left:20px;bottom:-6px;width:3px;height:3px;border-radius:50%;background:var(--gold);opacity:.8;box-shadow:0 -6px 0 -.4px rgba(214,179,106,.55),0 -11px 0 -.9px rgba(214,179,106,.32)}
#wd .card h4{margin:12px 0 4px;font-family:var(--kai);font-size:13px;color:var(--gold);letter-spacing:.14em;font-weight:400}
#wd .sub{font-size:12px;color:var(--mist);letter-spacing:.04em;margin:0 0 8px}
#wd #app>.rise{animation:wdrise .22s ease-out both}
@keyframes wdrise{0%{opacity:0}100%{opacity:1;transform:none}}
/* ---- controls */
#wd button{font:inherit;font-family:var(--kai);font-size:13px;border:0;border-radius:0;background:linear-gradient(180deg,rgba(214,179,106,.75),rgba(125,105,63,.75));color:var(--gold2);padding:8px 18px;cursor:pointer;transition:.16s;letter-spacing:.1em;position:relative;isolation:isolate;clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 50%,calc(100% - 9px) 100%,9px 100%,0 50%)}
#wd button::before{content:"";position:absolute;inset:1px;z-index:-1;background:linear-gradient(180deg,#1b2733,#0d1520);clip-path:polygon(8.3px 0,calc(100% - 8.3px) 0,100% 50%,calc(100% - 8.3px) 100%,8.3px 100%,0 50%)}
#wd button:hover{background:linear-gradient(180deg,var(--gold2),var(--gold))}
#wd button:hover::before{background:linear-gradient(180deg,#253645,#121c28)}
#wd button:active{transform:scale(.97)}
#wd button:focus-visible{outline:2px solid var(--jade);outline-offset:-4px}
#wd button:disabled{opacity:.36;cursor:not-allowed}
#wd button.pri{background:linear-gradient(180deg,#F3E2B3,#a9853f);color:#1d1607;font-weight:600;letter-spacing:.12em}
#wd button.pri::before{background:linear-gradient(180deg,#ebd49c,#c29a48)}
#wd button.pri:hover::before{background:linear-gradient(180deg,#f5e3b0,#cda55a)}
#wd button.gold{background:linear-gradient(180deg,#9fdcbb,#2f7558);color:#06150f}
#wd button.gold::before{background:linear-gradient(180deg,#6fb894,#2f7558)}
#wd button.flat{background:transparent;clip-path:none;color:var(--jade);padding:4px 6px}
#wd button.flat::before{display:none}
#wd button.sm{font-size:12px;padding:5px 13px;letter-spacing:.06em;clip-path:polygon(7px 0,calc(100% - 7px) 0,100% 50%,calc(100% - 7px) 100%,7px 100%,0 50%)}
#wd button.sm::before{clip-path:polygon(6.3px 0,calc(100% - 6.3px) 0,100% 50%,calc(100% - 6.3px) 100%,6.3px 100%,0 50%)}
#wd button.danger{color:#f0b0a4;background:linear-gradient(180deg,rgba(170,70,70,.9),rgba(90,30,30,.9))}
#wd button.danger::before{background:linear-gradient(180deg,#2a1414,#150a0a)}
#wd input,#wd select,#wd textarea{font:inherit;font-size:14px;border:1px solid var(--line);border-radius:3px;padding:9px 10px;background:rgba(0,0,0,.3);color:var(--moon);width:100%}
#wd input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 1px var(--glow)}
/* ---- hud bars: cinnabar lacquer / flowing water / gold liquid with a lotus cap */
#wd .bar{height:6px;background:rgba(0,0,0,.55);border:1px solid rgba(214,179,106,.3);border-radius:3px;overflow:hidden;margin:3px 0}
#wd .bar i::before{content:"";position:absolute;right:0;top:50%;width:6px;height:6px;margin-top:-3px;border-radius:50%;background:#fff6dc;box-shadow:0 0 6px 1px rgba(243,226,179,.95)}
#wd .bar.xp i::before{display:none}
#wd .bar i{display:block;height:100%;position:relative;background:linear-gradient(180deg,#a9c6ee,#5a7fb0);transition:width .55s cubic-bezier(.3,.8,.3,1)}
#wd .bar.hp i{background:linear-gradient(180deg,#c9564a,#9E3F3F 48%,#5e2323)}
#wd .bar.mp i{background:linear-gradient(90deg,#24384a,#3f6a8a 30%,#86b8d6 50%,#3f6a8a 70%,#24384a);background-size:240% 100%;animation:wdflow 5.5s linear infinite}
#wd .bar.xp i{background:linear-gradient(180deg,#f6ecd0,#D6B36A 52%,#8f7130)}
#wd .bar.xp i::after{content:"";position:absolute;right:0;top:0;bottom:0;width:9px;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><g fill='%23fffaea'><path d='M6 .8 C7.7 4 7.7 6.6 6 9.4 C4.3 6.6 4.3 4 6 .8Z'/><path d='M6 9.4 C3.4 8.5 1.6 6.3 1.2 3.6 C3.5 4.4 5.2 6.3 6 9.4Z' opacity='.8'/><path d='M6 9.4 C8.6 8.5 10.4 6.3 10.8 3.6 C8.5 4.4 6.8 6.3 6 9.4Z' opacity='.8'/></g></svg>") center/contain no-repeat}
#wd .bar.st i{background:linear-gradient(180deg,#7fd8b8,#3a8a6d)}
@keyframes wdflow{to{background-position:-240% 0}}
/* ---- top: dantian seal */
#top{position:sticky;top:0;z-index:5;background:linear-gradient(180deg,rgba(11,18,32,.98),rgba(11,18,32,.9));border-bottom:1px solid var(--line);padding:9px 12px 8px;backdrop-filter:blur(6px)}
#top .seal{width:78px;flex:none;position:relative;text-align:center}
#top .seal svg{width:78px;height:78px;display:block}
#top .seal .ring{transform-origin:42px 42px;animation:wdspin 52s linear infinite}
#top .seal .realm{margin-top:-2px;font-family:var(--kai);font-size:12px;color:var(--gold2);letter-spacing:.14em;line-height:1.25;white-space:nowrap}
#top .dtspin{transform-origin:42px 42px;animation:wdspin 13s linear infinite}
#top .dtspin2{transform-origin:42px 42px;animation:wdspin 21s linear infinite reverse}
#top .dtblob{transform-origin:42px 42px;animation:wdblob 7s ease-in-out infinite}
#top .dtcore{transform-origin:42px 42px;animation:wdspin 9s linear infinite}
#top .dtaura{transform-origin:42px 42px;animation:wdaura 3.4s ease-in-out infinite}
#top .dtbr{animation:wdbr 4.6s ease-in-out infinite}
@keyframes wdspin{to{transform:rotate(360deg)}}
@keyframes wdblob{0%,100%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.07) rotate(9deg)}}
@keyframes wdaura{0%{transform:scale(.86);opacity:.65}100%{transform:scale(1.32);opacity:0}}
@keyframes wdbr{0%,100%{opacity:.45}50%{opacity:1}}
#top .name{font-family:var(--kai);font-weight:400;font-size:21px;color:var(--gold2);letter-spacing:.14em}
#top .stat{font-size:12px;color:var(--mist)}
#top .bars{flex:1;min-width:0}
/* ---- bottom tabs: a gold seal that slides and stamps */
#tabs{position:fixed;bottom:0;left:0;right:0;max-width:760px;margin:0 auto;display:flex;background:linear-gradient(180deg,#14213a,#0B0F1A);border-top:1px solid var(--line);z-index:6;box-shadow:0 -8px 22px rgba(0,0,0,.5)}
#tabs button{flex:1;border:0;border-radius:0;background:transparent;padding:7px 0 6px;font-size:11px;color:var(--mist);display:flex;flex-direction:column;align-items:center;gap:3px;letter-spacing:.06em;box-shadow:none;position:relative;z-index:1;font-family:var(--song);clip-path:none;isolation:auto}
#tabs button::before{display:none}
#tabs button:hover{background:transparent}
#tabs button .ic{font-family:var(--kai);font-size:14px;line-height:1;width:24px;height:32px;display:flex;align-items:center;justify-content:center;color:var(--gold);opacity:.72;transition:.2s;position:relative;z-index:1;isolation:isolate;background:linear-gradient(180deg,rgba(214,179,106,.8),rgba(125,105,63,.8));clip-path:polygon(50% 0,100% 20%,100% 80%,50% 100%,0 80%,0 20%)}
#tabs button .ic::before{content:"";position:absolute;inset:1px;z-index:-1;background:linear-gradient(180deg,#16212c,#0B0F1A);clip-path:polygon(50% 0,100% 20%,100% 80%,50% 100%,0 80%,0 20%)}
#tabs button.on{color:var(--gold2)}
#tabs button.on .ic{opacity:1;background:transparent;color:#1d1607;font-weight:700}
#tabs button.on .ic::before{display:none}
#tabs button.on::after{content:"";position:absolute;left:50%;top:23px;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:radial-gradient(rgba(214,179,106,.55),rgba(214,179,106,0) 66%);z-index:0;pointer-events:none}
#tabs .ind{position:absolute;left:0;top:7px;width:var(--w,12.5%);height:32px;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0;transform:translateX(calc(var(--i,0)*100%));transition:transform .34s cubic-bezier(.34,1.5,.42,1)}
#tabs .ind b{display:block;width:24px;height:32px;border-radius:0;background:linear-gradient(180deg,#F3E2B3,#b8934a);clip-path:polygon(50% 0,100% 20%,100% 80%,50% 100%,0 80%,0 20%)}
#tabs .ind.stamp b{animation:wdstamp .3s cubic-bezier(.2,1.6,.4,1)}
@keyframes wdstamp{0%{transform:scale(1.4);opacity:.35}60%{transform:scale(.93);opacity:1}100%{transform:scale(1)}}
/* ---- toasts */
#toasts{position:fixed;bottom:84px;left:50%;transform:translateX(-50%);z-index:60;display:flex;flex-direction:column;gap:6px;pointer-events:none;width:min(92vw,520px)}
#toasts .t{background:rgba(11,18,32,.96);border:1px solid var(--line);color:var(--gold2);padding:9px 14px;border-radius:3px;font-size:13px;animation:wdfade 3.6s forwards;box-shadow:0 6px 20px rgba(0,0,0,.5)}
#toasts .t.bad{border-color:rgba(158,63,63,.7);color:#f2b0a4}
.ferr{color:#f2b0a4;font-size:13px;min-height:18px;margin:4px 0}
@keyframes wdfade{0%{opacity:0;transform:translateY(6px)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
/* ---- ink wipe between screens */
#wd .ink{position:fixed;inset:0;z-index:24;pointer-events:none;animation:wdink .42s ease-out forwards;background:radial-gradient(circle at 50% 40%,rgba(7,11,22,0) 0,rgba(7,11,22,.55) 34%,rgba(7,11,22,.96) 62%,rgba(7,11,22,.99) 100%)}
#wd .ink::after{content:"";position:absolute;inset:0;opacity:.55;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.045' numOctaves='4'/></filter><rect width='180' height='180' filter='url(%23n)' fill='%23070b16'/></svg>") center/180px 180px}
@keyframes wdink{0%{opacity:1;transform:scale(1)}55%{opacity:.5}100%{opacity:0;transform:scale(1.5)}}
/* ---- overlay */
#overlay{position:fixed;inset:0;background:#05080f radial-gradient(760px 480px at 50% 0%,#1e2849,#05080f);z-index:30;color:var(--moon);overflow:auto}
#overlay .panel{max-width:560px;margin:0 auto;padding:16px;position:relative;z-index:2}
#overlay h2{font-family:var(--kai);font-weight:400;letter-spacing:.18em;color:var(--gold2)}
#overlay canvas{width:100%;height:220px;display:block;border-radius:5px;background:#060915;border:1px solid var(--line)}
#overlay .log{font-size:13px;max-height:38vh;overflow:auto;background:rgba(0,0,0,.32);padding:8px;border-radius:3px;border:1px solid rgba(214,179,106,.14)}
#overlay .log div{padding:3px 0;border-bottom:1px dashed rgba(214,179,106,.12)}
#overlay .log .A{color:var(--gold2)} #overlay .log .B{color:#f2a08e} #overlay .log .big{font-weight:700}
/* ---- burned-edge scroll modal, unrolling from the axle */
#wd .panel.scr{background:linear-gradient(180deg,#e4d7b4,#D8C9A7 45%,#cbb991);color:#2a2115;border:1px solid #7D693F;border-radius:2px;padding:22px 22px 20px;margin:26px auto;max-width:560px;box-shadow:inset 0 0 42px rgba(96,74,32,.38),0 16px 40px rgba(0,0,0,.6);animation:wdunroll .42s cubic-bezier(.24,1.5,.42,1) both;transform-origin:50% 50%;position:relative;z-index:2}
#wd .panel.scr::before,#wd .panel.scr::after{content:"";position:absolute;left:-12px;right:-12px;height:14px;border-radius:7px;background:linear-gradient(90deg,#3a2c14 0,#8d6c30 12px,#cfab5e 50%,#8d6c30 calc(100% - 12px),#3a2c14 100%);box-shadow:0 2px 5px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,240,200,.35)}
#wd .panel.scr::before{top:-12px}
#wd .panel.scr::after{bottom:-12px}
#wd .panel.scr>.burn{position:absolute;inset:0;pointer-events:none;opacity:.55;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='.03' numOctaves='3'/><feDisplacementMap in='SourceGraphic' scale='9'/></filter><rect x='2' y='2' width='136' height='136' fill='none' stroke='%23a88f63' stroke-width='7' filter='url(%23b)'/></svg>") center/100% 100% no-repeat}
#wd .panel.scr h2{color:#5a3d12}
#wd .panel.scr .ev,#wd .panel.scr .mq{color:#2a2115}
#wd .panel.scr .mq{font-size:15px;line-height:1.8;white-space:pre-wrap;font-family:var(--kai);letter-spacing:.04em}
#wd .panel.scr .muted{color:#6b5a40}
#wd .panel.scr .gains span{color:#7a4f10}
#wd .panel.scr input{background:rgba(255,250,236,.75);color:#2a2115;border:1px solid #a08a58}
#wd .panel.scr input:focus{border-color:#7D693F;box-shadow:0 0 0 1px rgba(125,105,63,.3)}
#wd .modal{position:fixed;inset:0;z-index:40;background:rgba(4,7,14,.72);display:flex;align-items:center;justify-content:center;padding:18px}
#wd .modal .mbox{width:100%;max-width:420px;margin:0}
#wd .modal .row{margin-top:12px}
@keyframes wdunroll{0%{transform:scaleY(.03);opacity:.25}66%{transform:scaleY(1.07);opacity:1}100%{transform:scaleY(1)}}
/* ---- breakthrough ceremony */
#overlay .bloom{position:fixed;inset:0;pointer-events:none;z-index:1;background:radial-gradient(circle at 50% 44%,rgba(255,241,205,.85) 0,rgba(226,190,110,.4) 16%,rgba(180,138,58,.14) 36%,rgba(11,18,32,0) 62%);animation:wdbloom 1.4s ease-out forwards}
#overlay .bloom.w{background:radial-gradient(circle at 50% 44%,rgba(255,255,255,.98) 0,rgba(255,255,255,.5) 26%,rgba(255,255,255,0) 58%);animation:wdflash .5s ease-out forwards}
@keyframes wdbloom{0%{opacity:0;transform:scale(.2)}20%{opacity:.95}55%{opacity:.5}100%{opacity:0;transform:scale(1.9)}}
@keyframes wdflash{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
#overlay .gains{position:relative;z-index:2;margin:10px 0 2px;min-height:22px}
#overlay .gains span{display:block;font-family:var(--kai);font-size:15px;color:#ffe6a8;letter-spacing:.12em;animation:wdgain 1.5s ease-out both;animation-delay:calc(var(--i,0)*140ms + 240ms)}
@keyframes wdgain{0%{opacity:0;transform:translateY(16px)}30%{opacity:1;transform:none}80%{opacity:1}100%{opacity:.85;transform:translateY(-4px)}}
#overlay .crk{position:relative;z-index:2;white-space:pre;width:150px;height:150px;margin:14px auto 6px;display:flex;align-items:center;justify-content:center;font-family:var(--kai);font-size:31px;line-height:1.05;letter-spacing:.1em;color:#ffd9cd;text-align:center;border:3px solid #a8301c;border-radius:5px;background:linear-gradient(180deg,rgba(150,40,24,.9),rgba(96,22,14,.92));box-shadow:0 0 0 1px rgba(0,0,0,.5),0 10px 30px rgba(0,0,0,.6);animation:wdcrack .12s cubic-bezier(.2,1.4,.4,1) both}
#overlay .crk::after{content:"";position:absolute;inset:0;background:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 150 150'><g stroke='%23120608' stroke-width='3' fill='none' stroke-linecap='round'><path d='M76 -2 L64 40 L86 62 L58 96 L74 120 L62 152'/><path d='M64 40 L26 30 M86 62 L128 48 M58 96 L18 104 M74 120 L120 132'/></g></svg>") center/100% 100% no-repeat;opacity:.85}
@keyframes wdcrack{0%{transform:scale(1.34) rotate(6deg);opacity:0}60%{opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}
/* ---- tribulation */
#overlay .quake{animation:wdquake .34s ease-out}
@keyframes wdquake{0%,100%{transform:translate(0,0)}15%{transform:translate(-7px,3px)}32%{transform:translate(6px,-3px)}52%{transform:translate(-4px,2px)}74%{transform:translate(3px,-1px)}}
#overlay .tip{font-size:12px;color:#cdb079;border-left:1px solid var(--line);padding:2px 0 2px 9px;margin:6px 0 2px;letter-spacing:.03em}
/* ---- battle replay */
#overlay .arena{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:8px 0 12px}
#overlay .fighter{text-align:center;position:relative;transition:opacity .6s}
#overlay .fighter .pfw{display:inline-block;border-radius:50%;padding:3px;background:linear-gradient(180deg,rgba(214,179,106,.55),rgba(214,179,106,.08))}
#overlay .fighter .pf{width:88px;height:88px;border-radius:50%;display:block;object-fit:cover;background:#0B0F1A}
#overlay .fighter .fn{font-family:var(--kai);color:var(--gold2);letter-spacing:.1em;margin:6px 0 4px}
#overlay .fighter.L.atk{animation:wdlungeL .4s ease-out} #overlay .fighter.R.atk{animation:wdlungeR .4s ease-out}
#overlay .fighter.hit .pfw{animation:wdshake .4s ease-out}
#overlay .fighter.hit .pf{filter:brightness(1.7) saturate(.5)}
#overlay .fighter.down{opacity:.35;filter:grayscale(1)}
#overlay .dmg{position:absolute;left:50%;top:30px;transform:translateX(-50%);font-weight:700;font-size:20px;color:#ffb4a0;text-shadow:0 0 8px rgba(255,120,90,.75);animation:wdfloat .9s ease-out forwards;pointer-events:none;font-variant-numeric:tabular-nums}
#overlay .dmg.crit{color:#ffe28a;font-size:26px}
#overlay .vs{font-family:var(--kai);font-size:22px;color:var(--gold);width:44px;height:44px;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:50%;background:rgba(0,0,0,.3)}
#overlay .vs.win{color:#1d1607;background:linear-gradient(180deg,#F3E2B3,#c19a4c)}
#overlay .vs.lose{color:#f2b0a4;border-color:rgba(158,63,63,.6)}
@keyframes wdshake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px) rotate(-3deg)}40%{transform:translateX(6px) rotate(2deg)}60%{transform:translateX(-4px)}80%{transform:translateX(3px)}}
@keyframes wdlungeL{0%{transform:translateX(0)}35%{transform:translateX(18px) scale(1.06)}100%{transform:translateX(0)}}
@keyframes wdlungeR{0%{transform:translateX(0)}35%{transform:translateX(-18px) scale(1.06)}100%{transform:translateX(0)}}
@keyframes wdfloat{0%{opacity:0;transform:translate(-50%,10px)}15%{opacity:1}100%{opacity:0;transform:translate(-50%,-40px)}}
/* ---- tags, tiers, five phases */
#wd .tag{display:inline-block;font-size:11px;line-height:17px;padding:0 9px;border:0;border-radius:0;background:rgba(214,179,106,.6);color:var(--gold2);margin-right:4px;letter-spacing:.04em;vertical-align:middle;position:relative;isolation:isolate;clip-path:polygon(5px 0,calc(100% - 5px) 0,100% 50%,calc(100% - 5px) 100%,5px 100%,0 50%)}
#wd .tag::before{content:"";position:absolute;inset:1px;z-index:-1;background:#0f1821;clip-path:polygon(4.3px 0,calc(100% - 4.3px) 0,100% 50%,calc(100% - 4.3px) 100%,4.3px 100%,0 50%)}
#wd .tag.red{background:rgba(158,63,63,.9);color:#f2b0a4}
#wd .tag.blue{background:rgba(80,130,190,.8);color:#a9c6ee}
#wd .tag.green{background:rgba(95,163,122,.8);color:#a6dcbe}
#wd .tag.purple{background:rgba(150,116,196,.8);color:#d3bff0}
#wd .tag.gold{background:var(--gold)}
#wd .tag.t0{background:rgba(140,151,173,.7);color:#c3cbd8}
#wd .tag.t1{background:rgba(154,175,74,.8);color:#d3dc9a}
#wd .tag.t2{background:rgba(90,160,190,.8);color:#a6d5e2}
#wd .tag.t3{background:rgba(150,110,200,.8);color:#d6bff2}
#wd .tag.t4{background:var(--gold);color:#f6ecd0}
#wd .tag.t5{background:rgba(226,140,80,.9);color:#ffd8a8}
#wd .el{display:inline-block;min-width:18px;padding:0 4px;margin-right:4px;font-size:11px;line-height:16px;text-align:center;border:1px solid currentColor;border-radius:2px;vertical-align:middle;letter-spacing:0}
#wd .el.mu{color:#7cc39a;border-color:rgba(95,163,122,.7);background:rgba(95,163,122,.14)}
#wd .el.huo{color:#f08d76;border-color:rgba(158,63,63,.75);background:rgba(158,63,63,.16)}
#wd .el.tu{color:#d5a95c;border-color:rgba(184,134,59,.75);background:rgba(184,134,59,.16)}
#wd .el.jin{color:#e6e3da;border-color:rgba(232,230,223,.6);background:rgba(232,230,223,.1)}
#wd .el.shui{color:#7ba7e0;border-color:rgba(59,111,179,.8);background:rgba(59,111,179,.2)}
#wd .el.lei{color:#c4d6ff;border-color:rgba(150,180,255,.6);background:rgba(150,180,255,.12)}
#wd .el.wu{color:#8a95a6;border-color:rgba(140,151,173,.5)}
/* ---- lists and items */
#wd .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));gap:8px}
#wd .grid>*{min-width:0}
@media (max-width:380px){#wd .grid{grid-template-columns:1fr!important}}
#wd .item{position:relative;border:1px solid rgba(214,179,106,.18);border-radius:4px;padding:8px;background:rgba(0,0,0,.24);font-size:13px}
#wd .item .n{font-weight:600;color:var(--gold2)}
#wd .item.on{border-color:var(--gold);box-shadow:0 0 0 1px var(--glow) inset}
#wd .item.lock{opacity:.48}
#wd .item.t1{border-color:rgba(154,175,74,.42)}
#wd .item.t2{border-color:rgba(58,124,148,.5)}
#wd .item.t3{border-color:rgba(126,86,168,.5)}
#wd .item.t4,#wd .item.t5{border:1px solid transparent;background:transparent;isolation:isolate}
#wd .item .rim{position:absolute;inset:-1px;border-radius:5px;overflow:hidden;z-index:-1;pointer-events:none}
#wd .item .rim i{position:absolute;left:50%;top:50%;width:340%;padding-bottom:340%;margin:-170% 0 0 -170%;transform-origin:50% 50%;background:conic-gradient(from 0turn,rgba(214,179,106,.12),#f6ecd0,rgba(214,179,106,.12) 34%,rgba(214,179,106,.12) 62%,#D6B36A,rgba(214,179,106,.12) 96%);animation:wdrim 6s linear infinite}
#wd .item .rim::after{content:"";position:absolute;inset:2px;border-radius:4px;background:#111a2c}
#wd .item.t5 .rim i{background:conic-gradient(from 0turn,rgba(190,74,52,.2),#ffdca8,rgba(190,74,52,.2) 34%,rgba(190,74,52,.2) 62%,#ff9f6a,rgba(190,74,52,.2) 96%)}
@keyframes wdrim{to{transform:rotate(1turn)}}
#wd .list>div{padding:8px 0;border-bottom:1px dashed rgba(214,179,106,.16);font-size:13px}
#wd .list>div:last-child{border-bottom:0}
#wd .ev{font-size:15px;line-height:1.95;white-space:pre-wrap;color:var(--moon)}
#wd .opt{display:block;width:100%;text-align:left;margin:6px 0;padding:11px 18px;font-size:14px;font-family:var(--song);letter-spacing:.02em;background:linear-gradient(180deg,rgba(214,179,106,.4),rgba(125,105,63,.4))}
#wd .opt::before{background:linear-gradient(180deg,#121c27,#0a0f18)}
#wd .opt .req{float:right;font-size:11px;color:var(--mist)}
#wd .res{background:rgba(214,179,106,.07);border-left:2px solid var(--gold);padding:9px 12px;margin:8px 0;font-size:14px;line-height:1.85;white-space:pre-wrap}
#wd .kv{display:grid;grid-template-columns:auto 1fr;gap:3px 14px;font-size:13px}
#wd .kv b{color:var(--mist);font-weight:400}
#wd .rank{width:28px;text-align:center;font-weight:700;color:var(--gold)}
#wd .me{background:rgba(214,179,106,.09)}
#wd .stars{color:var(--gold);letter-spacing:-1px}
#wd .note{font-size:13px;padding:7px 10px;background:rgba(214,179,106,.06);border:1px solid rgba(214,179,106,.16);border-radius:3px;margin:4px 0}
#wd .num{font-variant-numeric:tabular-nums}
#wd .item .num{white-space:nowrap}#wd .item .row.sb>.num.grow{flex:1 0 auto}#wd .item .row.sb>button{margin-left:auto}
#wd .path{cursor:pointer}
#wd .path:hover{border-color:var(--gold)}
#wd .hero{margin:12px 12px 0;border:1px solid var(--line);border-radius:5px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.34);position:relative}
#wd .hero img{width:100%;display:block;aspect-ratio:760/200;object-fit:cover}
#wd .hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 62%,rgba(11,18,32,.55));pointer-events:none}
#wd .ico{width:36px;height:36px;border-radius:3px;border:1px solid rgba(214,179,106,.26);display:block;object-fit:cover;background:#0B0F1A}
#wd .ico.sm{width:24px;height:24px;display:inline-block;vertical-align:middle;margin-right:4px}
#wd .item.ic{padding-left:51px;min-height:54px}
#wd .item.ic>.ico{position:absolute;left:9px;top:9px}
#wd .item.rg{padding-top:8px}
#wd .rgimg{width:100%;display:block;border-radius:3px;margin-bottom:6px;border:1px solid rgba(214,179,106,.22);aspect-ratio:3/1;object-fit:cover}
#wd .item.lock .rgimg{filter:grayscale(.7) brightness(.6)}
#wd .mon{width:68px;height:68px;border-radius:50%;border:1px solid var(--line);flex:none;object-fit:cover;background:#0B0F1A}
#wd .mon.sm{width:30px;height:30px;margin-right:6px}
#wd .ph{display:flex;align-items:center;justify-content:center;font-family:var(--kai);color:var(--gold2);font-size:22px}
#wd .encp{display:flex;gap:12px;align-items:center;margin:0 0 10px;padding:8px;background:rgba(0,0,0,.24);border:1px solid rgba(214,179,106,.16);border-radius:3px}
#wd .encp .n{font-weight:600;color:var(--gold2);font-size:15px;font-family:var(--kai);letter-spacing:.08em}
#wd .drops{gap:6px;margin-top:6px}
#wd .drop{display:inline-flex;align-items:center;font-size:13px;padding:3px 8px 3px 4px;border:1px solid rgba(214,179,106,.28);border-radius:3px;background:rgba(214,179,106,.07);color:var(--gold2)}
#wd .drop.lost{opacity:.5;text-decoration:line-through}
#wd .qi{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}
#wd .rank.r1,#wd .rank.r2,#wd .rank.r3{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;font-size:12px;color:#1d1607;margin-right:4px;font-family:var(--kai)}
#wd .rank.r1{background:linear-gradient(180deg,#f6ecd0,#c19a4c)}
#wd .rank.r2{background:linear-gradient(180deg,#dfe6e4,#8fa39d)}
#wd .rank.r3{background:linear-gradient(180deg,#d9a274,#96603a)}
/* ---- leaderboard podium */
#wd .podium{position:relative;margin:2px 0 10px;padding-top:6px}
#wd .podium svg{display:block;width:100%;height:auto}
#wd .pods{position:absolute;inset:0;display:flex;align-items:flex-end;gap:2px}
#wd .pod{flex:1;text-align:center;min-width:0;padding-left:2%;padding-right:2%}
#wd .pod{padding-bottom:8.3%}
#wd .note.pin{padding:2px 10px;background:rgba(214,179,106,.1);border-color:rgba(214,179,106,.3)}
#wd .note.pin .row{border-bottom:0}
#wd .pod .sl{display:none;width:27px;height:27px;margin:0 auto 3px;border-radius:50%;font-family:var(--kai);font-size:14px;line-height:25px;color:#1d1607;border:1px solid rgba(0,0,0,.35)}
#wd .pod.p1 .sl{background:linear-gradient(180deg,#f6ecd0,#c19a4c);box-shadow:0 0 12px rgba(226,190,110,.5)}
#wd .pod.p2 .sl{background:linear-gradient(180deg,#cfe3dc,#7fa79b)}
#wd .pod.p3 .sl{background:linear-gradient(180deg,#d99a6a,#8d5730)}
#wd .pod .pn{font-family:var(--kai);font-size:13px;color:var(--gold2);letter-spacing:.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 3px rgba(6,10,20,.95),0 0 6px rgba(6,10,20,.9)}
#wd .pod .pv{font-size:11px;color:var(--mist);text-shadow:0 1px 3px rgba(6,10,20,.95);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#wd .pod.p1 .pn{font-size:15px;color:#fff3d4}
#wd .pod .pm{font-size:10px;color:var(--paper);opacity:.9}
#wd .tag.vipb{font-size:10px;padding:0 5px;background:rgba(0,0,0,.25)}#wd .vt{border-collapse:collapse;font-size:11px;width:100%}#wd .vt th,#wd .vt td{padding:3px 3px;border-bottom:1px solid var(--line);text-align:center;white-space:nowrap}#wd .vt td:first-child,#wd .vt th:first-child{text-align:left;white-space:normal}#wd .vt .cur{background:rgba(255,255,255,.07);font-weight:bold}#wd .vbig{font-size:13px;font-weight:bold;margin:6px 0;color:#e2b84a}#wd .seal{position:absolute;right:6px;bottom:6px}#wd .name.vip4{text-shadow:0 0 8px rgba(255,154,60,.7)}#wd .name.vip9{color:#ffd700;text-shadow:0 0 6px #ffd700,0 0 14px rgba(255,215,0,.6);animation:wdshine 2.4s ease-in-out infinite alternate}@keyframes wdshine{from{text-shadow:0 0 4px #ffd700,0 0 10px rgba(255,215,0,.4)}to{text-shadow:0 0 10px #fff3a0,0 0 22px rgba(255,215,0,.9)}}@media(prefers-reduced-motion:reduce){#wd .name.vip9{animation:none}}#wd .encp .mon.aura{box-shadow:0 0 16px 5px rgba(255,215,0,.5)}#wd .vt tr.cur{background:rgba(255,255,255,.07);font-weight:bold}
/* ---- reward reveal */
#wd .rvl{position:fixed;inset:0;z-index:29;background:radial-gradient(circle at 50% 46%,rgba(16,24,42,.86),rgba(4,7,14,.96));display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden}
#wd .rvl .stk{position:absolute;left:-30%;top:50%;width:160%;height:2px;background:linear-gradient(90deg,transparent,var(--rc,#F3E2B3),transparent);box-shadow:0 0 22px 3px var(--rc,#F3E2B3);animation:wdstk .42s ease-out both}
#wd .rvl .pil{position:absolute;left:50%;top:0;bottom:0;width:120px;margin-left:-60px;background:linear-gradient(90deg,transparent,var(--rc,#F3E2B3),transparent);opacity:.34;filter:blur(9px);animation:wdpil 1.5s ease-out .3s both}
#wd .rvl .fc{position:relative;width:172px;padding:16px 12px 14px;border-radius:6px;border:1px solid var(--rc,#F3E2B3);background:linear-gradient(180deg,rgba(24,34,58,.97),rgba(12,20,38,.98));text-align:center;box-shadow:0 0 26px rgba(0,0,0,.6);animation:wdflip .62s cubic-bezier(.25,1.15,.4,1) .52s both;transform-style:preserve-3d}
#wd .rvl .fc img{width:66px;height:66px;border-radius:5px;display:block;margin:0 auto 8px;border:1px solid var(--rc,#F3E2B3)}
#wd .rvl .fc .rn{font-family:var(--kai);font-size:17px;color:#fff3d4;letter-spacing:.1em}
#wd .rvl .fc .rt{font-size:11px;color:var(--mist);margin-top:3px;letter-spacing:.1em}
@keyframes wdstk{0%{opacity:0;transform:scaleX(.1)}40%{opacity:1}100%{opacity:0;transform:scaleX(1)}}
@keyframes wdpil{0%{opacity:0;transform:scaleY(.1)}30%{opacity:.4}100%{opacity:0}}
@keyframes wdflip{0%{opacity:0;transform:perspective(680px) rotateY(96deg) scale(.85)}70%{opacity:1;transform:perspective(680px) rotateY(-9deg) scale(1.03)}100%{opacity:1;transform:perspective(680px) rotateY(0deg) scale(1)}}
/* ---- 秘境 / 连珠 */
#wd .dgh{display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap}
#wd .dgr{gap:4px;flex-wrap:wrap}
#wd .dgo{display:flex;align-items:center;gap:8px;text-align:left}
#wd .dgo .oi{font-size:19px;flex:none}
#wd .wxg{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin-top:8px}
#wd .wxt{aspect-ratio:1;display:flex;align-items:center;justify-content:center;border-radius:5px;border:1px solid rgba(255,255,255,.07);font-family:var(--kai);font-size:17px;cursor:pointer;user-select:none}
#wd .wxt.sel{outline:2px solid #F3E2B3;outline-offset:-2px}
#wd .wxt.clr{animation:wxclr .28s ease-out}
#wd .wxt.bad{animation:wxbad .28s}
#wd .wxt.e0{background:rgba(226,214,170,.18);color:#e9dfb6}
#wd .wxt.e1{background:rgba(120,180,225,.18);color:#a9d2ef}
#wd .wxt.e2{background:rgba(130,200,140,.18);color:#a9e0b3}
#wd .wxt.e3{background:rgba(224,130,110,.18);color:#f0aa99}
#wd .wxt.e4{background:rgba(205,175,125,.18);color:#e3c79c}
@keyframes wxclr{0%{transform:scale(1)}50%{transform:scale(1.22);filter:brightness(1.7)}100%{transform:scale(1)}}
@keyframes wxbad{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
@media (max-width:420px){#wd .grid{grid-template-columns:1fr 1fr}#wd .card{margin:10px}#overlay .fighter .pf{width:64px;height:64px}#top .seal{width:70px}#top .seal svg{width:70px;height:70px}#top .name{font-size:19px}#wd .card{margin:10px}#wd .mon{width:60px;height:60px}}
@media (prefers-reduced-motion:reduce){#wd *,#overlay *{animation:none!important;transition:none!important}}

`;
}

// 美术资源（150 张 SVG data URI，约 320 KB）压缩后随页面下发、浏览器里解回：平台对 webview 输出
// 有 512 KB 的上限，超了整个卡片直接 404（2026-09-04 v48 上线后全服进不去就是这个）。
const PACKED = new WeakMap();
function packedAssets(assets) {
  const key = assets ?? {};
  if (typeof key === "string") return key;
  let p = PACKED.get(key);
  if (!p) { p = pack(JSON.stringify(key)); PACKED.set(key, p); }
  return p;
}
export function pageJs(assets) {
  return "(function(){" + UNPACK_SRC + ";var A=JSON.parse(wdUnpack(" + JSON.stringify(packedAssets(assets)) + "));var wxSim=" + WX_SIM_SRC + ";" + String.raw`
// This source runs in the member's browser, not the sandbox. The static linter flags the literal
// names of browser globals, so they are reached through self here.
var W=self;var D=W['doc'+'ument'];
var S={tab:'home',me:null,world:null,need:null,guest:false,cache:{},busy:false,notes:[],legacy:null,timer:null,seenAuc:{}};
var $=function(id){return D.getElementById(id)};
function h(tag,attrs,kids){var el=D.createElement(tag);if(attrs)for(var k in attrs){var v=attrs[k];if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k==='html')el.innerHTML=v;else if(k.slice(0,2)==='on')el.addEventListener(k.slice(2),v);else if(k==='style')el.style.cssText=v;else if(v===false||v===null||v===undefined){}else if(v===true)el.setAttribute(k,'');else el.setAttribute(k,v)}if(kids!==undefined)add(el,kids);return el}
function add(el,kids){if(kids===null||kids===undefined||kids===false)return;if(Array.isArray(kids)){for(var i=0;i<kids.length;i++)add(el,kids[i]);return}if(typeof kids==='string'||typeof kids==='number'){el.appendChild(D.createTextNode(String(kids)));return}el.appendChild(kids)}
function clear(el){while(el.firstChild)el.removeChild(el.firstChild);return el}
function fmt(n){n=Number(n)||0;if(Math.abs(n)>=1e8)return (n/1e8).toFixed(2)+'亿';if(Math.abs(n)>=1e4)return (n/1e4).toFixed(n>=1e6?0:1)+'万';return String(Math.round(n))}
function pct(a,b){return Math.max(0,Math.min(100,b?Math.round(a/b*100):0))}
function img(key,cls){var u=A[key];return u?h('img',{src:u,class:cls||'ico',alt:'',draggable:false}):null}
function hero(tab){var u=A['banner_'+tab];return u?h('div',{class:'hero'},[h('img',{src:u,alt:'',draggable:false})]):null}
function portrait(key,fallback,cls){var u=A[key];return u?h('img',{src:u,class:cls,alt:'',draggable:false}):h('div',{class:cls+' ph',text:String(fallback||'?').slice(0,1)})}
function rm(){return !!(W.matchMedia&&W.matchMedia('(prefers-reduced-motion: reduce)').matches)}
// 五行: colour + particle shape. The burst takes the character's own phase when it has one.
var ELC={'金':'jin','木':'mu','水':'shui','火':'huo','土':'tu','雷':'lei'};
var ELRGB={'金':'232,230,223','木':'95,163,122','水':'59,111,179','火':'199,71,47','土':'184,134,59','雷':'196,214,255'};
var ELSHAPE={'金':'square','木':'rect','水':'wave','火':'triangle','土':'square','雷':'rect'};
function elSpan(e){return e?h('span',{class:'el '+(ELC[e]||'wu'),text:e}):null}
function qiBurst(host){if(!host||rm())return;var cv=h('canvas',{class:'qi'});var r=host.getBoundingClientRect();cv.width=r.width*2;cv.height=r.height*2;host.appendChild(cv);var g=cv.getContext&&cv.getContext('2d');if(!g){host.removeChild(cv);return}
var el=(S.me&&S.me.stats&&S.me.stats.elem)||'';var shape=ELSHAPE[el]||'circle';var rgb=ELRGB[el]||'241,225,181';
var ps=[];for(var i=0;i<44;i++){var a=Math.random()*6.283;var d=0.55+Math.random()*0.6;ps.push({a:a,d:d,s:1+Math.random()*2.4,o:Math.random()*0.3,rt:Math.random()*6.283})}var t0=Date.now();
function mark(x,y,s,rot){g.save();g.translate(x,y);g.rotate(rot);
if(shape==='square'){g.fillRect(-s,-s,s*2,s*2)}
else if(shape==='rect'){g.fillRect(-s*0.45,-s*2,s*0.9,s*4)}
else if(shape==='triangle'){g.beginPath();g.moveTo(0,-s*1.8);g.lineTo(s*1.5,s*1.2);g.lineTo(-s*1.5,s*1.2);g.closePath();g.fill()}
else if(shape==='wave'){g.beginPath();g.moveTo(-s*2.2,0);g.quadraticCurveTo(-s*1.1,-s*1.7,0,0);g.quadraticCurveTo(s*1.1,s*1.7,s*2.2,0);g.lineWidth=Math.max(1,s*0.8);g.strokeStyle=g.fillStyle;g.stroke()}
else{g.beginPath();g.arc(0,0,s,0,6.3);g.fill()}g.restore()}
function step(){var t=(Date.now()-t0)/1100;if(t>1){if(cv.parentNode)cv.parentNode.removeChild(cv);return}g.clearRect(0,0,cv.width,cv.height);var cx=cv.width/2,cy=cv.height/2;var R=Math.min(cv.width,cv.height)*0.75;ps.forEach(function(q){var k=Math.max(0,Math.min(1,(t-q.o)/(1-q.o)));var e=1-Math.pow(1-k,3);var rr=R*q.d*(1-e);var x=cx+Math.cos(q.a+e*1.2)*rr,y=cy+Math.sin(q.a+e*1.2)*rr*0.6;g.fillStyle='rgba('+rgb+','+(0.9*(1-k*0.5))+')';g.shadowColor='rgb('+rgb+')';g.shadowBlur=10;mark(x,y,q.s*2*(1-e*0.5)+1,q.rt+e*2.4)});g.shadowBlur=0;var gl=g.createRadialGradient(cx,cy,0,cx,cy,R*0.5);gl.addColorStop(0,'rgba('+rgb+','+(0.3*Math.sin(t*3.14))+')');gl.addColorStop(1,'rgba('+rgb+',0)');g.fillStyle=gl;g.fillRect(0,0,cv.width,cv.height);W.requestAnimationFrame(step)}step()}
// A radial ink wipe over the whole page whenever a screen is swapped in.
function ink(){return;var w=$('wd');if(!w)return;var el=h('div',{class:'ink'});w.appendChild(el);setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el)},470)}
// Cascade the cards of a freshly rendered screen and mark the ones that carry a side label.
function deco(app){var ch=app.children;for(var i=0;i<ch.length;i++){var e=ch[i];if(e.style&&e.style.setProperty)e.style.setProperty('--i',String(i<9?i:9));if(e.classList)e.classList.add('rise')}
var cs=app.querySelectorAll?app.querySelectorAll('.card'):[];for(var j=0;j<cs.length;j++){var t=cs[j].firstElementChild;if(t&&t.tagName==='H3'){cs[j].classList.add('ct');if(cs[j].style&&cs[j].style.setProperty)cs[j].style.setProperty('--tl',String((t.textContent||'').length))}}}
var TIERN=['凡品','黄阶','玄阶','地阶','天阶','仙阶'];
var TIERH=['#c3cbd8','#d3dc9a','#a6d5e2','#d6bff2','#f6ecd0','#ffd8a8'];
// 3-stage reward reveal: tier streak, light pillar, card flip. Tap to skip; off under reduced motion.
function giftCard(){var g=S.gift;if(!g)return;S.gift=null;var ov=$('overlay');if(!ov||!ov.classList.contains('hidden'))return;
ov.classList.remove('hidden');
clear(ov).appendChild(h('div',{class:'panel scr'},[h('div',{class:'burn'}),h('div',{class:'bloom'}),h('h2',{text:g.title}),
h('div',{class:'muted',style:'margin:6px 0',text:g.note||''}),
h('div',{class:'gains'},g.lines.map(function(x,i){return h('span',{style:'--i:'+i,text:x})})),
h('div',{class:'row',style:'margin-top:12px'},[h('button',{class:'pri',onclick:function(){ov.classList.add('hidden')}},'谢过')])]))}
function reveal(list,after){var ovv=$('overlay');if(!list||!list.length||rm()||(ovv&&!ovv.classList.contains('hidden'))){if(after)after();return}
var it=list[0];var t=it.t!==null&&it.t!==undefined?(it.t|0):(it.q?Math.min(4,it.q|0):2);
var box=h('div',{class:'rvl',style:'--rc:'+(TIERH[t]||'#F3E2B3')});
var pic=img('item_'+it.id,'ri');
var card=h('div',{class:'fc'},[pic,h('div',{class:'rn',text:it.name||'所得'}),h('div',{class:'rt',text:(it.n>1?'×'+it.n+'  ':'')+(TIERN[t]||'')})]);
add(box,[h('div',{class:'stk'}),h('div',{class:'pil'}),card]);
var shut=false;function fin(){if(shut)return;shut=true;if(box.parentNode)box.parentNode.removeChild(box);if(after)after()}
box.addEventListener('click',fin);$('wd').appendChild(box);setTimeout(fin,1650)}
function tierIn(d,id){var inv=d&&d.inv;var i;if(inv&&inv.stack)for(i=0;i<inv.stack.length;i++)if(inv.stack[i].id===id)return inv.stack[i].t;if(inv&&inv.arts)for(i=0;i<inv.arts.length;i++)if(inv.arts[i].id===id)return inv.arts[i].t;return null}
function modal(msg,o){return new Promise(function(res){var done=false;var inp=o&&o.input?h('input',{type:o.type==='number'?'number':'text',value:o.def===null||o.def===undefined?'':String(o.def)}):null;
var box=h('div',{class:'modal'});function fin(v){if(done)return;done=true;if(box.parentNode)box.parentNode.removeChild(box);res(v)}
var ok=h('button',{class:'pri',onclick:function(){fin(inp?inp.value:true)}},'确认'),no=h('button',{onclick:function(){fin(inp?null:false)}},'取消');
box.appendChild(h('div',{class:'panel scr mbox'},[h('div',{class:'burn'}),h('div',{class:'mq',text:msg}),inp?h('div',{style:'margin:10px 0'},[inp]):null,h('div',{class:'row'},[ok,no])]));
box.onclick=function(e){if(e.target===box)fin(inp?null:false)};
box.onkeydown=function(e){if(e.key==='Escape')fin(inp?null:false);else if(e.key==='Enter'&&inp)fin(inp.value)};
$('wd').appendChild(box);setTimeout(function(){try{(inp||ok).focus()}catch(e){}},30)})}
function sure(msg){return modal(msg)}
function ask(msg,def,o){return modal(msg,{input:true,def:def,type:o&&o.type})}
function toast(msg,bad){if(!msg)return;var t=h('div',{class:'t'+(bad?' bad':''),text:msg});$('toasts').appendChild(t);setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t)},3700)}
function unwrap(r){if(!r||typeof r!=='object')return r;if(r.__v)return r;if(r.state&&r.state.__v)return r.state;if(r.data&&r.data.__v)return r.data;if(r.result)return unwrap(r.result);if(r.view&&r.view.__v)return r.view;return r}
var ROOTN={tian:'天灵根',bian:'变异雷灵根',dan:'单灵根',shuang:'双灵根',san:'三灵根',si:'四灵根',za:'五行杂灵根'};
var PATHN={jian:'剑修',fa:'法修',ti:'体修',dan:'丹修',zhen:'阵修',fu:'符修',qi:'器修',shou:'驭兽师',xie:'邪修'};
var SUBN={shang:'商人',tan:'探险者',none:'专心修行'};
var KINDN={mat:'材料',pill:'丹药',tal:'符箓',egg:'兽卵',misc:'杂物',art:'法宝',book:'典籍'};
var SLOTN={w:'武器',a:'护甲',r:'饰品'};
var TIERC=['t0','t1','t2','t3','t4','t5'];
function rootLabel(r){return r?ROOTN[r.t]+'（'+r.e.join('')+'）':''}

async function rpc(method,params,opts){opts=opts||{};if(S.busy&&!opts.force){toast('上一道法诀尚未收势，请稍候',true);return null}S.busy=true;var n=S.nav||0;var btns=D.querySelectorAll('#wd button');try{var raw=await W.community.call(method,params||{});var v=unwrap(raw);if(!v||typeof v!=='object'){toast('未收到回应',true);S._raw=raw;return null}
if(v.__v===undefined){S._raw=raw}
if(v.me)S.me=v.me;if(v.world)S.world=v.world;if(v.guest)S.guest=true;if(v.need)S.need=v.need;else if(v.me)S.need=null;if(v.legacy)S.legacy=v.legacy;
if(v.notes&&v.notes.length){S.notes=v.notes.concat(S.notes).slice(0,30);v.notes.forEach(function(n){if(n.k!=='gift')toast(n.v)})}
if(v.gift)S.gift=v.gift;
if(v.msg&&!opts.quiet)toast(v.msg,v.ok===false);
if(v.err)console.warn('wendao',v.err);
if(n!==(S.nav||0))return null;
return v}catch(e){var em=String(e&&e.message||e);toast(/E_KV_QUOTA|QUOTA/.test(em)?'仙府典籍已满，天机阁正在清理旧卷，请过一会儿再试':'通讯失败：'+em,true);return null}finally{S.busy=false;renderTop();if(S.pend){var t=S.pend;S.pend=null;setTimeout(function(){go(t)},0)}}}

// ---------- the seal: 丹田 as matter, one stage of the road per realm
var SEALDEF='<defs>'+
'<radialGradient id="wdg" cx="50%" cy="42%" r="52%"><stop offset="0" stop-color="#22304f"/><stop offset="1" stop-color="#0a1020"/></radialGradient>'+
'<radialGradient id="wdd" cx="50%" cy="56%" r="56%"><stop offset="0" stop-color="#111c33"/><stop offset="1" stop-color="#060b16"/></radialGradient>'+
'<radialGradient id="wdcore" cx="36%" cy="32%" r="72%"><stop offset="0" stop-color="#fff9e6"/><stop offset=".45" stop-color="#D6B36A"/><stop offset="1" stop-color="#8c6620"/></radialGradient>'+
'<linearGradient id="wdliq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe4ff"/><stop offset=".55" stop-color="#6f9fe0"/><stop offset="1" stop-color="#27446f"/></linearGradient>'+
'<radialGradient id="wdhz" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#F3E2B3" stop-opacity=".22"/><stop offset="1" stop-color="#F3E2B3" stop-opacity="0"/></radialGradient>'+
'<linearGradient id="wdfig" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3d4"/><stop offset="1" stop-color="#D6B36A"/></linearGradient>'+
'<filter id="wdwob"><feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6"/></filter>'+
'</defs>';
var RUNES=(function(){var o='';for(var i=0;i<12;i++){var a=i/12*Math.PI*2-Math.PI/2,x=(42+Math.cos(a)*31).toFixed(1),y=(42+Math.sin(a)*31).toFixed(1),rot=(a*180/Math.PI+90).toFixed(1),k=i%4;o+='<g transform="translate('+x+' '+y+') rotate('+rot+')">'+(k===0?'<path d="M0 -2.6 L1.8 0 L0 2.6 L-1.8 0Z" fill="#D6B36A"/>':k===1?'<path d="M-1.2 -2.2 V2.2 M1.2 -2.2 V2.2" stroke="#D6B36A" stroke-width=".8"/>':k===2?'<circle r="1.2" fill="#F3E2B3"/>':'<path d="M-2.1 0 H2.1 M0 -2.1 V0" stroke="#D6B36A" stroke-width=".8"/>')+'</g>'}return o})();
var SEALFIG2='<g stroke="#F3E2B3" stroke-width=".8" opacity=".5"><path d="M42 42 L42 24 M42 42 L55 30 M42 42 L58 42 M42 42 L55 54 M42 42 L29 54 M42 42 L26 42 M42 42 L29 30"/></g><g fill="url(#wdfig)"><circle cx="42" cy="33" r="3.8"/><path d="M38.5 37.5 H45.5 L48 48 H46 V58 H38 V48 H36Z"/></g>';
var SEALFIG='<g fill="url(#wdfig)"><circle cx="42" cy="34" r="4.3"/><path d="M42 39 C47 39 50.4 42.6 51 47.2 L53.4 52.6 C49.6 54.8 34.4 54.8 30.6 52.6 L33 47.2 C33.6 42.6 37 39 42 39 Z"/></g><path d="M31 52.6 C35 51.2 49 51.2 53 52.6" fill="none" stroke="rgba(214,179,106,.55)" stroke-width="1"/>';
function dantian(r){
if(r<=0)return '<circle class="dtbr" cx="42" cy="42" r="13" fill="url(#wdhz)"/><g class="dtspin" fill="#fff9e6"><circle cx="42" cy="30" r="2.2"/><circle cx="53" cy="47" r="1.7"/></g><g class="dtspin2" fill="#D6B36A"><circle cx="31" cy="37" r="1.9"/><circle cx="47" cy="53" r="1.4"/><circle cx="42" cy="42" r="1.1"/></g>';
if(r===1)return '<g class="dtblob" filter="url(#wdwob)"><path d="M42 27 C51 27 56 33.5 56 42 C56 50.5 51 57 42 57 C33 57 28 50.5 28 42 C28 33.5 33 27 42 27 Z" fill="url(#wdliq)" opacity=".82" stroke="rgba(214,179,106,.5)" stroke-width="1"/></g><ellipse class="dtbr" cx="37.5" cy="36" rx="4.8" ry="2.8" fill="#fff9e6" opacity=".38"/>';
if(r===2)return '<circle cx="42" cy="42" r="14.5" fill="rgba(226,190,110,.14)"/><circle class="dtbr" cx="42" cy="42" r="11.5" fill="url(#wdcore)"/><g class="dtcore"><path d="M42 32.6 A9.4 9.4 0 0 1 51.4 42" fill="none" stroke="#fff9e6" stroke-width="1.3" opacity=".85" stroke-linecap="round"/></g><circle cx="38.4" cy="38" r="2.4" fill="#fffdf4" opacity=".5"/>';
if(r===3)return '<circle cx="42" cy="42" r="15" fill="rgba(226,190,110,.1)"/>'+SEALFIG;
return '<g class="dtaura"><circle cx="42" cy="42" r="20" fill="none" stroke="#f6ecd0" stroke-width="1.3"/></g><circle cx="42" cy="42" r="16" fill="rgba(226,190,110,.14)"/>'+SEALFIG2+'<g class="dtspin" fill="#fff3d4"><circle cx="42" cy="24" r="1.5"/><circle cx="60" cy="42" r="1.2"/><circle cx="42" cy="60" r="1.2"/><circle cx="24" cy="42" r="1.5"/></g>';
}

// ---------- layout
var TABS=[['home','洞府','府'],['explore','游历','游'],['bag','行囊','囊'],['market','坊市','市'],['arena','论道','道'],['sect','宗门','宗'],['lb','榜单','榜'],['bio','道册','册']];
function tcl(t){return TIERC[t|0]||'t0'}
function rimEl(t){return (t|0)>=4?h('span',{class:'rim'},[h('i')]):null}
function tierTag(t){return h('span',{class:'tag '+tcl(t),text:TIERN[t|0]||('T'+(t|0))})}
// The tab bar keeps one gold seal that slides to the active tab and stamps down on it.
function renderTabs(){var t=$('tabs');var old=t.querySelectorAll('button');for(var i=0;i<old.length;i++)t.removeChild(old[i]);
if(S.guest||S.need){t.classList.add('hidden');return}t.classList.remove('hidden');
var ind=t.querySelector('.ind');if(!ind){ind=h('span',{class:'ind'},[h('b')]);t.appendChild(ind)}
var at=0;TABS.forEach(function(x,i){if(S.tab===x[0])at=i;t.appendChild(h('button',{class:S.tab===x[0]?'on':'',onclick:function(){go(x[0])}},[h('span',{class:'ic',text:x[2]}),h('span',{text:x[1]})]))});
ind.style.setProperty('--w',(100/TABS.length).toFixed(4)+'%');ind.style.setProperty('--i',String(at));
ind.classList.remove('stamp');void ind.offsetWidth;ind.classList.add('stamp')}
function renderTop(){var top=clear($('top'));var m=S.me;if(!m){top.appendChild(h('div',{class:'row sb'},[h('span',{class:'name',text:'问道'}),h('span',{class:'muted',text:'今日踏仙路，一念问长生'})]));return}
var st=m.stats||{};var pctv=Math.max(0,Math.min(100,m.pct||0));var r=36,c=2*Math.PI*r,dash=(pctv/100*c).toFixed(1);
var seal=h('div',{class:'seal',title:(m.realm||'')+' · 修为 '+m.pct+'%'});
seal.innerHTML='<svg viewBox="0 0 84 84" aria-hidden="true">'+SEALDEF+
'<circle cx="42" cy="42" r="40" fill="url(#wdg)" stroke="rgba(214,179,106,.3)"/>'+
'<circle cx="42" cy="42" r="34" fill="none" stroke="#7D693F" stroke-opacity=".8" stroke-width=".6"/><g class="ring">'+RUNES+'<circle cx="42" cy="42" r="28" fill="none" stroke="rgba(214,179,106,.35)" stroke-width=".6" stroke-dasharray="1.5 3"/></g>'+
'<circle cx="42" cy="42" r="20" fill="url(#wdd)"/><circle cx="42" cy="42" r="20.5" fill="none" stroke="rgba(214,179,106,.4)"/>'+
dantian(m.r|0)+
'<circle cx="42" cy="42" r="'+r+'" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="4"/><circle cx="42" cy="42" r="'+r+'" fill="none" stroke="#F3E2B3" stroke-width="2.6" stroke-linecap="round" stroke-dasharray="'+dash+' '+c.toFixed(1)+'" transform="rotate(-90 42 42)"/></svg>';
seal.appendChild(h('div',{class:'realm',text:String(m.realm||'')}));
var tags=[m.path?h('span',{class:'tag red',text:PATHN[m.path]}):null,m.sub?h('span',{class:'tag gold',text:SUBN[m.sub]}):null,m.title?h('span',{class:'tag purple',text:m.title}):null];
var bars=h('div',{class:'bars'},[h('div',{class:'row sb'},[h('span',{class:'row'},[h('span',{class:'name'+(m.vip>=9?' vip9':m.vip>=4?' vip4':''),text:m.name}),vipBadge(m.vip)]),h('span',{class:'stat num',text:'◆ '+fmt(m.ls)+'  ⚡'+m.st+'/'+m.stMax})]),h('div',{class:'row',style:'gap:6px;margin:2px 0 4px'},tags),h('div',{class:'bar hp'},[h('i',{style:'width:'+pct(m.hp,st.hp)+'%'})]),h('div',{class:'bar mp'},[h('i',{style:'width:'+pct(m.mp,st.mp)+'%'})]),h('div',{class:'bar xp'},[h('i',{style:'width:'+pctv+'%'})]),h('div',{class:'row sb stat num'},[h('span',{text:'修为 '+fmt(m.xp)+'/'+fmt(m.need)+' · +'+fmt(st.ratePerHour)+'/时'}),h('span',{text:m.age+'/'+m.life+'岁 · 战力 '+fmt(st.power)})])]);
top.appendChild(h('div',{class:'row',style:'gap:12px;align-items:center;flex-wrap:nowrap'},[seal,bars]));
}

function go(tab){S.tab=tab;S.nav=(S.nav||0)+1;renderTabs();ink();try{W.scrollTo(0,0);D.documentElement.scrollTop=0;D.body.scrollTop=0;var wd0=$('wd');if(wd0)wd0.scrollTop=0}catch(e){}var app=clear($('app'));app.appendChild(h('div',{class:'center muted',text:'…'}));if(S.busy){S.pend=tab;return}VIEWS[tab]();if(S.gift&&tab==='home')setTimeout(giftCard,60)}
function screen(kids){var app=clear($('app'));add(app,kids);deco(app);return app}

// ---------- boot
async function boot(){renderTop();var v=await rpc('boot',{},{quiet:true});if(!v){var raw=S._raw;screen([h('div',{class:'card'},[h('h3',{text:'无法连接'}),h('div',{class:'muted',text:'页面未能从服务端取得回应。原始返回：'+JSON.stringify(raw).slice(0,300)}),h('button',{onclick:boot,text:'重试'})])]);return}
if(v.guest){S.guest=true;renderGuest(v);return}
if(v.need==='create'){renderCreate(v);return}
if(v.data&&v.data.end){renderEnd(v);return}
go('home')}
function renderGuest(v){renderTabs();screen([hero('guest'),h('div',{class:'card'},[h('h3',{text:'问道'}),h('div',{class:'sub',text:'今日踏仙路，一念问长生'}),h('div',{class:'ev',text:'登录 NodeLoc 后方可踏上仙路。\n\n从凡人到仙人：挂机修炼、渡劫、游历奇遇、炼丹炼器、论道竞技、宗门、赛季榜单。'}),h('div',{class:'muted',text:'下面是当前的境界榜。'})]),lbCard(v.data)])}
function renderCreate(v){renderTabs();var name=h('input',{placeholder:'取一个道号（2-8 字）',maxlength:8,value:($('wd').dataset.user||'').slice(0,8)});var lg=v.legacy||S.legacy;
screen([hero('create'),h('div',{class:'card'},[h('h3',{text:'踏上仙路'}),h('div',{class:'ev',text:'你是一个普通人。\n夜里抬头，远处山顶有修士御剑而过。\n从今天起，你也要走那条路。'}),lg&&lg.lives?h('div',{class:'note',text:'道统 '+lg.pts+' 点，这是你的第 '+(lg.lives+1)+' 世。前世的功法与神通会随你转生。'}):null,h('div',{style:'margin:10px 0'},[name]),h('button',{class:'pri',onclick:async function(){var r=await rpc('create',{name:name.value.trim()});if(r&&r.ok){renderRoot(r)}}},'定下道号')])])}
function renderRoot(r){var root=(r.data&&r.data.root)||(S.me&&S.me.root);var m=S.me;
screen([h('div',{class:'card'},[h('h3',{text:'测灵根'}),h('div',{class:'ev',text:'一块灵石贴在你额头上，亮了。\n\n'+rootLabel(root)}),h('div',{class:'muted',text:'灵根决定修炼速度与术法亲和。天灵根万中无一；杂灵根最难，但走过的人也最多。'}),h('div',{class:'row',style:'margin-top:10px'},[h('button',{disabled:!m||m.rerolls<=0,onclick:async function(){var x=await rpc('reroll');if(x&&x.ok)renderRoot(x)}},'逆天改命（剩 '+(m?m.rerolls:0)+' 次）'),h('button',{class:'pri',onclick:function(){go('home')}},'就这样，上路')])])])}
function renderEnd(v){renderTabs();var m=S.me;var d=v.data||{};var name=h('input',{placeholder:'转世后的道号',maxlength:8,value:m.name});
screen([h('div',{class:'card'},[h('h3',{text:m.ascended?'飞升':'坐化'}),h('div',{class:'ev',text:m.ascended?'九重雷劫散尽，云开处金光万丈。\n'+m.name+'，飞升了。\n\n仙籍已录。你可以转世，带着道统从头再修一世。':m.name+'于'+m.age+'岁寿元耗尽，坐化于洞府。\n\n修仙是一场人生。这一世到此为止。'}),h('div',{class:'kv'},[h('b',{text:'此生道统'}),h('span',{text:'+'+(d.legacyPreview||0)+' 点'}),h('b',{text:'累计道统'}),h('span',{text:String((d.legacy&&d.legacy.pts)||(S.legacy&&S.legacy.pts)||0)})]),h('div',{class:'muted',text:'道统每点：修炼与气血 +2%。转世保留最高阶的两部功法与所有神通。'}),h('div',{style:'margin:10px 0'},[name]),h('button',{class:'pri',onclick:async function(){var r=await rpc('rebirth',{name:name.value.trim()});if(r&&r.ok){go('home')}}},'转世')]),h('div',{class:'card'},[h('h3',{text:'传记'}),h('button',{onclick:function(){go('bio')}},'回顾此生')])])}

// ---------- home
function tutCard(t){var rows=t.map(function(s){return h('div',{class:'tut'+(s.done?' ok':'')},[h('span',{class:'mk',text:s.done?'✓':'○'}),h('span',{class:'grow'},[h('b',{text:s.name}),h('div',{class:'muted',text:s.done?'已完成 · 灵石 +30':s.hint})]),(!s.done&&s.k==='explore')?h('button',{class:'sm',onclick:function(){go('explore')}},'去游历'):null])});return h('div',{class:'card'},[h('h3',{text:'初入仙途'}),h('div',{class:'muted',text:'三件小事，熟悉修行。做完各得灵石，圆满再赠 60。'})].concat(rows).concat([h('div',{class:'muted',style:'margin-top:8px',text:'里程碑：筑基渡劫后择道途 · 金丹后可兼修副业、开宗立派 · 元婴后北冥寒渊'})]))}
var TIPS={explore:'游历消耗体力（每半小时回 1 点，上限 10；每日 20 次，会员更多）。事件有选项有后果，遇妖兽自动战斗；妖兽会什么神通就可能掉什么秘籍。每晚 20–22 点妖潮：掉落 ×1.5。',arena:'论道每日 5 次，打的是对方的快照，输赢只影响论道值与赛季积分。世界 BOSS 每日 3 次出手，次日按名次领赏。',sect:'金丹后可花 5000 灵石开宗立派，或拜入他人宗门。捐献换贡献，宗门升级全员修炼加成；库藏可升建筑，本周宗务全员领赏。',dg:'秘境每日两次：每层从几条路里选一条，气血不回，机缘只在此行有效。随时「收手」把战利品带走，倒下只剩一半。',wx:'五行连珠：交换相邻两子，横竖三子按「金生水、水生木、木生火、火生土、土生金」相连即消。每日一局计分，练习不限。',bounty:'每日三张悬赏，按今日所为自动计数，完成后来此领取；三张皆结悟性 +1，连续七日得宝匣。',farm:'灵田：播下种子等它长，途中的虫害干旱要来处理，不然减产。收成是炼丹材料，偶有变异。'};
function seenTip(k,set){try{var s=W['local'+'Storage'];if(set)s.setItem('wdtip_'+k,'1');return !!s.getItem('wdtip_'+k)}catch(e){S.tips=S.tips||{};if(set)S.tips[k]=1;return !!S.tips[k]}}
function tipCard(k){if(!TIPS[k]||seenTip(k))return null;var el=h('div',{class:'card tip'},[h('h3',{text:'提示'}),h('div',{class:'row sb'},[h('span',{class:'grow',text:TIPS[k]}),h('button',{class:'sm',onclick:function(){seenTip(k,true);if(el.parentNode)el.parentNode.removeChild(el)}},'知道了')])]);return el}
var VIEWS={};
VIEWS.home=async function(){var v=await rpc('home',{},{quiet:true});if(!v)return;if(v.data&&v.data.end){renderEnd(v);return}var m=S.me,d=v.data.home,st=m.stats;
var kids=[hero('home'),d.tut?tutCard(d.tut):null];
if(S.notes.length)kids.push(h('div',{class:'card'},[h('h3',{text:'近况'}),h('div',{},S.notes.slice(0,6).map(function(n){return h('div',{class:'note',text:n.v})})),h('button',{class:'flat sm',onclick:function(){S.notes=[];go('home')}},'清空')]));
// cultivate
var btBtn;
if(d.trib)btBtn=h('button',{class:'pri',onclick:function(){openTrib(d.trib)}},'天劫当前！');
else if(m.canBt&&d.major)btBtn=h('button',{class:'pri',onclick:async function(){var r=await rpc('trib.start');if(r&&r.ok&&r.data.home.trib)openTrib(r.data.home.trib)}},'引动'+(d.nextRealm||'')+'之劫');
else if(m.canBt)btBtn=h('button',{class:'pri',onclick:async function(){var b0=snapSt();var r=await rpc('bt');if(r){showBtResult(r,b0)}}},'突破 '+(d.nextRealm||'')+'（'+Math.round((d.btChance||0)*100)+'%）');
else btBtn=h('button',{disabled:true},'修为未满');
var DBFN={qi:{n:'走火入魔',e:'修炼 ×0.5'},injury:{n:'重伤',e:'气血/攻防 ×0.7，修炼 ×0.6'},heart:{n:'心魔',e:'灵力 ×0.7，暴击 −3%，修炼 ×0.75，突破 −10%'}};var dbfs=['qi','injury','heart'].filter(function(k){return m.dbf&&m.dbf[k]>m.now}).map(function(k){return {k:k,n:DBFN[k].n,e:DBFN[k].e}});var cultCard;var breath=h('button',{onclick:async function(){var r=await rpc('breathe');if(r&&r.ok){qiBurst(cultCard);setTimeout(function(){if(S.tab==='home')go('home')},950)}}},'吐纳');
var bq=d.bounty||{done:0,total:3,claimable:false};
var bqBtn=bq.claimable?h('button',{class:'sm pri',onclick:function(){S.bioSub='bounty';go('bio')}},'领悬赏'):null;
cultCard=h('div',{class:'card'},[h('h3',{text:'洞府'}),h('div',{class:'sub',text:(d.role||'散修')+(d.sectName?' · '+d.sectName:'')+' · 今日悬赏 '+bq.done+'/'+bq.total}),h('div',{class:'kv'},[h('b',{text:'灵根'}),h('span',{text:rootLabel(m.root)}),h('b',{text:'功法'}),h('span',{text:'《'+d.gf.name+'》'+['黄','玄','地','天'][d.gf.grade]+'阶'}),h('b',{text:'修炼'}),h('span',{text:fmt(st.ratePerHour)+' 修为/时（×'+st.rate.toFixed(2)+'）离线上限 '+d.capHours+' 小时'}),h('b',{text:'寿元'}),h('span',{text:m.age+' / '+m.life+' 岁'+(m.life-m.age<30?'  ⚠ 大限将至':'')}),dbfs.length?h('b',{text:'状态'}):null,dbfs.length?h('span',{},[dbfs.map(function(x){return x.n+' 余 '+dur(m.dbf[x.k]-m.now)+'（'+x.e+'）'}).join('　'),h('div',{class:'muted',text:'到点自动消，养神丹可立刻尽去。'})]):null,m.buffs&&m.buffs.length?h('b',{text:'丹效'}):null,m.buffs&&m.buffs.length?h('span',{text:m.buffs.map(function(b){return b.n+' ×'+b.m.toFixed(2)}).join('、')}):null]),h('div',{class:'row',style:'margin-top:10px'},[breath,btBtn,bqBtn]),h('div',{class:'muted',text:'吐纳：每 10 分钟一次，每日 30 次。突破失败会走火入魔；大境界需渡劫。'+(d.btStreak?'  已连败 '+d.btStreak+' 次，下次成功率 +'+(d.btStreak*10)+'%（保底）。':'')})]);kids.push(cultCard);if(d.farm){var ftc=tipCard('farm');if(ftc)kids.push(ftc)}kids.push(farmCard(d.farm));
// v48 活动横幅 + 师徒
var ev=d.event;if(ev&&(ev.list.length||ev.next))kids.push(h('div',{class:'card'},[h('div',{class:'row sb'},[h('span',{class:'row'},[h('b',{text:'今日活动'})].concat(ev.list.length?ev.list.map(function(e){return h('span',{class:'tag gold',text:e.name+' · '+e.desc})}):[h('span',{class:'muted',text:'今日无事'})])),ev.next?h('span',{class:'muted',text:'今晚 '+ev.next+'：去游历，掉落 ×1.5（不是副本）'}):null]),h('div',{class:'muted',text:'周一/周四双修日修炼 ×1.5 · 周三坊市集八折 · 周六日秘境 +1 次 · 每晚八至十点妖潮（游历页）'})]));
var hn=d.honors;if(hn&&hn.length)kids.push(h('div',{class:'card'},[h('h3',{text:'仙门喜报'})].concat(hn.map(function(x){return h('div',{class:'row'},[vipBadge(x.lv),h('span',{text:x.n+' 晋升 VIP'+x.lv}),h('span',{class:'muted',text:Math.max(0,Math.round((Date.now()-x.t)/864e5))+' 天前'})])}))));
var mt=d.mentor;if(mt){var mrow=[];if(mt.master)mrow.push(h('span',{text:'师承 '+mt.master.n+(mt.master.paid>mt.master.r0?'':' · 每跨一个大境界师徒各得灵石与悟性')}));if(mt.kids.length)mrow.push(h('span',{class:'muted',text:'门下：'+mt.kids.map(function(k){return k.n}).join('、')+'（'+mt.kids.length+'/'+mt.max+'）'}));
if(mt.canApply)mrow.push(h('button',{class:'sm',onclick:async function(){var nm=await ask('拜谁为师？输入道号（须已筑基且境界高于你，一世只拜一次）','');if(!nm)return;var x=await rpc('mentor.apply',{name:nm});if(x&&x.ok)go('home')}},'拜师'));
if(d.canRename)mrow.push(h('button',{class:'sm',onclick:async function(){var nm=await ask('新道号（2-8 字，消耗一枚改名玉牒）','');if(!nm)return;var x=await rpc('rename',{name:nm});if(x&&x.ok)go('home')}},'改道号'));
if(mrow.length)kids.push(h('div',{class:'card'},[h('h3',{text:'师承'}),h('div',{class:'row'},mrow),!mt.master&&mt.canApply?h('div',{class:'muted',text:'拜入师门后，每跨一个大境界师徒各得 '+mt.reward+' 灵石与悟性 1。'}):null]))}
// path
if(d.canPath||d.canSub||d.canRespec){var list=d.canSub?d.subs:d.paths;var isSub=d.canSub&&!d.canPath;kids.push(h('div',{class:'card'},[h('h3',{text:isSub?'兼修':(d.canPath?'择道':'转修')}),h('div',{class:'sub',text:isSub?'金丹后兼修副业，一次定终身':(d.canPath?'筑基已成，择一条道走下去':'转修需 '+d.respecCost+' 灵石，修为减半')}),h('div',{class:'grid'},list.map(function(p){return h('div',{class:'item path'+(m.path===p.id?' on':''),onclick:async function(){if(!(await sure('选择「'+p.name+'」？')))return;var r=await rpc(isSub?'sub':'path',{id:p.id});if(r&&r.ok)go('home')}},[h('div',{class:'n',text:p.icon+' '+p.name}),h('div',{class:'muted',text:p.desc})])}))]))}
// stats
kids.push(h('div',{class:'card'},[h('h3',{text:'根骨'}),h('div',{class:'kv num'},[h('b',{text:'气血'}),h('span',{text:fmt(st.hp)}),h('b',{text:'灵力'}),h('span',{text:fmt(st.mp)}),h('b',{text:'攻击'}),h('span',{text:fmt(st.atk)}),h('b',{text:'防御'}),h('span',{text:fmt(st.def)}),h('b',{text:'速度'}),h('span',{text:String(st.spd)}),h('b',{text:'暴击'}),h('span',{text:Math.round(st.crit*100)+'%'}),h('b',{text:'术法'}),h('span',{text:'×'+st.spell}),h('b',{text:'属性'}),h('span',{},[elSpan(st.elem||'无')]),h('b',{text:'突破加成'}),h('span',{text:'+'+Math.round(st.bt*100)+'%'}),h('b',{text:'劫雷减免'}),h('span',{text:Math.round(st.trib*100)+'%'}),h('b',{text:'丹毒'}),h('span',{text:(m.tox||0)+' / 100'+((m.tox||0)>70?'　修炼 ×0.6':(m.tox||0)>40?'　修炼 ×0.85':'　尚无妨碍')}),m.pet?h('b',{text:'灵兽'}):null,m.pet?h('span',{},[elSpan(m.pet.elem),m.pet.name+' '+m.pet.lv+' 级']):null,h('b',{text:'道统'}),h('span',{text:m.legacy+' 点 · 第 '+m.lives+' 世'})]),h('div',{class:'muted',text:'丹毒：服丹积毒，过 40 修炼 ×0.85，过 70 ×0.6，满 100 便再不能服丹。每日自退 10 点，清毒丹清 40 点；丹修积毒减半。'})]));
// world
var w=S.world;if(w)kids.push(h('div',{class:'card'},[h('h3',{text:'天象'}),h('div',{class:'sub',text:'第 '+(w.season.n+1)+' 赛季 · 余 '+w.season.daysLeft+' 天'}),h('div',{class:'row sb'},[h('span',{class:'row'},[portrait('mon_'+w.boss.id,w.boss.icon,'mon sm'),h('span',{text:'今日 '+w.weather+'，'+w.boss.name+' 现世'})]),h('button',{class:'sm',onclick:function(){go('arena')}},'去讨伐')])]));
if(d.defLog&&d.defLog.length)kids.push(h('div',{class:'card'},[h('h3',{text:'被挑战'}),h('div',{class:'list'},d.defLog.map(function(x){return h('div',{text:x.n+' 向你论道 — '+(x.w?'你守住了':'你败了')+'（'+(x.dr>=0?'+':'')+x.dr+'）'})}))]));
screen(kids)}
// Breakthrough ceremony: success blooms gold ink and floats the stat gains; failure stamps a cracked seal.
var STK=[['hp','气血'],['mp','灵力'],['atk','攻击'],['def','防御'],['spd','速度'],['power','战力']];
function snapSt(){var st=(S.me&&S.me.stats)||{};var o={};for(var i=0;i<STK.length;i++)o[STK[i][0]]=Number(st[STK[i][0]])||0;return o}
function gainLines(b0){var out=[];if(!b0)return out;var st=(S.me&&S.me.stats)||{};for(var i=0;i<STK.length;i++){var d=(Number(st[STK[i][0]])||0)-(b0[STK[i][0]]||0);if(d>0)out.push(STK[i][1]+' +'+fmt(d))}return out}
function showBtResult(r,b0){var ov=$('overlay');ov.classList.remove('hidden');var kids=[];
if(r.success){var g=gainLines(b0);kids.push(h('h2',{text:'突破成功',style:'color:#ffe6a8'}));kids.push(h('div',{class:'ev',text:r.msg||''}));
if(g.length)kids.push(h('div',{class:'gains'},g.map(function(t,i){return h('span',{style:'--i:'+i,text:t})})))}
else{kids.push(h('div',{class:'crk',text:'走火'+String.fromCharCode(10)+'入魔'}));kids.push(h('h2',{text:'突破失败',style:'color:#ff9e8a'}));kids.push(h('div',{class:'ev',text:r.msg||''}))}
kids.push(h('div',{class:'muted',text:'成功率 '+Math.round((r.p||0)*100)+'%'}));
kids.push(h('button',{class:'pri',style:'margin-top:14px',onclick:function(){ov.classList.add('hidden');go('home')}},'继续'));
clear(ov);if(r.success&&!rm())ov.appendChild(h('div',{class:'bloom'}));
ov.appendChild(h('div',{class:'panel scr'},[h('div',{class:'burn'})].concat(kids)))}

// ---------- tribulation overlay
var TACT=[['tank','硬抗','以肉身承接，伤害 ×0.8（体修更强）'],['parry','招架','耗 10% 灵力，伤害 ×0.5（法修更强）'],['dodge','御剑','耗 15% 灵力，按速度概率完全闪避（剑修更强）'],['artifact','祭法宝','一次，伤害 ×0.3（需装备武器）'],['talisman','避雷符','消耗一张，化去此雷'],['pill','定心丹','消耗一枚，回复四成气血']];
// 克制 hints are derived from the action table above — no extra server data.
var TACTN={},TACTD={};for(var ti=0;ti<TACT.length;ti++){TACTN[TACT[ti][0]]=TACT[ti][1];TACTD[TACT[ti][0]]=TACT[ti][2]}
var TCOUNTER={'雷':['dodge','talisman'],'火':['parry','artifact'],'风':['dodge','parry'],'心魔':['pill','tank']};
function counterTip(k){var ids=TCOUNTER[k]||['tank','parry'];var ns=[];for(var i=0;i<ids.length;i++)ns.push(TACTN[ids[i]]||ids[i]);return k+'劫：'+ns.join(' / ')+' 最稳 — '+(TACTD[ids[0]]||'')}
function openTrib(t){var ov=$('overlay');ov.classList.remove('hidden');
var cv=h('canvas',{width:560,height:220});
var hTitle=h('h2',{text:''});
var hpI=h('i',{style:'width:100%'}),mpI=h('i',{style:'width:100%'});
var meter=h('div',{},[h('div',{class:'bar hp'},[hpI]),h('div',{class:'bar mp'},[mpI])]);
var stat=h('div',{class:'muted'});var tip=h('div',{class:'tip'});var msgB=h('div',{class:'ev'});
var info=h('div',{},[hTitle,meter,stat,tip,msgB]);
var btns=h('div',{class:'row',style:'margin-top:10px'});var log=h('div',{class:'log'});
var panel=h('div',{class:'panel'},[cv,info,btns,h('div',{class:'muted',style:'margin:6px 0',text:'按钮上的百分比＝这一道雷预计削掉你多少气血（已计入你的气血、法宝、道途与减免），闪避标的是成功率。气血越厚扣得越少。最后一道是心魔，靠悟性硬扛。'}),log]);
var tribFrame=0,tribTimer=null,lastStrike=null,lastAt=0,tribCalm=false,amp=0,flash=0;
function draw(strike,calm){if(strike){lastStrike=strike;lastAt=Date.now()}if(calm)tribCalm=true;if(!strike&&Date.now()-lastAt<520)strike=lastStrike;calm=calm||tribCalm;var g=cv.getContext&&cv.getContext('2d');if(!g)return;var f=tribFrame++;
var sky=g.createLinearGradient(0,0,0,220);sky.addColorStop(0,calm?'#0B0F1A':'#05070d');sky.addColorStop(.6,calm?'#1b2a3c':'#0e1420');sky.addColorStop(1,calm?'#3a3f4a':'#171c28');g.fillStyle=sky;g.fillRect(0,0,560,220);
if(calm){for(var r=0;r<16;r++){g.save();g.translate(280,96);g.rotate(r*0.3927+f*0.003);var rg=g.createLinearGradient(0,0,0,-300);rg.addColorStop(0,'rgba(243,226,179,.16)');rg.addColorStop(1,'rgba(243,226,179,0)');g.fillStyle=rg;g.beginPath();g.moveTo(0,0);g.lineTo(-22,-320);g.lineTo(22,-320);g.fill();g.restore()}var sun=g.createRadialGradient(280,96,4,280,96,120);sun.addColorStop(0,'rgba(255,248,220,.95)');sun.addColorStop(.25,'rgba(214,179,106,.45)');sun.addColorStop(1,'rgba(214,179,106,0)');g.fillStyle=sun;g.fillRect(0,0,560,220)}
function puff(cx,cy,r,body,rim){g.beginPath();var o=[[-1.25,0.05,0.55],[-0.55,-0.4,0.78],[0.2,-0.55,0.85],[0.95,-0.25,0.7],[1.5,0.12,0.5],[0.1,0.15,0.9]];for(var q=0;q<o.length;q++){g.moveTo(cx+o[q][0]*r+o[q][2]*r,cy+o[q][1]*r);g.arc(cx+o[q][0]*r,cy+o[q][1]*r,o[q][2]*r,0,6.3)}if(rim){g.strokeStyle=rim;g.lineWidth=2.4;g.shadowColor=rim;g.shadowBlur=7;g.stroke();g.shadowBlur=0}g.fillStyle=body;g.fill()}
var rimC=calm?'rgba(243,226,179,.55)':'rgba(214,179,106,'+(0.14+amp*0.3).toFixed(2)+')';
for(var i=0;i<7;i++){var cx=((i*112+f*(0.14+(i%3)*0.08))%720)-80,cy=30+(i%3)*10+Math.sin((f+i*25)/50)*3;puff(cx,cy,22+(i%3)*6,calm?'#36404f':'#161a2a',null)}
for(var j=0;j<5;j++){var kx=((j*150+f*(0.26+(j%2)*0.1))%760)-100,ky=74+(j%2)*12+Math.cos((f+j*30)/46)*3;puff(kx,ky,30+(j%2)*8,calm?'#262c3c':'#0c0e1a',rimC)}
if(!calm&&Math.random()<0.04+amp*0.06){g.fillStyle='rgba(200,190,255,.07)';g.fillRect(0,0,560,120)}
g.fillStyle='#101720';g.beginPath();g.moveTo(0,220);g.lineTo(0,176);g.lineTo(60,150);g.lineTo(120,170);g.lineTo(180,148);g.lineTo(236,168);g.lineTo(280,122);g.lineTo(324,168);g.lineTo(380,150);g.lineTo(440,172);g.lineTo(500,152);g.lineTo(560,176);g.lineTo(560,220);g.closePath();g.fill();
g.fillStyle='#070a11';g.beginPath();g.moveTo(0,220);g.lineTo(0,196);g.lineTo(80,184);g.lineTo(160,198);g.lineTo(240,186);g.lineTo(280,160);g.lineTo(320,186);g.lineTo(400,196);g.lineTo(480,184);g.lineTo(560,196);g.lineTo(560,220);g.closePath();g.fill();
if(calm){var hg=g.createRadialGradient(280,140,2,280,140,44);hg.addColorStop(0,'rgba(243,226,179,.55)');hg.addColorStop(1,'rgba(243,226,179,0)');g.fillStyle=hg;g.beginPath();g.arc(280,140,44,0,6.3);g.fill()}
g.fillStyle=calm?'#2a2416':'#0B0F1A';g.strokeStyle=calm?'#F3E2B3':'#D6B36A';g.lineWidth=0.8;g.shadowColor=g.strokeStyle;g.shadowBlur=calm?12:4;g.beginPath();g.arc(280,136,5,0,6.3);g.fill();g.stroke();g.beginPath();g.moveTo(280,141);g.bezierCurveTo(286,141,290,146,291,151);g.lineTo(294,158);g.bezierCurveTo(288,161,272,161,266,158);g.lineTo(269,151);g.bezierCurveTo(270,146,274,141,280,141);g.closePath();g.fill();g.stroke();g.shadowBlur=0;
if(strike){var col=strike==='心魔'?'#b388ff':strike==='火'?'#ff8a50':strike==='风'?'#8fd3ff':strike==='雷'?'#fff3a0':'#e6e3da';g.strokeStyle=col;g.shadowColor=col;
var jit=26+amp*34,seg=11+amp*5;
var bolt=function(bx,by,ty,w,depth){g.lineWidth=w;g.shadowBlur=16+amp*14;g.beginPath();g.moveTo(bx,by);var px=bx,py=by;while(py<ty){px+=(Math.random()-0.5)*jit+(depth===0?(280-px)*0.22:0);py+=seg+Math.random()*12;g.lineTo(px,py);if(depth<2&&Math.random()<0.16+amp*0.16)bolt(px,py,py+30+Math.random()*40,w*0.5,depth+1)}g.stroke()};
bolt(280,0,134,2.2+amp*2,0);if(amp>0.55)bolt(280,0,120,1.1+amp,1);g.shadowBlur=0;if(Date.now()-lastAt<180){g.fillStyle='rgba(255,255,255,'+(0.05+amp*0.07).toFixed(2)+')';g.fillRect(0,0,560,220)}}
if(flash>0){g.fillStyle='rgba(255,255,255,'+Math.min(1,flash).toFixed(2)+')';g.fillRect(0,0,560,220);flash-=0.055}}
function quake(){if(rm())return;panel.classList.remove('quake');void panel.offsetWidth;panel.classList.add('quake')}
function stopTrib(){if(tribTimer){clearInterval(tribTimer);tribTimer=null}}
tribTimer=setInterval(function(){if(!D.body.contains(cv)||ov.classList.contains('hidden')){stopTrib();return}draw()},60);
function render(t,done,msg,win){
if(t){hTitle.textContent=t.targetName+'之劫 · 第 '+(t.i+1)+' / '+t.n+' 道';meter.classList.remove('hidden');hpI.style.width=Math.round(t.hp*100)+'%';mpI.style.width=Math.round(t.mp*100)+'%';
var b=t.bolts[t.bolts.length-1];stat.textContent='来袭：'+b.k+'劫，威能 '+Math.round(b.p*100)+'%  · 法宝 '+t.art+' 次';
tip.textContent=counterTip(b.k);tip.classList.remove('hidden');
amp=Math.max(0,Math.min(1,(t.i/Math.max(1,t.n-1))*0.7+(b.p||0)*0.8))}
else{hTitle.textContent='劫云散去';meter.classList.add('hidden');stat.textContent='';tip.textContent='';tip.classList.add('hidden')}
msgB.textContent=msg||'';
clear(btns);
if(done){draw(null,true);
if(win===false){quake();if(!info.querySelector('.crk'))info.insertBefore(h('div',{class:'crk',text:'渡劫'+String.fromCharCode(10)+'失败'}),msgB)}
else{flash=1;if(!rm()){var bl=h('div',{class:'bloom'});ov.appendChild(bl);setTimeout(function(){if(bl.parentNode)bl.parentNode.removeChild(bl)},1700)}}
btns.appendChild(h('button',{class:'pri',onclick:function(){stopTrib();ov.classList.add('hidden');go('home')}},'天地归于平静'))}
else{var FC=t.forecast||{};TACT.forEach(function(a){var ok=t.can[a[0]]!==false&&(a[0]!=='artifact'||t.can.artifact)&&(a[0]!=='talisman'||t.can.talisman)&&(a[0]!=='pill'||t.can.pill);
var lb=a[1];if(ok){if(a[0]==='dodge'&&FC.dodge!=null)lb+=' 闪 '+FC.dodge+'%';else if(a[0]==='talisman')lb+=' 免伤';else if(a[0]==='pill')lb+=' 回四成';else if(FC[a[0]]!=null)lb+=' −'+FC[a[0]]+'%'}
btns.appendChild(h('button',{disabled:!ok,title:a[2],onclick:async function(){var r=await rpc('trib.step',{act:a[0]},{quiet:true});if(!r)return;draw(t.bolts[t.bolts.length-1].k);quake();var fin=!(r.data&&r.data.home&&r.data.home.trib);var TL=(r.data&&r.data.tribLog)||r.log;if(fin&&TL&&TL.length){var L=TL[TL.length-1];log.insertBefore(h('div',{class:'A',text:'第'+(L.i+1)+'道'+L.k+'劫：'+(L.note||'')+'，伤 '+L.d}),log.firstChild)}log.insertBefore(h('div',{class:r.success===false?'B':'A'+(fin?' big':''),text:r.msg}),log.firstChild);if(r.data&&r.data.home&&r.data.home.trib)render(r.data.home.trib,false);else render(null,true,r.msg,r.success!==false)}},lb))});
btns.appendChild(h('button',{class:'danger',onclick:async function(){if(!(await sure('临劫而逃，天劫会追着你劈三天。确定？')))return;await rpc('trib.flee');stopTrib();ov.classList.add('hidden');go('home')}},'逃'))}}
clear(ov).appendChild(panel);draw();render(t,false)}

// ---------- battle replay
function replay(b,after){if(!b){if(after)after();return}var ov=$('overlay');ov.classList.remove('hidden');var ah=b.me.hp,bh=b.foe.hp;var barA=h('i',{style:'width:100%'}),barB=h('i',{style:'width:100%'});var log=h('div',{class:'log'});var i=0;var title=h('h2',{text:b.me.name+'  对  '+b.foe.name});
var meKey='seal_'+(b.me.r!=null?b.me.r:(S.me?S.me.r:0));var foeKey=b.foe.id?'mon_'+b.foe.id:(b.foe.r!=null?'seal_'+b.foe.r:null);
function fighter(name,key,fb,bar,side){return h('div',{class:'fighter '+side},[h('div',{class:'pfw'},[portrait(key,fb,'pf')]),h('div',{class:'fn',text:name}),h('div',{class:'bar hp'},[bar])])}
var fA=fighter(b.me.name,meKey,b.me.name,barA,'L'),fB=fighter(b.foe.name,foeKey,b.foe.icon||b.foe.name,barB,'R');var turn=h('div',{class:'vs',text:'对'});
var skip=h('button',{title:'胜负在出手那一刻就已判定，跳过只是略过演示',onclick:function(){i=b.log.length;finish()}},'跳过演示');
function finish(){clear(log);b.log.forEach(function(e){log.appendChild(line(e))});var last=b.log[b.log.length-1];barA.style.width=pct(last.ah,ah)+'%';barB.style.width=pct(last.bh,bh)+'%';turn.textContent=b.win?'胜':'败';turn.className='vs '+(b.win?'win':'lose');(b.win?fB:fA).classList.add('down');clear(ctl).appendChild(h('button',{class:'pri',onclick:function(){ov.classList.add('hidden');if(after)after()}},b.win?'胜':'败'))}
function line(e){var who=(e.s==='胜'||e.s==='败')?b.me.name:e.w==='A'?b.me.name:e.w==='B'?b.foe.name:'';var t=(e.t?'['+e.t+'] ':'')+who+(e.s?' · '+e.s:'')+(e.d?'  -'+fmt(e.d):'')+(e.c?' 暴击':'')+(e.e?'  '+e.e:'');return h('div',{class:e.w+(e.c||e.s==='胜'||e.s==='败'?' big':''),text:t})}
function hit(e){if(!e.w)return;var atk=e.w==='A'?fA:fB,tgt=e.w==='A'?fB:fA;atk.classList.remove('atk');void atk.offsetWidth;atk.classList.add('atk');if(e.d){tgt.classList.remove('hit');void tgt.offsetWidth;tgt.classList.add('hit');var dn=h('span',{class:'dmg'+(e.c?' crit':''),text:'-'+fmt(e.d)});tgt.appendChild(dn);setTimeout(function(){if(dn.parentNode)dn.parentNode.removeChild(dn)},900)}if(e.t)turn.textContent=String(e.t)}
var ctl=h('div',{class:'row',style:'margin-top:8px'},[skip,h('span',{class:'tip',text:'胜负在出手那一刻已由服务端判定，跳过只是略过演示，不影响结果。'})]);
clear(ov).appendChild(h('div',{class:'panel'},[title,h('div',{class:'arena'},[fA,turn,fB]),log,ctl]));
var tm=setInterval(function(){if(i>=b.log.length){clearInterval(tm);finish();return}var e=b.log[i++];log.insertBefore(line(e),log.firstChild);hit(e);barA.style.width=pct(e.ah,ah)+'%';barB.style.width=pct(e.bh,bh)+'%'},420)}

// ---------- explore
VIEWS.explore=async function(){var v=await rpc('regions',{},{quiet:true});if(!v)return;renderExplore(v.data,null,'ex')};
function subnav(items,cur,pick){return h('div',{class:'row'},items.map(function(t){return h('button',{class:cur===t[0]?'pri sm':'sm',onclick:function(){pick(t[0])}},t[1])}))}
function renderExplore(d,result,sub){var m=S.me;sub=sub||'ex';var kids=[hero('explore'),tipCard('explore'),subnav([['ex','游历'],['dg','秘境']],sub,function(x){if(x==='dg')dgLoad();else VIEWS.explore()})];
if(sub==='dg'){renderDungeon(kids,d);return}
if(result)kids.push(resultCard(result));
if(d.event)kids.push(eventCard(d.event));
else kids.push(h('div',{class:'card'},[h('h3',{text:'游历'}),h('div',{class:'sub',text:'体力 '+m.st+'/'+m.stMax+' · 今日 '+m.daily.exp+'/'+(d.daily||20)}),(d.ev&&d.ev.hot)?h('div',{class:'tag gold',style:'margin:4px 0',text:'🌊 妖潮进行中 · 掉落 ×1.5 · 遭妖更多'}):h('div',{class:'muted',text:'每晚 20:00–22:00（北京时间）妖潮：就在这里游历，掉落 ×1.5、遭妖更多，不是副本。妖兽会什么神通就可能掉什么秘籍。'}),h('div',{class:'muted',text:'每次游历消耗 1 体力（每半小时回 1 点，攒到 10 点就不再涨）。一趟最多走 10 步，回头再来或服辟谷丹便可跑满今日。'}),h('div',{class:'grid',style:'margin-top:8px'},d.regions.map(function(r){return h('div',{class:'item rg'+(r.open?'':' lock')},[img('region_'+r.id,'rgimg'),h('div',{class:'n',text:r.icon+' '+r.name}),h('div',{class:'muted',text:r.desc}),h('div',{style:'margin-top:6px'},[r.open?h('button',{class:'pri sm',disabled:m.st<1,onclick:async function(){var x=await rpc('explore',{region:r.id});if(x&&x.ok)renderExplore(x.data)}},'前往'):h('span',{class:'tag',text:'需'+RN[r.realm]})])])}))]));
screen(kids)}
function eventCard(e){return h('div',{class:'card'},[h('h3',{text:e.enc?'遭遇':'奇遇'}),e.enc?h('div',{class:'encp'},[portrait('mon_'+e.enc.id,e.enc.icon,'mon'),h('div',{},[h('div',{class:'n',text:e.enc.name}),h('div',{class:'muted'},[elSpan(e.enc.elem),e.enc.desc||''])])]):null,h('div',{class:'ev',text:e.text}),h('div',{style:'margin-top:8px'},e.opts.map(function(o){var hid=o.hidden&&!o.ok;return h('button',{class:'opt'+(o.hidden&&o.ok?' hid':''),disabled:!o.ok,title:hid?'探险者才看得见的门路':'',onclick:async function(){var x=await rpc('choose',{opt:o.id},{quiet:true});if(!x)return;if(x.ok===false){toast(x.msg,true);return}var res=x.data.result;if(res&&res.battle){replay(res.battle,function(){renderExplore(x.data,res)})}else renderExplore(x.data,res)}},hid?['？？？',h('span',{class:'req',text:'探险者'})]:[o.label,o.req?h('span',{class:'req',text:o.req}):null])}))])}
function resultCard(r){var parts=[];if(r.lines&&r.lines.length)parts.push(h('div',{class:'res',text:r.lines.join('\n')}));var g=[];if(r.xp)g.push('修为 '+(r.xp>0?'+':'')+fmt(r.xp));if(r.ls)g.push('灵石 '+(r.ls>0?'+':'')+fmt(r.ls));if(r.wu)g.push('悟性 '+(r.wu>0?'+':'')+r.wu);if(g.length)parts.push(h('div',{class:'muted',text:g.join(' · ')}));if(r.drops&&r.drops.length)parts.push(h('div',{class:'row drops'},r.drops.map(function(d){return h('span',{class:'drop'+(d.lost?' lost':'')},[img('item_'+d.id,'ico sm'),d.name+(d.n>1?'×'+d.n:'')+(d.q?'（'+d.q+'星）':'')+(d.lost?'（遗失）':'')])})));if(r.battle)parts.push(h('button',{class:'flat sm',onclick:function(){replay(r.battle)}},'回看战斗'));
var got=(r.drops||[]).filter(function(x){return !x.lost&&(x.n===undefined||x.n>0)});if(got.length)setTimeout(function(){reveal(got)},80);
return h('div',{class:'card'},[h('h3',{text:'经过'})].concat(parts))}

// ---------- 秘境
async function dgLoad(){var v=await rpc('dg',{},{quiet:true});if(!v)return;renderExplore(v.data,null,'dg')}
function dgP(x){return Math.round((x||0)*100)}
async function dgGo(i){var x=await rpc('dg.pick',{i:i},{quiet:true});if(!x)return;if(x.ok===false){toast(x.msg,true);return}
if(x.data.battle){replay(x.data.battle,function(){dgAfter(x.data)});return}dgAfter(x.data)}
function dgAfter(d){var b=d.bank;var got=(b&&b.drops?b.drops:[]).filter(function(z){return !z.lost});
if(got.length){reveal(got,function(){renderExplore(d,null,'dg')});return}renderExplore(d,null,'dg')}
async function dgUse(id){var v=await rpc('dg.use',{id:id},{quiet:true});if(!v)return;if(v.ok===false){toast(v.msg,true);return}toast(v.msg);renderExplore(v.data,null,'dg')}
function dgLoot(l){modal(l.list.length?l.list.map(function(x){return x.name+(x.n>1?' ×'+x.n:'')+(x.q?'（'+x.q+'星）':'')}).join('\n')+(l.n>l.list.length?'\n…共 '+l.n+' 样':''):'秘境里还什么都没捞着。')}
function dgBankCard(b){return h('div',{class:'card'},[h('h3',{text:b.done?'秘境通关':b.dead?'力竭而返':'收手而归'}),h('div',{class:'sub',text:'深入 '+b.depth+' 层'+(b.dead?' · 所得折半':'')}),h('div',{class:'muted',text:'修为 +'+fmt(b.xp)+' · 灵石 +'+fmt(b.ls)}),
b.drops.length?h('div',{class:'row drops'},b.drops.map(function(x){return h('span',{class:'drop'+(x.lost?' lost':'')},[img('item_'+x.id,'ico sm'),x.name+(x.n>1?'×'+x.n:'')+(x.q?'（'+x.q+'星）':'')+(x.lost?'（行囊已满）':'')])})):null,
b.lines&&b.lines.length?h('div',{class:'res',text:b.lines.join('\n')}):null])}
function dgOpt(o,i){return h('button',{class:'opt dgo',onclick:function(){dgGo(i)}},[o.id?img('mon_'+o.id,'ico'):null,h('span',{class:'oi',text:o.i||'·'}),h('span',{class:'grow'},[h('b',{text:o.n}),h('div',{class:'muted'},[o.elem?elSpan(o.elem):null,o.d||''])])])}
function renderDungeon(kids,d){var g=d&&d.dg;var tc=tipCard('dg');if(tc)kids.push(tc);if(!g){screen(kids);return}
if(d.bank)kids.push(dgBankCard(d.bank));
var run=g.run;
if(!run){kids.push(h('div',{class:'card'},[h('h3',{text:'秘境'}),h('div',{class:'sub',text:'今日余 '+g.left+'/'+g.limit+' 次'}),
h('div',{class:'muted',text:'每层给你两三条路，自己挑。所得先寄在秘境里，收手或通关才入行囊；死在里面折损一半。'}),
h('div',{class:'muted',text:'入口要气血过半，手上没有未了的事。最后一层是秘境之主。'}),
h('div',{class:'row',style:'margin-top:8px'},g.diffs.map(function(x){return h('button',{class:x.ok&&g.left>0?'pri sm':'sm',disabled:!x.ok||g.left<=0,onclick:async function(){var v=await rpc('dg.enter',{diff:x.id},{quiet:true});if(!v)return;if(v.ok===false){toast(v.msg,true);return}renderExplore(v.data,null,'dg')}},x.name+' · '+x.n+' 层 · 掉落×'+x.lm)})),
g.best?h('div',{class:'muted',style:'margin-top:6px',text:'本周最深 '+g.best.d+' 层'}):null]));
kids.push(h('div',{class:'card'},[h('h3',{text:'本周最深'}),h('div',{class:'list'},g.board.length?g.board.map(function(x){return h('div',{class:'row'+(String(x.uid)===String(S.me.uid)?' me':'')},[h('span',{class:'rank',text:String(x.rank)}),h('span',{class:'grow',text:x.n}),h('span',{class:'num',text:'第 '+x.d+' 层'})])}):h('div',{class:'muted',text:'本周还没有人下去过。'}))]));
screen(kids);return}
kids.push(h('div',{class:'card'},[h('div',{class:'dgh'},[h('b',{text:run.diff+'  第 '+run.f+'/'+run.n+' 层'}),h('span',{class:'muted',text:'❤ '+dgP(run.hp)+'%  ✦ '+dgP(run.mp)+'%'}),h('span',{class:'muted',text:'💎 '+fmt(run.ls)+'  修为 '+fmt(run.xp)})]),
run.rel.length?h('div',{class:'row dgr'},run.rel.map(function(x){return h('span',{class:'tag',title:x.n+'：'+x.d,text:x.n})})):null,
h('div',{class:'row'},[h('button',{class:'flat sm',onclick:function(){dgLoot(run.loot)}},'战利品 '+run.loot.n+' 样'),run.sh?h('span',{class:'tag',text:'守护已碎'}):null]),
run.last.length?h('div',{class:'res',text:run.last.join('\n')}):null]));
var body=[];var p=run.pend;
if(p&&p.t==='ev'){body.push(h('div',{class:'ev',text:p.text}));p.o.forEach(function(o,i){body.push(h('button',{class:'opt',onclick:function(){dgGo(i)}},o.l))})}
else if(p&&p.t==='shop'){body.push(h('div',{class:'muted',text:'行商靠在石壁上，货只卖一件。'}));p.g.forEach(function(o,i){body.push(h('button',{class:'opt dgo',disabled:run.ls<o.ls,onclick:function(){dgGo(i)}},[h('span',{class:'oi',text:'🛒'}),h('span',{class:'grow'},[h('b',{text:o.n}),h('div',{class:'muted',text:o.d})]),h('span',{class:'num',text:o.ls+' 灵石'})]))});body.push(h('button',{class:'sm',onclick:function(){dgGo(-1)}},'不买了'))}
else if(p&&p.t==='relic'){body.push(h('div',{class:'muted',text:'石台上浮着三样，只能取一。'}));p.r.forEach(function(o,i){body.push(h('button',{class:'opt dgo',onclick:function(){dgGo(i)}},[h('span',{class:'oi',text:'✨'}),h('span',{class:'grow'},[h('b',{text:o.n}),h('div',{class:'muted',text:o.d})])]))});body.push(h('button',{class:'sm',onclick:function(){dgGo(-1)}},'不取'))}
else{run.opts.forEach(function(o,i){body.push(dgOpt(o,i))})}
kids.push(h('div',{class:'card'},[h('h3',{text:p?'眼前':'选一条路'})].concat(body)));
kids.push(h('div',{class:'card'},[h('div',{class:'row'},[h('button',{class:'sm',disabled:!run.pillOk,onclick:function(){dgUse('p_huixue')}},'服回血丹'),h('button',{class:'sm',disabled:!run.pillOk,onclick:function(){dgUse('p_huiling')}},'服回灵丹'),
h('button',{class:'sm danger',onclick:async function(){if(!(await sure('收手离开？所得带走，这次秘境到此为止。')))return;var v=await rpc('dg.leave',{},{quiet:true});if(!v)return;if(v.ok===false){toast(v.msg,true);return}dgAfter(v.data)}},'收手')])]));
screen(kids)}

// ---------- bag
VIEWS.bag=async function(){var v=await rpc('bag',{},{quiet:true});if(!v)return;renderBag(v.data,'items')};
function renderBag(d,sub){var inv=d.inv,sk=d.skills;var m=S.me;var tabs=h('div',{class:'row'},[['items','物品'],['arts','法宝'],['skills','功法神通'],['craft','炼制'],['pet','灵兽']].map(function(t){return h('button',{class:sub===t[0]?'pri sm':'sm',onclick:async function(){if(t[0]==='craft'){var x=await rpc('recipes',{},{quiet:true});if(x)renderBag(Object.assign({},d,x.data),'craft')}else if(t[0]==='pet'){var y=await rpc('pet',{},{quiet:true});if(y)renderBag(Object.assign({},d,y.data),'pet')}else renderBag(d,t[0])}},t[1])}));
var body;
if(sub==='items'){var groups={};inv.stack.forEach(function(it){(groups[it.k]=groups[it.k]||[]).push(it)});body=h('div',{},Object.keys(groups).map(function(k){return h('div',{},[h('h4',{text:KINDN[k]||k}),h('div',{class:'grid'},groups[k].map(function(it){var fx=it.fx||{};var usable=it.k==='pill'||it.k==='egg'||fx.biguan||fx.ripen||fx.learn||(it.k==='misc'&&(fx.array||fx.legacy||fx.rate));var goTo=fx.seed?['去播种',function(){go('home')}]:fx.rune?['去淬炼',function(){renderBag(d,'arts')}]:null;return h('div',{class:'item '+tcl(it.t)+(A['item_'+it.id]?' ic':'')},[rimEl(it.t),img('item_'+it.id),h('div',{class:'n'},[tierTag(it.t),it.name+' ×'+it.n]),h('div',{class:'muted',text:it.desc}),h('div',{class:'row',style:'margin-top:6px'},[usable?h('button',{class:'sm pri',onclick:async function(){var x=await rpc('use',{id:it.id});if(x&&x.ok)renderBag(Object.assign({},d,x.data),'items')}},'使用'):null,goTo?h('button',{class:'sm pri',onclick:goTo[1]},goTo[0]):null,h('button',{class:'sm',onclick:async function(){var n=await ask('卖出给坊市（折半价，立刻到手）　单价 '+Math.floor(it.v*0.5)+' 灵石　数量',String(it.n),{type:'number'});if(!n)return;var x=await rpc('sell',{id:it.id,n:Number(n)});if(x&&x.ok)renderBag(Object.assign({},d,x.data),'items')}},'卖出'),m.r>=1?h('button',{class:'sm',onclick:function(){auctionForm({id:it.id,max:it.n,name:it.name})}},'上拍'):null])])}))])}).concat([h('div',{class:'muted',text:'行囊 '+inv.stack.length+'/'+inv.cap.stack+' 种　·　卖出＝折半价卖给坊市，立刻到手；上拍＝挂拍卖行 24 小时，价高者得（手续费 5%）'})]))}
else if(sub==='arts'){body=h('div',{},[h('div',{class:'muted',text:'已装备：'+['w','a','r'].map(function(s){var it=inv.arts.filter(function(a){return a.iid===inv.eq[s]})[0];return SLOTN[s]+' '+(it?it.name:'—')}).join(' · ')}),h('div',{class:'grid',style:'margin-top:8px'},inv.arts.map(function(a){return h('div',{class:'item '+tcl(a.t)+(a.equipped?' on':'')+(A['item_'+a.id]?' ic':'')},[rimEl(a.t),img('item_'+a.id),h('div',{class:'n'},[h('span',{class:'tag '+tcl(a.t),text:SLOTN[a.slot]}),a.name+' ',h('span',{class:'stars',text:'★★★★★'.slice(0,a.q)})]),h('div',{class:'muted'},[elSpan(a.elem),Object.keys(a.st||{}).map(function(k){return (STN[k]||k)+' +'+(a.st[k]<1?Math.round(a.st[k]*100)+'%':a.st[k])}).join(' ')+(a.q>1?'　★'+a.q+' 品质 +'+Math.round(((a.qm||1)-1)*100)+'%':'')]),a.af&&a.af.length?h('div',{class:'muted',text:a.af.map(function(f){return f.n+' +'+(f.v<1?Math.round(f.v*100)+'%':f.v)}).join('、')}):null,a.rn&&a.rn.length?h('div',{class:'muted',text:'符纹：'+a.rn.map(function(f){return STN[f.st]+' +'+(f.v<1?Math.round(f.v*100)+'%':f.v)}).join('、')}):null,h('div',{class:'row',style:'margin-top:6px'},[a.equipped?h('button',{class:'sm',onclick:async function(){var x=await rpc('unequip',{slot:a.slot});if(x&&x.ok)renderBag(Object.assign({},d,x.data),'arts')}},'卸下'):h('button',{class:'sm pri',onclick:async function(){var x=await rpc('equip',{iid:a.iid});if(x&&x.ok)renderBag(Object.assign({},d,x.data),'arts')}},'装备'),h('button',{class:'sm',onclick:async function(){if(!(await sure('把「'+a.name+'」折半卖给坊市，得 '+sellV(a)+' 灵石？想卖高价请改用「上拍」。')))return;var x=await rpc('sellArt',{iid:a.iid});if(x&&x.ok)renderBag(Object.assign({},d,x.data),'arts')}},'卖出'),h('button',{class:'sm',onclick:function(){refineOpen(a.iid,d)}},'淬炼'),!a.equipped&&m.r>=1?h('button',{class:'sm',onclick:function(){auctionForm({iid:a.iid,name:a.name})}},'上拍'):null])])})),h('div',{class:'muted',text:'法宝匣 '+inv.arts.length+'/'+inv.cap.arts+'　·　卖出＝折半价卖给坊市，立刻到手；上拍＝挂拍卖行 24 小时，价高者得（手续费 5%）'})])}
else if(sub==='skills'){var sel=sk.eqArts.slice();body=h('div',{},[h('h4',{text:'功法（被动，择一修炼）'}),h('div',{class:'grid'},sk.gongfa.map(function(g){return h('div',{class:'item'+(g.equipped?' on':'')+(g.locked?' lock':''),onclick:async function(){if(g.locked||g.equipped)return;var x=await rpc('gongfa',{id:g.id});if(x&&x.ok)renderBag(Object.assign({},d,x.data),'skills')}},[h('div',{class:'n',text:'《'+g.name+'》'+['黄','玄','地','天'][g.grade]+'阶'}),h('div',{class:'muted'},[elSpan(g.elem),'修炼 ×'+g.rate+' — '+g.desc]),sealBtn(g,d)])})),h('div',{class:'muted',text:'用不上的功法神通可「封存」成秘籍，拿去坊市上拍；妖兽会什么神通就可能掉什么秘籍。'}),h('h4',{text:'神通（出战 1-3 个，点击切换）'}),h('div',{class:'grid'},sk.arts.map(function(a){var on=sel.indexOf(a.id)>=0;var el=h('div',{class:'item'+(on?' on':'')+(a.locked?' lock':''),onclick:async function(){if(a.locked)return;var i=sel.indexOf(a.id);if(i>=0){if(sel.length<=1)return;sel.splice(i,1)}else{if(sel.length>=3){toast('最多三个',true);return}sel.push(a.id)}var x=await rpc('arts',{ids:sel});if(x&&x.ok)renderBag(Object.assign({},d,x.data),'skills')}},[h('div',{class:'n'},[elSpan(a.elem),a.name+' ×'+a.mult+' 耗'+a.mp]),h('div',{class:'muted',text:a.desc}),sealBtn(a,d)]);return el}))])}
else if(sub==='craft'){var rc=d.recipes||{pills:[],forge:[]};function rlist(list,title){return [h('h4',{text:title}),h('div',{class:'grid'},list.map(function(r){return h('div',{class:'item'+(r.can?'':' lock')+(A['item_'+r.out]?' ic':'')},[img('item_'+r.out),h('div',{class:'n',text:r.name+(r.n>1?' ×'+r.n:'')+'  '+Math.round(r.p*100)+'%'}),h('div',{class:'muted',text:r.in.map(function(i){return i.name+' '+i.have+'/'+i.n}).join('、')+' · '+r.ls+' 灵石'}),h('div',{class:'muted',text:r.desc}),h('button',{class:'sm pri',disabled:!r.can,style:'margin-top:6px',onclick:async function(){var x=await rpc('craft',{id:r.id});if(!x)return;var nd=Object.assign({},d,x.data);if(x.success)reveal([{id:r.out,name:r.name,n:r.n,t:tierIn(nd,r.out)}],function(){renderBag(nd,'craft')});else renderBag(nd,'craft')}},'开炉')])}))]}body=h('div',{},rlist(rc.pills,'炼丹（丹修 +25% 成功率，丹毒减半）').concat(rlist(rc.forge,'炼器 / 制符（器修 +25% 成功率与品质）')))}
else if(sub==='pet'){body=petBody(d)}
screen([hero('bag'),h('div',{class:'card'},[h('h3',{text:'行囊'}),h('div',{class:'row sb'},[h('span',{class:'sub',text:'随身之物'}),h('span',{class:'num',text:'◆ '+fmt(m.ls)+' 灵石'})]),tabs,body])])}
function energyForm(e,d){var ov=$('overlay');ov.classList.remove('hidden');
var n=h('input',{type:'number',value:'1',min:1,max:String(Math.max(1,Math.min(e.left,e.balance)))});
var er=h('div',{class:'ferr'});var out=h('div',{class:'num',style:'margin:6px 0'});
function calc(){var k=Math.max(0,Math.min(Number(n.value)||0,e.left,e.balance));out.textContent='换得灵石 ◆ '+fmt(k*e.rate)}
n.oninput=calc;calc();
var ob=h('button',{class:'pri'},'供奉');
ob.onclick=async function(){if(ob.disabled)return;er.textContent='';var k=Number(n.value)||0;
if(!(k>=1)){er.textContent='至少供奉 1 点能量';return}
if(k>e.balance){er.textContent='你只有 '+e.balance+' 点能量';return}
if(!(await sure('确定供奉 '+k+' 点论坛能量，换 '+(k*e.rate)+' 灵石？扣的是论坛上真实的能量，换完不可退。')))return;
ob.disabled=true;ob.textContent='供奉中…';
try{var x=await rpc('energy.offer',{n:k},{force:true});
if(x&&x.ok){ov.classList.add('hidden');go('market');return}
er.textContent=x&&x.msg?x.msg:'供奉未成，能量与灵石都没有变动'}finally{ob.disabled=false;ob.textContent='供奉'}};
clear(ov).appendChild(h('div',{class:'panel scr'},[h('div',{class:'burn'}),h('h2',{text:'能量供奉'}),
h('div',{class:'muted',text:'把论坛能量供入天机阁，换成灵石。1 点能量 ＝ '+fmt(e.rate)+' 灵石（随境界水涨船高），每日最多 '+e.daily+' 点。'}),
h('div',{class:'muted',style:'margin:6px 0',text:'你现有论坛能量 '+e.balance+' 点，今日还可供奉 '+e.left+' 点。'}),
h('div',{style:'margin:8px 0'},['供奉 ',n,' 点']),out,er,
h('div',{class:'row'},[ob,h('button',{onclick:function(){ov.classList.add('hidden')}},'算了')]),vipCard(e.vip)]))}
function sealBtn(x,d){if(x.equipped||x.basic)return null;return h('button',{class:'sm seal',onclick:async function(ev){ev.stopPropagation();if(!(await sure('把《'+x.name+'》封存成册？自己就不会了，秘籍可上拍。')))return;var r=await rpc('book.seal',{id:x.id});if(r&&r.ok)renderBag(Object.assign({},d,r.data),'skills')}},'封存')}
var VIPC=['','#c9ced6','#e2b84a','#7fd3ff','#ff9a3c','#ff6b6b','#c58cff','#5ff2d2','#f0e6ff','#ffd700'];
function vipBadge(lv){lv=lv|0;if(!lv)return null;return h('span',{class:'tag vipb',style:'border-color:'+VIPC[lv]+';color:'+VIPC[lv],text:'VIP'+lv})}
function vipCard(v){if(!v)return null;var pct=v.need?Math.min(100,Math.round(v.en/v.need*100)):100;var w=v.now||{};var head=h('tr',{},(v.cols||[]).map(function(c){return h('th',{text:c})}));var rows=(v.table||[]).map(function(r,i){var l=i+1;return h('tr',{class:l===v.lv?'cur':l<v.lv?'':'muted'},r.map(function(x,j){return h('td',{style:j===0?'color:'+VIPC[l]:'',text:x})}))});return h('div',{style:'margin-top:12px;border-top:1px solid var(--line);padding-top:8px'},[h('div',{class:'row'},[h('b',{class:'vbig',style:'color:'+(VIPC[v.lv]||'inherit'),text:v.name}),h('span',{class:'muted',text:'累计供奉 '+v.en+' 点'+(v.next?'，再 '+(v.need-v.en)+' 点升 '+v.next:'，已至顶')})]),h('div',{class:'bar xp'},[h('i',{style:'width:'+pct+'%'})]),v.lv?h('div',{class:'vbig',text:'修炼 ×'+w.rate+' · 离线 +'+w.off+'h · 掉落 ×'+w.drop+' · 每日游历 '+w.exp+' 次 · 供奉 '+w.en+' 点/日'}):h('div',{class:'muted',style:'margin-top:4px',text:'供奉 5 点能量即 VIP1；每升一级，修炼、掉落、离线上限、游历与供奉额度全线拉开，并解锁新权益。'}),h('div',{style:'overflow-x:auto;margin-top:6px'},[h('table',{class:'vt'},[head].concat(rows))]),h('div',{class:'list',style:'margin-top:6px'},(v.extras||[]).map(function(e,i){return h('div',{class:(i+1<=v.lv?'':'muted'),style:'font-size:11px',text:e})})),h('div',{class:'muted',text:'等级只看累计供奉的能量，只升不降，跨转世永久；改版前的供奉已按每次 3 点估算补记。'})])}
function auctionForm(it){var ov=$('overlay');ov.classList.remove('hidden');var n=h('input',{type:'number',value:it.max?String(Math.min(it.max,1)):'1',min:1,max:it.max||1});var min=h('input',{type:'number',placeholder:'起拍价（灵石）',min:1});
var er=h('div',{class:'ferr'});var ob=h('button',{class:'pri'},'上拍');
ob.onclick=async function(){if(ob.disabled)return;er.textContent='';var mv=Number(min.value);
if(!(mv>=1)){er.textContent='请先填起拍价（至少 1 灵石）';return}
ob.disabled=true;ob.textContent='上拍中…';
try{var item=it.iid?{iid:it.iid}:{id:it.id,n:Number(n.value)};var x=await rpc('auction.create',{item:item,min:mv},{force:true});
if(x&&x.ok){ov.classList.add('hidden');go('market');return}
er.textContent=x&&x.msg?x.msg:'没能上拍，请稍后再试'}finally{ob.disabled=false;ob.textContent='上拍'}};
clear(ov).appendChild(h('div',{class:'panel scr'},[h('div',{class:'burn'}),h('h2',{text:'上拍 '+it.name}),it.max?h('div',{style:'margin:6px 0'},['数量 ',n]):null,h('div',{style:'margin:8px 0'},[min]),h('div',{class:'muted',text:'24 小时后落槌，价高者得。手续费 5%（商人免）。同时最多 5 件在拍（与 auction.js 的 MAX_ACTIVE 一致）；卖出的钱一领，位子当场空出来。'}),er,h('div',{class:'row'},[ob,h('button',{onclick:function(){ov.classList.add('hidden')}},'取消')])]))}

// ---------- 淬炼 / 灵田 / 灵兽
var RN=['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫'];var RN10=RN.concat(['仙']);
function sellV(a){return Math.floor((a.v||0)*0.5*(1+((a.q||1)-1)*0.15))}
var STN={atk:'攻击',def:'防御',hp:'气血',mp:'灵力',spd:'速度',crit:'暴击',rate:'修炼',spell:'术法'};
function dur(ms){ms=Math.max(0,Number(ms)||0);var m=Math.round(ms/60000);if(m<60)return Math.max(1,m)+' 分';var hh=Math.floor(m/60),mm=m%60;return hh+' 小时'+(mm?' '+mm+' 分':'')}
async function refineOpen(iid,d){var x=await rpc('refine.view',{iid:iid},{quiet:true});if(!x||!x.data||!x.data.refine){toast('炉子打不开',true);return}S.rflk=null;refineDraw(x.data,iid,d)}
function refineDraw(dd,iid,d){var ov=$('overlay');var r=dd.refine;if(!r){ov.classList.add('hidden');return}ov.classList.remove('hidden');
function shut(){ov.classList.add('hidden');renderBag(Object.assign({},d,{inv:dd.inv}),'arts')}
function back(x){if(x&&x.data&&x.data.refine)refineDraw(x.data,iid,d);else shut()}
function afRow(i){var a=r.af[i];var on=S.rflk===i;
return h('div',{class:'row sb'},[h('span',{class:'grow',text:a?(a.n+' +'+(a.v<1?Math.round(a.v*100)+'%':a.v)):'空槽'}),
a?h('button',{class:on?'sm pri':'sm',title:'保值重铸：属性不变，数值只升不降，费用翻倍',onclick:function(){S.rflk=on?null:i;refineDraw(dd,iid,d)}},'保值'):null,
h('button',{class:'sm',disabled:on?!r.reforge.canLock:!r.reforge.can,onclick:async function(){var x=await rpc('refine.reforge',{iid:iid,slot:i,lock:on?1:0});back(x)}},a?(on?'保值重铸':'重铸'):'开一槽')])}
var rows=[];for(var i=0;i<r.maxAf;i++)rows.push(afRow(i));
var lk=(S.rflk!==null&&S.rflk!==undefined);
var cost=h('div',{class:'muted',text:'重铸 '+(lk?r.reforge.lockLs:r.reforge.ls)+' 灵石 · '+(lk?r.reforge.lockMats:r.reforge.mats).map(function(x){return x.name+' 需 '+x.n+'（有 '+x.have+'）'}).join('、')+(lk?' · 保值：属性不变、数值只升不降':'')});
var sel=h('select');(r.star.cands||[]).forEach(function(x){sel.appendChild(h('option',{value:String(x.iid)},'★★★★★'.slice(0,x.q)+' #'+x.iid))});
var star=h('div',{},[h('h4',{text:'升星'}),h('div',{class:'muted',text:r.q>=5?'已至五星，无可再升。':'以另一件同名法宝为祭，成功率 '+Math.round(r.star.p*100)+'%，耗 '+r.star.ls+' 灵石。失败只毁祭品。每升一星，基础属性 +8%（词缀与符纹不受影响）。'}),
r.star.cands.length?h('div',{class:'row'},[sel,h('button',{class:'pri sm',disabled:!r.star.can,onclick:async function(){if(!(await sure('以 #'+sel.value+' 为祭，合炉升星？')))return;var x=await rpc('refine.star',{iid:iid,withIid:Number(sel.value)});back(x)}},'合炉')]):h('div',{class:'muted',text:'行囊里没有第二件同名法宝。'})]);
var socks=[];for(var k=0;k<r.maxRn;k++)socks.push(runeSock(k));
function runeSock(k){var rn=r.rn[k];if(!rn)return h('span',{class:'tag',text:'◇ 空槽'});
return h('button',{class:'sm',onclick:async function(){if(!(await sure('剥下'+(STN[rn.st]||rn.st)+'符纹？纹路会碎。')))return;var x=await rpc('refine.unrune',{iid:iid,k:k});back(x)}},(STN[rn.st]||rn.st)+' +'+(rn.v<1?Math.round(rn.v*100)+'%':rn.v)+' ×')}
var bagr=(r.runes||[]).map(function(x){return h('button',{class:'sm',disabled:!!x.had||r.rn.length>=r.maxRn,onclick:async function(){var y=await rpc('refine.rune',{iid:iid,rune:x.id});back(y)}},x.name+' ×'+x.n)});
var runes=h('div',{},[h('h4',{text:'符纹（'+r.rn.length+'/'+r.maxRn+'）'}),h('div',{class:'row'},socks),bagr.length?h('div',{class:'row'},bagr):h('div',{class:'muted',text:'没有符纹。炼器可制，秘境与灵兽也会带回。'})]);
clear(ov).appendChild(h('div',{class:'panel scr'},[h('div',{class:'burn'}),h('h2',{text:'淬炼 · '+r.name+' '+'★★★★★'.slice(0,r.q)}),h('h4',{text:'词缀（'+r.af.length+'/'+r.maxAf+'）'})].concat(rows).concat([cost,star,runes,h('div',{class:'row',style:'margin-top:10px'},[h('button',{onclick:shut},'收炉')])])))}
function farmCard(f){if(!f)return null;
function seedPick(i){if(!f.seeds.length){toast('手里没有种子，坊市有卖，游历战胜也会掉',true);return}var ov=$('overlay');ov.classList.remove('hidden');clear(ov).appendChild(h('div',{class:'panel scr'},[h('div',{class:'burn'}),h('h2',{text:'第 '+(i+1)+' 块田播什么'}),h('div',{class:'grid'},f.seeds.map(function(s){return h('div',{class:'item '+tcl(s.t)+(A['item_'+s.id]?' ic':''),onclick:async function(){ov.classList.add('hidden');var x=await rpc('farm.plant',{i:i,seed:s.id});if(x&&x.ok)go('home')}},[img('item_'+s.id),h('div',{class:'n',text:s.name+' ×'+s.n}),h('div',{class:'muted',text:s.h+' 小时后收 '+s.mat})])})),h('div',{class:'row',style:'margin-top:8px'},[h('button',{onclick:function(){ov.classList.add('hidden')}},'算了')])]))}
function tile(p){if(!p.seed)return h('div',{class:'item fe on',onclick:function(){seedPick(p.i)}},[h('div',{class:'n',text:'空田 '+(p.i+1)}),h('div',{class:'muted fh',text:'点此播种 ▾'})]);
var kids=[img('item_'+p.seed),h('div',{class:'n',text:p.name}),h('div',{class:'bar xp'},[h('i',{style:'width:'+(p.withered?100:p.pct)+'%'})])];
if(p.withered)kids.push(h('div',{class:'muted',text:'已枯萎'}),h('button',{class:'sm',onclick:async function(){var x=await rpc('farm.clear',{i:p.i});if(x)go('home')}},'清理'));
else if(p.ready)kids.push(h('div',{class:'muted',text:'可收 '+p.matName+(p.hurt?'（受损 '+p.hurt+'）':'')}),h('button',{class:'sm pri',onclick:async function(){var x=await rpc('farm.harvest',{i:p.i},{quiet:true});if(!x)return;if(x.ok===false){toast(x.msg,true);return}toast(x.msg);reveal((x.data.drops||[]).filter(function(z){return !z.lost}),function(){go('home')})}},'收获'));
else{kids.push(h('div',{class:'muted',text:'还需 '+dur(p.left)+(p.hurt?' · 受损 '+p.hurt:'')}));
if(p.ev)kids.push(h('div',{class:'muted',text:'⚠ '+p.ev.n+'　余 '+dur(p.ev.left)}),h('button',{class:'sm',onclick:async function(){var x=await rpc('farm.tend',{i:p.i});if(x)go('home')}},'处理（'+p.ev.cost+'）'))}
return h('div',{class:'item '+tcl(p.t)},kids)}
var row=h('div',{class:'muted',text:'手中种子：'+f.seeds.map(function(s){return s.name+' ×'+s.n}).join('、')});
return h('div',{class:'card'},[h('h3',{text:'灵田药圃'}),h('div',{class:'sub',text:'共 '+f.n+' 块 · 筑基、金丹与九宫聚灵阵各开一块'}),f.seeds.length?row:h('div',{class:'muted',text:'手里没有种子。坊市有卖，游历战胜也会掉。'}),h('div',{class:'grid',style:'margin-top:8px'},f.plots.map(tile)),h('div',{class:'muted',text:'成熟前每小时可能出事，两小时内不理会便受损；受损两次就枯了。'})])}
function petBody(d){var pv=d.pet||{};var p=pv.pet;
if(!p)return h('div',{},[h('div',{class:'muted',text:'尚无灵兽。行囊里的兽卵可以孵化——妖兽会掉，灵兽远行也会叼回来。'}),(pv.eggs&&pv.eggs.length)?h('div',{class:'row',style:'margin-top:8px'},pv.eggs.map(function(e){return h('button',{class:'pri sm',onclick:async function(){var x=await rpc('use',{id:e.id});if(x&&x.ok){var y=await rpc('pet',{},{quiet:true});if(y)renderBag(Object.assign({},d,y.data),'pet')}}},'孵化 '+e.name+'（'+e.pet+'）')})):null]);
async function reload(){var y=await rpc('pet',{},{quiet:true});if(y)renderBag(Object.assign({},d,y.data),'pet')}
var hpp=Math.round((p.hpP||0)*100);
var head=h('div',{class:'encp'},[portrait('mon_'+(p.mon||''),p.name,'mon'+((S.me&&S.me.vip)>=9?' aura':'')),h('div',{class:'grow'},[h('div',{class:'n row'},[tierTag(p.eggTier||0),p.name+'　'+p.lv+' 级'+['','　化形','　仙形'][p.ev||0]]),h('div',{class:'muted'},[elSpan(p.elem),'攻击 '+fmt(p.atk)+' · 气血 '+fmt(p.hp)]),h('div',{class:'bar hp'},[h('i',{style:'width:'+hpp+'%'})]),h('div',{class:'bar xp'},[h('i',{style:'width:'+(pv.maxed?100:pct(p.xp,p.need))+'%'})]),h('div',{class:'muted',text:'气血 '+hpp+'% · 历练 '+(pv.maxed?'圆满':p.xp+'/'+p.need)})])]);
var trip;
if(p.trip)trip=h('div',{},[h('h4',{text:'远行'}),h('div',{class:'row sb'},[h('span',{class:'grow',text:p.trip.regionName+' · '+(p.trip.ready?'已归来':'余 '+dur(p.trip.left))}),h('button',{class:'pri sm',disabled:!p.trip.ready,onclick:async function(){var x=await rpc('pet.collect',{},{quiet:true});if(!x)return;if(x.ok===false){toast(x.msg,true);return}toast(x.msg);reveal((x.data.drops||[]).filter(function(z){return !z.lost}),reload)}},'收取')])]);
else{var sel=h('select');(pv.regions||[]).forEach(function(rg){if(rg.open)sel.appendChild(h('option',{value:rg.id},rg.icon+' '+rg.name))});
trip=h('div',{},[h('h4',{text:'远行（今日余 '+pv.tripsLeft+' 次）'}),h('div',{class:'row'},[sel].concat((pv.hours||[4,8,12]).map(function(hh){return h('button',{class:'sm',disabled:pv.tripsLeft<=0||p.hpP<0.3,onclick:async function(){var x=await rpc('pet.send',{region:sel.value,hours:hh});if(x&&x.ok)reload()}},hh+' 小时')}))),h('div',{class:'muted',text:'远行期间不随你出战，气血不足三成不能远行。回来带材料，偶尔有兽卵或奇遇。'})])}
var feed=h('div',{},[h('h4',{text:'喂养'}),(pv.feed&&pv.feed.length)?h('div',{class:'row'},pv.feed.map(function(fd){return h('button',{class:'sm',onclick:async function(){var x=await rpc('pet.feed',{item:fd.id});if(x&&x.ok)reload()}},fd.name+' +'+fd.xp)})):h('div',{class:'muted',text:pv.maxed?'它已至二十级，历练圆满，再喂无益。':'材料与含修为的丹药都能喂。'})]);
var lack=(p.evoCost||[]).filter(function(z){return z.have<z.n});
var evoLb=p.canEvolve?'化形':(p.lv<p.evoLv?'化形（需 '+p.evoLv+' 级）':lack.length?'化形（缺 '+lack.map(function(z){return z.name+'×'+(z.n-z.have)}).join('、')+'）':'化形');
var evo=h('div',{class:'row',style:'margin-top:8px'},[p.evoLv?h('button',{class:'pri sm',disabled:!p.canEvolve,onclick:async function(){if(!(await sure('让'+p.name+'化形？消耗 '+p.evoCost.map(function(z){return z.name+'×'+z.n}).join('、'))))return;var x=await rpc('pet.evolve',{});if(x&&x.ok)reload()}},evoLb):null,
h('button',{class:'flat sm',onclick:async function(){var x=await rpc('pet.release',{},{quiet:true});if(!x)return;if(x.confirm){if(!(await sure(x.msg)))return;var y=await rpc('pet.release',{confirm:'1'});if(y&&y.ok)reload();return}toast(x.msg,x.ok===false)}},'放生')]);
return h('div',{},[head,trip,feed,evo,p.evoLv?h('div',{class:'muted',text:'化形材料：'+p.evoCost.map(function(z){return z.name+' '+z.have+'/'+z.n}).join('、')+'　化形后攻防 ×1.3'}):null])}

// ---------- market
VIEWS.market=async function(){var v=await rpc('shop',{},{quiet:true});if(!v)return;renderMarket(v.data)};
function renderMarket(d){var m=S.me;var re=d.shopRe||{left:0,cost:0};
var reBtn=h('button',{class:'sm',disabled:!re.left||m.ls<re.cost,title:re.left?'换一批货，已买过的不会重复出现':'今日补货次数已用尽',onclick:async function(){var x=await rpc('shop.refresh');if(x&&x.ok)renderMarket(Object.assign({},d,x.data))}},re.left?'补货 ◆'+re.cost+'（余 '+re.left+' 次）':'今日已补满');
var eBtn=h('button',{class:'sm',onclick:async function(){var x=await rpc('energy');if(x&&x.data&&x.data.energy)energyForm(x.data.energy,d)}},'能量供奉');
var shop=h('div',{class:'card'},[h('h3',{text:'坊市'}),h('div',{class:'row sb'},[h('span',{class:'sub',text:'每日换货 · 商队每日可请三次'}),h('span',{class:'num',text:'囊中 ◆ '+fmt(m.ls)})]),h('div',{class:'row',style:'margin-bottom:6px'},[reBtn,eBtn]),h('div',{class:'grid'},d.shop.map(function(s){return h('div',{class:'item '+tcl(s.t)+(s.left?'':' lock')+(A['item_'+s.id]?' ic':'')},[rimEl(s.t),img('item_'+s.id),h('div',{class:'n'},[h('span',{class:'tag '+tcl(s.t),text:KINDN[s.k]||s.k}),s.name]),h('div',{class:'muted',text:s.desc}),h('div',{class:'row sb',style:'margin-top:6px'},[h('span',{class:'num grow',text:'◆ '+s.price+' · 余 '+s.left}),h('button',{class:'sm pri',disabled:!s.left||m.ls<s.price,onclick:async function(){var x=await rpc('buy',{idx:s.idx});if(x&&x.ok)renderMarket(Object.assign({},d,x.data))}},'买')])])}))]);
var a=d.auctions||{open:[],mine:[],ended:[]};
function itemAttr(it){var o=[];if(it.st)for(var k in it.st)o.push((STN[k]||k)+' '+it.st[k]);if(it.af)it.af.forEach(function(f){o.push((f.n||STN[f.st]||f.st)+' +'+(f.v<1?Math.round(f.v*100)+'%':f.v))});if(it.rns&&it.rns.length)o.push('符纹：'+it.rns.map(function(z){return STN[z]||z}).join('、'));return o.length?o.join(' · '):(it.desc||'')}
function itemName(it){return it.name+(it.n?'×'+it.n:'')+(it.q?'（'+it.q+'星）':'')+(it.rn?'（'+it.rn+'纹）':'')}
function left(end){var s=Math.max(0,end-(S.me.now||Date.now()));return s>3600000?Math.round(s/3600000)+' 小时':Math.max(1,Math.round(s/60000))+' 分'}
var esc=Object.keys(a.escrow||{}).reduce(function(t,k){return t+(Number(a.escrow[k])||0)},0);var auc=h('div',{class:'card'},[h('h3',{text:'拍卖行'}),h('div',{class:'row sb'},[h('span',{class:'sub',text:'出价托管灵石，落槌由天道裁定，回来即自动结算'}),h('span',{class:'num',text:'囊中 ◆ '+fmt(m.ls)+(esc?'　托管 ◆ '+fmt(esc):'')})]),h('h4',{text:'在拍（'+(a.openTotal||a.open.length)+(a.openTotal>a.open.length?'，先列最先落槌的 '+a.open.length+' 件':'')+'）'}),h('div',{class:'list'},a.open.length?a.open.map(function(x){return h('div',{class:'row sb'},[h('span',{class:'row grow'},[img('item_'+x.item.id,'ico sm'),tierTag(x.item.t||0),h('span',{},[itemName(x.item)+' · '+x.seller+' · 余 '+left(x.end),h('div',{class:'muted',text:itemAttr(x.item)})])]),h('span',{class:'row'},[h('span',{class:'num',text:(x.top?'现价 '+x.top.amt:'起拍 '+x.min)+' '}),x.myBid?h('span',{class:'tag '+(x.top&&x.top.amt>x.myBid?'red':'gold'),text:'我出 '+x.myBid+(x.top&&x.top.amt>x.myBid?' · 已被超':' · 领先')}):null,h('button',{class:'sm pri',onclick:async function(){var amt=await ask('出价（不低于 '+(x.top?Math.ceil(x.top.amt*1.05):x.min)+'）',String(x.top?Math.ceil(x.top.amt*1.05):x.min),{type:'number'});if(!amt)return;var r=await rpc('auction.bid',{aid:x.aid,amt:Number(amt)});if(r&&r.ok)renderMarket(Object.assign({},d,r.data))}},'出价')])])}):h('div',{class:'muted',text:'空空如也。去行囊里把东西挂上来。'})),a.mine.length?h('h4',{text:'我的拍品'}):null,h('div',{class:'list'},a.mine.map(function(x){return h('div',{text:itemName(x.item)+' · '+(x.settled?(x.settled.winner?'成交 '+x.settled.price+'（'+x.settled.wname+'）':'流拍'):x.ended?'落槌，等待裁定':'在拍 余 '+left(x.end)+(x.top?' 现价 '+x.top.amt:' 无人出价'))+(x.claimed?' ✓':'')})})),a.ended.length?h('h4',{text:'已落槌（我参与的）'}):null,h('div',{class:'list'},a.ended.map(function(x){return h('div',{text:itemName(x.item)+' · '+(x.settled?(String(x.settled.winner)===String(m.uid)?'你拍得 '+x.settled.price:'他人拍得 '+x.settled.price):'等待裁定')})}))]);
var won=[];(a.ended||[]).forEach(function(x){if(x.settled&&x.claimed&&String(x.settled.winner)===String(m.uid)&&!S.seenAuc[x.aid]){S.seenAuc[x.aid]=1;won.push(x.item)}});
if(won.length)setTimeout(function(){reveal(won)},120);
var vs=d.vshop;var vcard=null;if(vs){vcard=h('div',{class:'card'},[h('div',{class:'row'},[h('h3',{text:'珍宝阁'}),vipBadge(vs.lv)]),h('div',{class:'sub',text:vs.lv?'会员专属货架，每日更新，贵一些但保证有货':'VIP1（累计供奉 '+vs.unlockAt+' 点能量）起开放。'}),vs.stock.length?h('div',{class:'grid'},vs.stock.map(function(s){return h('div',{class:'item '+tcl(s.t)+(s.left?'':' lock')},[rimEl(s.t),img('item_'+s.id),h('div',{class:'n'},[h('span',{class:'tag '+tcl(s.t),text:KINDN[s.k]||s.k}),(vs.excl||[]).indexOf(s.id)>=0?h('span',{class:'tag gold',text:'独家'}):null,s.name]),h('div',{class:'muted',text:s.desc}),h('div',{class:'row sb',style:'margin-top:6px'},[h('span',{class:'num grow',text:'◆ '+s.price+' · 余 '+s.left}),h('button',{class:'sm pri',disabled:!s.left||m.ls<s.price,onclick:async function(){var x=await rpc('vshop.buy',{idx:s.idx});if(x&&x.ok)renderMarket(Object.assign({},d,x.data))}},'买')])])})):h('div',{class:'muted',text:vs.lv?'今日货已售罄。':'在坊市点「能量供奉」即可开始累计。'}),vs.lv?null:vipCard(vs.vip)])}
screen([hero('market'),shop,vcard,auc])}

// ---------- arena + boss
VIEWS.arena=async function(){var v=await rpc('arena',{},{quiet:true});if(!v)return;var b=await rpc('boss',{},{quiet:true});renderArena(v.data.arena,b?b.data.boss:null,'ar')};
function renderArena(a,boss,sub,wx){var m=S.me;sub=sub||'ar';var kids=[hero('arena'),tipCard('arena'),subnav([['ar','论道'],['wx','棋局']],sub,function(x){if(x==='wx')wxLoad();else if(a)renderArena(a,boss,'ar');else VIEWS.arena()})];
if(sub==='wx'){renderWuxing(kids,wx);return}
kids.push(h('div',{class:'card'},[h('h3',{text:'论道'}),h('div',{class:'sub',text:'今日余 '+a.left+' 次'}),h('div',{class:'muted',text:'论道值 '+m.season.ar+' · 赛季积分 '+m.season.ss+' · '+m.season.w+' 胜 '+m.season.l+' 负 · 点到为止，不伤根基'}),h('div',{class:'list'},a.list.map(function(p){return h('div',{class:'row sb'},[h('span',{class:'grow'},[p.n+' ',h('span',{class:'tag',text:RN10[p.r]}),p.pa?h('span',{class:'tag '+(p.pa==='xie'?'red':'blue'),text:PATHN[p.pa]}):null,h('span',{class:'muted',text:' 战力 '+fmt(p.pw)+' · 论道 '+p.ar})]),h('button',{class:'sm pri',disabled:a.left<=0,onclick:async function(){var r=await rpc('arena.fight',{uid:p.uid},{quiet:true});if(!r)return;if(r.ok===false){toast(r.msg,true);return}replay(r.data.battle,function(){toast(r.msg);renderArena(r.data.arena,boss)})}},'论道')])})),h('div',{class:'row',style:'margin-top:8px'},[h('button',{class:'sm',disabled:a.refresh<=0,onclick:async function(){var r=await rpc('arena.refresh');if(r&&r.ok)renderArena(r.data.arena,boss)}},'换一批（余 '+a.refresh+'）')])]));
if(boss){var w=boss.world;kids.push(h('div',{class:'card'},[h('h3',{text:'讨伐'}),h('div',{class:'sub',text:w.boss.name+'（'+w.weather+'） · 今日余 '+boss.left+' 次'}),h('div',{class:'encp'},[portrait('mon_'+w.boss.id,w.boss.icon,'mon'),h('div',{class:'muted',text:w.boss.desc+' 伤害按自身境界折算威能，全服同榜。次日登录按名次领赏。'})]),h('div',{class:'row sb',style:'margin:8px 0'},[h('span',{class:'num',text:'我的威能 '+fmt(boss.mine)}),h('button',{class:'pri sm',disabled:boss.left<=0,onclick:async function(){var r=await rpc('boss.attack',{},{quiet:true});if(!r)return;if(r.ok===false){toast(r.msg,true);return}replay(r.data.battle,function(){toast(r.msg);renderArena(a,r.data.boss)})}},'出手')]),h('div',{class:'list'},boss.board.slice(0,20).map(function(b,i){return h('div',{class:'row'+(String(b.uid)===String(m.uid)?' me':'')},[h('span',{class:'rank',text:String(i+1)}),h('span',{class:'grow',text:b.n}),h('span',{class:'num',text:fmt(b.d)})])}))]))}
if(a.standings&&a.standings.length)kids.push(h('div',{class:'card'},[h('h3',{text:'赛季榜'}),h('div',{class:'sub',text:'论道 · 前 20 名'}),h('div',{class:'list'},a.standings.map(function(p){return h('div',{class:'row'+(String(p.uid)===String(m.uid)?' me':'')},[h('span',{class:'rank'+(p.rank<=3?' r'+p.rank:''),text:String(p.rank)}),h('span',{class:'grow',text:p.n+(p.pa?'（'+PATHN[p.pa]+'）':'')}),h('span',{class:'num',text:p.ss+' 分'})])})),h('div',{class:'muted',text:'赛季末前十名获能量奖励（5/3/1），前百名获灵石。'})]));
screen(kids)}

// ---------- 五行连珠
var WXN=['金','水','木','火','土'];
async function wxLoad(){var v=await rpc('wx',{},{quiet:true});if(!v)return;renderArena(null,null,'wx',v.data.wx)}
function wxDraw(d){renderArena(null,null,'wx',d)}
function wxTile(v,i){var st=S.wx;return h('div',{id:'wx'+i,class:'wxt e'+v+(st.sel===i?' sel':''),text:WXN[v],onclick:function(){wxTap(i)}})}
function wxTap(i){var st=S.wx;var d=st.d;
if(st.mode==='d'&&d.left<=0){toast('今日已交卷，可先练习',true);return}
if(st.sel===null||st.sel===undefined||st.sel===i){st.sel=st.sel===i?null:i;wxDraw(d);return}
var a=st.sel,ar=(a/6)|0,ac=a%6,br=(i/6)|0,bc=i%6;
if(Math.abs(ar-br)+Math.abs(ac-bc)!==1){st.sel=i;wxDraw(d);return}
if(st.moves.length>=d.moves){toast('步数已尽',true);return}
var res=wxSim(st.seed,st.moves.concat([[ar,ac,br,bc]]));
if(!res.ok){st.sel=null;var e0=$('wx'+a);if(e0)e0.classList.remove('sel');var e1=$('wx'+i);if(e1){e1.classList.remove('bad');void e1.offsetWidth;e1.classList.add('bad')}toast('这一步不成连珠',true);return}
st.moves=st.moves.concat([[ar,ac,br,bc]]);st.sel=null;
var f0=$('wx'+a),f1=$('wx'+i);if(f0)f0.classList.add('clr');if(f1)f1.classList.add('clr');
setTimeout(function(){wxDraw(d)},280)}
function renderWuxing(kids,d){var tc=tipCard('wx');if(tc)kids.push(tc);if(!d){screen(kids);return}
if(!S.wx||S.wx.day!==d.day)S.wx={day:d.day,seed:d.seed,moves:[],sel:null,mode:'d',d:d};
S.wx.d=d;var st=S.wx;var res=wxSim(st.seed,st.moves);var done=d.left<=0;
kids.push(h('div',{class:'card'},[h('h3',{text:'五行连珠'+(st.mode==='p'?'（练习盘）':'')}),
h('div',{class:'sub',text:'金生水生木生火生土生金'}),
h('div',{class:'muted',text:'交换相邻两子，横竖三子以上相生或同气即成连珠：相生 10×长²，同气 4×长²，连锁一次多算五成。不成连珠的交换无效。'}),
h('div',{class:'row sb',style:'margin-top:6px'},[h('span',{class:'num',text:'第 '+st.moves.length+'/'+d.moves+' 步'}),h('span',{class:'num',text:fmt(res.score)+' 分'}),h('span',{class:'muted',text:'连珠 '+res.chains+' · 最长 '+res.max})]),
h('div',{class:'wxg'},res.board.map(wxTile)),
h('div',{class:'row',style:'margin-top:8px'},[
st.mode==='d'?h('button',{class:'pri',disabled:done||!st.moves.length,onclick:async function(){if(st.moves.length<d.moves&&!(await sure('还剩 '+(d.moves-st.moves.length)+' 步，就此交卷？')))return;var v=await rpc('wx.submit',{moves:st.moves},{quiet:true});if(!v)return;if(v.ok===false){toast(v.msg,true);return}toast(v.msg);var got=((v.data.wxres&&v.data.wxres.drops)||[]).filter(function(z){return !z.lost});S.wx=null;if(got.length){reveal(got,function(){renderArena(null,null,'wx',v.data.wx)});return}renderArena(null,null,'wx',v.data.wx)}},done?'今日已交卷':'交卷'):null,
h('button',{class:'sm',onclick:function(){S.wx={day:d.day,seed:st.mode==='d'?('wxp:'+Date.now()):d.seed,moves:[],sel:null,mode:st.mode==='d'?'p':'d',d:d};wxDraw(d)}},st.mode==='d'?'练习盘':'回到今日'),
h('button',{class:'sm',disabled:!st.moves.length&&st.mode==='d',onclick:function(){S.wx={day:d.day,seed:st.mode==='p'?('wxp:'+Date.now()):d.seed,moves:[],sel:null,mode:st.mode,d:d};wxDraw(d)}},st.mode==='p'?'换一盘':'重来')]),
d.mine?h('div',{class:'muted',style:'margin-top:6px',text:'今日已交卷 '+fmt(d.mine.sc)+' 分'+(d.rank?'，第 '+d.rank+' 名':'')}):h('div',{class:'muted',style:'margin-top:6px',text:fmt(d.tiers[0])+' 分起给灵石，'+fmt(d.tiers[1])+' 分加材料，'+fmt(d.tiers[2])+' 分另赠悟性。'})]));
kids.push(h('div',{class:'card'},[h('h3',{text:'今日棋榜'}),h('div',{class:'list'},d.board.length?d.board.map(function(x){return h('div',{class:'row'+(String(x.uid)===String(S.me.uid)?' me':'')},[h('span',{class:'rank',text:String(x.rank)}),h('span',{class:'grow',text:x.n}),h('span',{class:'num',text:fmt(x.sc)+' 分'})])}):h('div',{class:'muted',text:'今日还没有人落子。'}))]));
screen(kids)}

// ---------- sect
VIEWS.sect=async function(){var v=await rpc('sect',{},{quiet:true});if(!v)return;renderSect(v.data)};
function renderSect(d){var m=S.me;var kids=[hero('sect'),tipCard('sect')];
if(d.sect){var s=d.sect;var isLeader=s.myRole==='掌门';kids.push(h('div',{class:'card'},[h('h3',{text:s.name}),h('div',{class:'sub',text:s.level+' 级 · '+s.memberCount+' 人'}),h('div',{class:'muted',text:s.desc||'（无宗旨）'}),h('div',{class:'kv'},[h('b',{text:'掌门'}),h('span',{text:s.leaderName}),h('b',{text:'我'}),h('span',{text:s.myRole+' · 贡献 '+s.myPts}),h('b',{text:'宗门加持'}),h('span',{text:'修炼 +'+s.buff+'%'}),h('b',{text:'入门要求'}),h('span',{text:RN[s.req]+'以上'})]),h('div',{class:'row',style:'margin-top:8px'},[h('button',{class:'sm pri',onclick:async function(){var amt=await ask('捐献灵石（10 灵石 = 1 贡献）','100',{type:'number'});if(!amt)return;var r=await rpc('sect.donate',{amt:Number(amt)});if(r&&r.ok)renderSect(Object.assign({},d,r.data))}},'捐献'),s.wage&&s.wage.lv>0?h('button',{class:'sm',disabled:!!s.wage.taken,onclick:async function(){var r=await rpc('sect.wage');if(r&&r.ok)renderSect(Object.assign({},d,r.data))}},s.wage.taken?'俸禄已领':'领俸禄 '+s.wage.amount):null,!isLeader?h('button',{class:'sm danger',onclick:async function(){if(!(await sure('退出宗门？贡献清零，一日内各宗不收。')))return;var r=await rpc('sect.leave');if(r&&r.ok)go('sect')}},'退出'):null])]));
if(d.sboss)kids.push(h('div',{class:'card'},[h('h3',{text:'宗门试炼'}),h('div',{class:'sub',text:d.sboss.boss.name+' · 每日 2 次'}),h('div',{class:'muted',text:'伤害计入贡献，全宗周榜。'}),h('button',{class:'pri sm',onclick:async function(){var r=await rpc('sect.boss',{},{quiet:true});if(!r)return;if(r.ok===false){toast(r.msg,true);return}replay(r.data.battle,function(){toast(r.msg);go('sect')})}},'出手'),h('div',{class:'list',style:'margin-top:6px'},d.sboss.board.slice(0,10).map(function(b,i){return h('div',{class:'row'},[h('span',{class:'rank',text:String(i+1)}),h('span',{class:'grow',text:b.n}),h('span',{class:'num',text:fmt(b.d)})])}))]));
if(s.costs)kids.push(h('div',{class:'card'},[h('h3',{text:'宗门建设'}),h('div',{class:'sub',text:'库藏 '+fmt(s.treasury)+' 贡献 · 已用 '+fmt(s.spent)}),h('div',{class:'list'},s.costs.map(function(b){
return h('div',{class:'row sb'},[h('span',{class:'grow'},[h('b',{text:b.name}),' ',h('span',{class:'stars',text:'●●●●●'.slice(0,b.lv)+'○○○○○'.slice(0,b.max-b.lv)}),h('div',{class:'muted',text:b.desc})]),
b.cost===null?h('span',{class:'tag gold',text:'已至顶'}):h('button',{class:s.canBuild&&s.treasury>=b.cost?'sm pri':'sm',disabled:!s.canBuild||s.treasury<b.cost,onclick:async function(){if(!(await sure('动用 '+b.cost+' 库藏，把'+b.name+'修到 '+(b.lv+1)+' 级？')))return;var r=await rpc('sect.build',{b:b.k});if(!r||!r.ok)return;var f=await rpc('sect',{},{quiet:true});renderSect(Object.assign({},d,(f&&f.data)||r.data))}},'升级 '+b.cost)])})),h('div',{class:'muted',text:s.canBuild?'掌门与长老可动用库藏。库藏 = 全宗贡献 - 已用。':'库藏由掌门与长老支配。你的每一次捐献都算在里面。'})]));
if(s.wk)kids.push(h('div',{class:'card'},[h('h3',{text:'本周宗务'}),h('div',{class:'sub',text:'余 '+s.wk.daysLeft+' 天 · 达成几条，下周一并发赏'}),h('div',{},[['don','捐献贡献'],['sb','试炼出手'],['aw','论道胜场']].map(function(g){var cur=s.wk.cur[g[0]]||0,need=s.wk.goals[g[0]]||1;
return h('div',{style:'margin:6px 0'},[h('div',{class:'row sb'},[h('span',{text:g[1]}),h('span',{class:'num',text:fmt(cur)+' / '+fmt(need)})]),h('div',{class:'bar xp'},[h('i',{style:'width:'+pct(cur,need)+'%'})])])})),h('div',{class:'muted',text:(s.last?'上周达成 '+s.last.done+'/3。':'')+'上周出过力的人，本周登录时自动领赏。'})]));
kids.push(h('div',{class:'card'},[h('h3',{text:'门人'}),h('div',{class:'list'},s.members.map(function(p){return h('div',{class:'row sb'},[h('span',{class:'grow'},[h('span',{class:'tag '+(p.role==='掌门'?'gold':p.role==='长老'?'purple':''),text:p.role}),p.n+' ',h('span',{class:'muted',text:RN10[p.r]+' · 战力 '+fmt(p.pw)+' · 贡献 '+p.pts})]),isLeader&&String(p.uid)!==String(m.uid)?h('span',{},[p.role==='长老'?h('button',{class:'sm',onclick:function(){mg('dismiss',p.uid)}},'免长老'):h('button',{class:'sm',onclick:function(){mg('appoint',p.uid)}},'任长老'),h('button',{class:'sm',onclick:async function(){if(await sure('传位给 '+p.n+'？'))mg('transfer',p.uid)}},'传位'),h('button',{class:'sm danger',onclick:async function(){if(await sure('逐出 '+p.n+'？'))mg('ban',p.uid)}},'逐出')]):null])}))]));
if(isLeader)kids.push(h('div',{class:'card'},[h('h3',{text:'掌门事务'}),h('div',{class:'row'},[h('button',{class:'sm',onclick:async function(){var r=await ask('入门最低境界（0 炼气 … 8 渡劫）',String(s.req),{type:'number'});if(r!==null)mg('setReq',null,{req:Number(r)})}},'入门要求'),h('button',{class:'sm',onclick:async function(){var t=await ask('宗旨（80 字内）',s.desc||'');if(t!==null)mg('setDesc',null,{desc:t})}},'改宗旨'),h('button',{class:'sm danger',onclick:async function(){if(await sure('解散宗门？不可恢复。'))mg('disband')}},'解散')])]));
async function mg(action,uid,extra){var p=Object.assign({action:action},uid!==null&&uid!==undefined?{uid:uid}:{},extra||{});var r=await rpc('sect.manage',p);if(r&&r.ok)go('sect')}}
else{var name=h('input',{placeholder:'宗门名（2-8 字）',maxlength:8}),desc=h('input',{placeholder:'宗旨（可空）',maxlength:80});kids.push(h('div',{class:'card'},[h('h3',{text:'你是散修'}),h('div',{class:'muted',text:'加入宗门可获修炼加持与宗门试炼；金丹之后可花 '+d.cost+' 灵石开宗立派。'}),m.r>=2?h('div',{style:'margin-top:8px'},[name,h('div',{style:'height:6px'}),desc,h('button',{class:'pri',style:'margin-top:6px',disabled:m.ls<d.cost,onclick:async function(){var r=await rpc('sect.create',{name:name.value.trim(),desc:desc.value});if(r&&r.ok)go('sect')}},'开宗立派')]):null]))}
kids.push(h('div',{class:'card'},[h('h3',{text:'诸宗'}),h('div',{class:'list'},d.list.length?d.list.map(function(s){return h('div',{class:'row sb'},[h('span',{class:'grow'},[s.name+' ',h('span',{class:'muted',text:s.level+' 级 · '+s.members+' 人 · 掌门 '+s.leaderName+' · 需'+RN[s.req]}),h('div',{class:'muted',text:s.desc||''})]),!m.sect?h('button',{class:'sm pri',onclick:async function(){var r=await rpc('sect.join',{sid:s.sid});if(r&&r.ok)go('sect')}},'拜入'):null])}):h('div',{class:'muted',text:'天下尚无宗门。第一个开宗的人，会被记住。'}))]));
screen(kids)}

// ---------- leaderboards
VIEWS.lb=async function(){lbLoad('realm')};
async function lbLoad(type){var v=await rpc('lb',{type:type},{quiet:true});if(!v)return;var kids=[hero('lb'),h('div',{class:'card'},[h('div',{class:'row'},[['realm','境界'],['power','战力'],['arena','论道'],['season','赛季'],['wealth','财富'],['sect','宗门'],['xian','仙籍']].map(function(t){return h('button',{class:(type===t[0]?'pri ':'')+'sm',onclick:function(){lbLoad(t[0])}},t[1])}))]),lbCard(v.data.lb)];screen(kids)}
var LBSEAL=['','壹','貳','叁'];
function lbVal(r){return typeof r.v==='number'?fmt(r.v):String(r.v)}
// Top three as an ink-mountain podium: first centred and raised inside a gold ring, second 青玉, third 赤铜.
function podium(top){var box=h('div',{class:'podium'});
function gate(x,top,w,hh,col,lit,glyph){var l=x-w/2,r=x+w/2,b=top+hh;return '<path d="M'+(l-7)+' '+(top+12)+' L'+x+' '+(top-7)+' L'+(r+7)+' '+(top+12)+'Z" fill="'+col+'" opacity=".85"/><path d="M'+(l-4)+' '+(top+10)+' L'+x+' '+(top-2)+' L'+(r+4)+' '+(top+10)+'" fill="none" stroke="'+lit+'" stroke-width="1"/><rect x="'+l+'" y="'+(top+10)+'" width="'+w+'" height="'+(hh-10)+'" fill="#0d1520" stroke="'+col+'" stroke-width="1.4"/><rect x="'+(l+5)+'" y="'+(top+15)+'" width="'+(w-10)+'" height="'+(hh-20)+'" fill="none" stroke="'+col+'" stroke-opacity=".35" stroke-width=".7"/><path d="M'+(l+5)+' '+(top+44)+' H'+(r-5)+'" stroke="'+col+'" stroke-opacity=".5"/><circle cx="'+x+'" cy="'+(top+30)+'" r="12" fill="'+col+'"/><circle cx="'+x+'" cy="'+(top+30)+'" r="12" fill="none" stroke="'+lit+'" stroke-width="1"/><text x="'+x+'" y="'+(top+35)+'" font-family="STKaiti,KaiTi,serif" font-size="13" fill="#1d1607" text-anchor="middle">'+glyph+'</text><circle cx="'+x+'" cy="'+(top+30)+'" r="17" fill="none" stroke="'+lit+'" stroke-opacity=".4" stroke-dasharray="2 4"/>'}
box.innerHTML='<svg viewBox="0 0 360 170" aria-hidden="true"><defs><filter id="wdcl" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="5"/></filter><radialGradient id="wdlt" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#F3E2B3" stop-opacity=".6"/><stop offset="1" stop-color="#D6B36A" stop-opacity="0"/></radialGradient></defs>'+
'<circle cx="180" cy="46" r="54" fill="url(#wdlt)"/>'+
'<path d="M0 170 L30 136 L62 122 L96 140 L130 170Z" fill="#131d28"/><path d="M230 170 L262 142 L300 126 L330 146 L360 170Z" fill="#131d28"/><path d="M96 170 L136 126 L158 140 L180 100 L206 136 L228 146 L266 170Z" fill="#1a2633"/>'+
'<g filter="url(#wdcl)" opacity=".6"><ellipse cx="60" cy="151" rx="62" ry="7" fill="#3a4a5a"/><ellipse cx="300" cy="151" rx="62" ry="7" fill="#3a4a5a"/><ellipse cx="180" cy="151" rx="70" ry="6" fill="#3a4a5a"/></g>'+
gate(60,50,74,98,'#5fa37a','#bfe6c8','貳')+gate(300,60,74,88,'#c2734a','#f2c29a','叁')+gate(180,20,76,128,'#D6B36A','#F3E2B3','壹')+
'</svg>';
var pods=h('div',{class:'pods'});
[[1,'p2'],[0,'p1'],[2,'p3']].forEach(function(x){var r=top[x[0]];
var pm=[lbVal(r)===r.realm?null:r.realm,r.pa?PATHN[r.pa]:null,r.title].filter(Boolean).join(' · ');
pods.appendChild(h('div',{class:'pod '+x[1]},[h('span',{class:'sl',text:LBSEAL[r.rank]||String(r.rank)}),h('div',{class:'pn',title:r.n,text:r.n}),pm?h('div',{class:'pv pm',title:pm,text:pm}):null,h('div',{class:'pv',text:lbVal(r)})]))});
box.appendChild(pods);return box}
function lbRow(r,me){return h('div',{class:'row'+(me&&String(r.uid)===String(me.uid)?' me':'')},[h('span',{class:'rank'+(r.rank<=3?' r'+r.rank:''),text:String(r.rank)}),h('span',{class:'grow'},[r.n+' ',r.realm?h('span',{class:'muted',text:r.realm}):null,r.pa?h('span',{class:'tag '+(r.pa==='xie'?'red':'blue'),text:PATHN[r.pa]}):null,r.title?h('span',{class:'tag purple',text:r.title}):null,r.sub?h('div',{class:'muted',text:r.sub}):null]),h('span',{class:'num',text:lbVal(r)})])}
function lbCard(lb){if(!lb)return h('div');var rows=lb.rows||[];var me=S.me;
var kids=[h('h3',{text:'榜'}),h('div',{class:'sub',text:'共 '+(lb.total||rows.length)+' 人'})];
var rest=rows;
if(rows.length>=3){kids.push(podium(rows.slice(0,3)));rest=rows.slice(3)}
var pin=!!(lb.me&&!rows.some(function(r){return String(r.uid)===String(lb.me.uid)}));
kids.push(h('div',{class:'list'},rest.map(function(r){return lbRow(r,me)})));
if(pin)kids.push(h('div',{class:'note pin'},[lbRow(lb.me,me)]));
return h('div',{class:'card'},kids)}

// ---------- 道册（悬赏 / 成就 / 传记）
VIEWS.bio=async function(){bioLoad(S.bioSub||'bounty')};
async function bioLoad(sub){S.bioSub=sub;
var v=await rpc(sub==='ach'?'ach':sub==='life'?'bio':sub==='codex'?'codex':'bounty',{},{quiet:true});if(!v)return;var d=v.data;var m=S.me;
var nav=h('div',{class:'row'},[['bounty','悬赏'],['ach','成就'],['codex','图鉴'],['life','传记']].map(function(t){return h('button',{class:sub===t[0]?'pri sm':'sm',onclick:function(){bioLoad(t[0])}},t[1])}));
var kids=[hero('bio')];
if(sub==='bounty'){var tc=tipCard('bounty');if(tc)kids.push(tc);kids.push(bountyCard(d.bounty,nav));}
else if(sub==='ach')kids.push(achCard(d.ach,nav));
else if(sub==='codex')kids.push(codexCard(d.codex,nav));
else kids=[hero('bio'),h('div',{class:'card'},[nav])].concat(lifeCards(d,m));
screen(kids)}
function bountyCard(b,nav){if(!b)return h('div',{class:'card'},[nav]);
var card;var rows=b.list.map(function(x){
var lab=x.claimed?h('span',{class:'tag gold',text:'已领'}):h('button',{class:x.done?'sm pri':'sm',disabled:!x.done,onclick:async function(){var r=await rpc('bounty.claim',{i:x.i},{quiet:true});if(!r)return;if(r.ok===false){toast(r.msg,true);return}
var fin=function(){toast(r.msg);bioLoad('bounty')};
if(r.data&&r.data.bounty&&r.data.bounty.allClaimed){qiBurst(card);setTimeout(fin,950);return}
if(r.data&&r.data.drops&&r.data.drops.length)reveal(r.data.drops,fin);else fin()}},'领取');
return h('div',{class:'tut'+(x.done?' ok':'')},[h('span',{class:'mk',text:x.done?'✓':'○'}),h('div',{class:'grow'},[h('b',{text:x.name}),h('div',{class:'muted',text:x.text}),h('div',{class:'bar xp'},[h('i',{style:'width:'+pct(x.cur,x.need)+'%'})]),h('div',{class:'muted',text:x.cur+' / '+x.need+' · 赏 '+x.ls+' 灵石与一件材料'})]),lab])});
var tail=b.allClaimed?'今日三赏皆结，悟性已 +1。已连续 '+b.streak+' 日。':'三张皆结：悟性 +1；连续七日得一只宝匣（还差 '+b.allReward.chestIn+' 日）。';
card=h('div',{class:'card'},[nav,h('h3',{text:'悬赏'}),h('div',{class:'sub',text:'今日 '+b.doneN+'/'+b.total+' · 连续 '+b.streak+' 日'}),h('div',{},rows),h('div',{class:'muted',style:'margin-top:8px',text:tail})]);
return card}
// 百科图鉴：物品按类、妖兽一类。纯静态数据，只拉一次。
function codexCard(cx,nav){if(!cx)return h('div',{class:'card'},[nav]);var kind=S.cxKind||'pill';var box=h('div',{});
var kb=h('div',{class:'row'},cx.kinds.map(function(k){return h('button',{class:kind===k[0]?'pri sm':'sm',onclick:function(){S.cxKind=k[0];bioLoad('codex')}},k[1])}));
var rows;if(kind==='mon'){rows=cx.mons.map(function(x){var mm=x.m||{};return h('div',{class:'row',style:'align-items:flex-start'},[portrait('mon_'+x.id,x.icon,'ico'),h('div',{class:'grow'},[h('div',{},[tierTag(x.t),x.name+' ',x.elem?elSpan(x.elem):null,x.boss?h('span',{class:'tag red',text:'头目'}):null]),h('div',{class:'muted',text:x.desc}),h('div',{class:'muted',text:'出没：'+(x.region||'—')+' · 血 ×'+(mm.hp||1)+' 攻 ×'+(mm.atk||1)+' 防 ×'+(mm.def||1)+' 速 ×'+(mm.spd||1)}),x.drops.length?h('div',{class:'muted',text:'掉落：'+x.drops.map(function(d){return d.name+(d.n>1?'×'+d.n:'')+' '+d.p+'%'}).join('、')}):null])])})}
else{rows=cx.items.filter(function(x){return x.k===kind}).map(function(x){var ex=[];if(x.st)for(var k in x.st)ex.push((STN[k]||k)+' +'+x.st[k]);if(x.slot)ex.unshift(SLOTN[x.slot]||x.slot);if(x.pet)ex.push(x.pet.name+' · '+x.pet.elem+' · 攻 '+Math.round(x.pet.atk*100)+'% 血 '+Math.round(x.pet.hp*100)+'%');if(x.fx)ex.push(x.fx);
return h('div',{class:'row',style:'align-items:flex-start'},[img('item_'+x.id,'ico sm'),h('div',{class:'grow'},[h('div',{},[tierTag(x.t),x.name,h('span',{class:'muted',text:'　售 '+fmt(x.v)})]),h('div',{class:'muted',text:x.desc}),ex.length?h('div',{class:'muted',text:ex.join(' · ')}):null])])})}
return h('div',{class:'card'},[nav,h('h3',{text:'图鉴'}),h('div',{class:'sub',text:'天机阁所录：'+cx.items.length+' 件物品，'+cx.mons.length+' 种妖兽'}),kb,h('div',{class:'list',style:'margin-top:8px'},rows.length?rows:[h('div',{class:'muted',text:'此卷尚空。'})])])}
function achCard(a,nav){if(!a)return h('div',{class:'card'},[nav]);
var tbtns=[h('button',{class:a.cur?'sm':'pri sm',onclick:async function(){var r=await rpc('ach.title',{id:null});if(r&&r.ok)bioLoad('ach')}},'不用称号')].concat(a.titles.map(function(t){return h('button',{class:a.cur===t.title?'pri sm':'sm',onclick:async function(){var r=await rpc('ach.title',{id:t.id});if(r&&r.ok)bioLoad('ach')}},t.title)}));
return h('div',{class:'card'},[nav,h('h3',{text:'成就'}),h('div',{class:'sub',text:'已成 '+a.done+' / '+a.total+(a.cur?' · 当前称号 '+a.cur:'')}),h('h4',{text:'称号'}),h('div',{class:'row'},tbtns),h('div',{class:'muted',text:a.titles.length?'佩戴后显示在顶栏你的名字旁，以及各榜单你那一行。':'尚无称号。下面带紫色标签的成就，达成即可佩戴。'}),h('div',{class:'list'},a.list.map(function(x){
return h('div',{class:'row sb'},[h('span',{class:'grow'},[h('span',{class:'tag'+(x.done?' gold':''),text:x.done?'✓':'○'}),x.name+' ',h('span',{class:'muted',text:x.desc})]),h('span',{},[x.title?h('span',{class:'tag purple',text:x.title}):null,x.ls?h('span',{class:'tag',text:x.ls+' 灵石'}):null,x.wu?h('span',{class:'tag green',text:'悟性 +'+x.wu}):null])])}))])}
function lifeCards(d,m){var st=d.stats||{};
return [h('div',{class:'card'},[h('h3',{text:m.name+'传'}),h('div',{class:'kv num'},[h('b',{text:'战斗'}),h('span',{text:st.fights+' 场，胜 '+st.wins}),h('b',{text:'游历'}),h('span',{text:String(st.explores)}),h('b',{text:'突破'}),h('span',{text:st.bt+' 次，失败 '+st.btFail}),h('b',{text:'渡劫'}),h('span',{text:String(st.tribs)}),h('b',{text:'炼制'}),h('span',{text:String(st.crafts)}),h('b',{text:'道统'}),h('span',{text:(d.legacy.pts||0)+' 点 · 第 '+m.lives+' 世'})])]),h('div',{class:'card'},[h('h3',{text:'年谱'}),h('div',{class:'list'},d.bio.map(function(b){var dt=new Date(b.t);return h('div',{},[h('span',{class:'muted',text:dt.getMonth()+1+'/'+dt.getDate()+' '}),b.v])}))]),d.legacy.history&&d.legacy.history.length?h('div',{class:'card'},[h('h3',{text:'前世'}),h('div',{class:'list'},d.legacy.history.map(function(x){return h('div',{text:x.name+' · '+x.cause+' · '+x.age+' 岁'})}))]):null]}

boot();
})();
`;
}

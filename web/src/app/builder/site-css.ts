/** CSS shipped inside every published site. String.raw keeps backslashes (for example the \2013 dash) intact. */
export const SITE_CSS = String.raw`
.site{--bg:var(--bg-l);--text:var(--text-l);--muted:color-mix(in srgb,var(--text) 62%,var(--bg));--line:color-mix(in srgb,var(--text) 14%,var(--bg));--card:color-mix(in srgb,var(--text) 5%,var(--bg));container-type:inline-size;background:var(--bg);color:var(--text);font-family:var(--font);font-size:17px;line-height:1.6;min-height:100%;-webkit-text-size-adjust:100%}
.site.dark{--bg:#0f1318;--text:#eceff3}
.site.ov{display:contents;container-type:normal;background:none;min-height:0}
.site *,.site *::before,.site *::after{box-sizing:border-box}
.site h1,.site h2,.site h3,.site p,.site figure{margin:0}
.site img{max-width:100%;display:block}
.s-page[hidden]{display:none}
.is-hidden{display:none!important}
.s-b{position:relative;padding:var(--py,56px) 24px}
.s-in{max-width:1080px;margin:0 auto}
.s-navbar{--py:16px;border-bottom:1px solid var(--line);background:var(--bg)}
.s-navbar[data-sticky]{position:sticky;top:0;z-index:20}
.s-spacer{--py:0px}
.s-footer{--py:32px;border-top:1px solid var(--line)}
.s-nav-in,.s-foot{display:flex;align-items:center;justify-content:space-between;gap:12px 24px;flex-wrap:wrap}
.s-brand{font-weight:700;font-size:1.15em;letter-spacing:-.01em;cursor:pointer}
.s-links{display:flex;gap:6px 22px;flex-wrap:wrap;font-size:.95em}
.s-links a{color:var(--muted);cursor:pointer;font-weight:500;text-decoration:none}
.s-links a:hover{color:var(--primary)}
.s-foot{color:var(--muted);font-size:.92em}
.s-eyebrow{font-size:.78em;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:var(--primary);margin-bottom:14px}
.s-hero-in{display:grid;gap:40px;align-items:center}
.s-hero-in.has-img{grid-template-columns:1.1fr .9fr}
.s-hero h1{font-size:var(--fs,clamp(2.1rem,7cqw,4rem));line-height:1.06;letter-spacing:-.025em;text-wrap:balance;font-weight:700}
.s-sub{font-size:1.18em;color:var(--muted);margin-top:18px;max-width:46ch;margin-left:var(--ml,0);margin-right:var(--mr,auto)}
.s-hero .s-btn{margin-top:28px}
.s-hero-img,.s-split img{width:100%;border-radius:calc(var(--radius)*1.6);aspect-ratio:4/3;object-fit:cover}
.s-h{font-size:var(--fs,clamp(1.6rem,4.6cqw,2.6rem));line-height:1.15;letter-spacing:-.02em;font-weight:700;text-wrap:balance}
.s-p{font-size:var(--fs,1.06em);max-width:68ch;margin-left:var(--ml,0);margin-right:var(--mr,auto)}
.s-split{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
.s-split.flip>:first-child{order:2}
.s-split p{color:var(--muted);margin-top:14px}
.s-split .s-btn{margin-top:22px}
.s-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:.78em 1.4em;border-radius:var(--radius);background:var(--primary);color:var(--on-primary);border:2px solid var(--primary);font:600 1em/1.2 var(--font);text-decoration:none;cursor:pointer;transition:transform .12s,filter .12s}
.s-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
.s-btn.outline{background:transparent;color:var(--primary)}
.s-btn.soft{background:color-mix(in srgb,var(--primary) 16%,transparent);color:var(--primary);border-color:transparent}
.s-btn.sm{font-size:.88em}.s-btn.lg{font-size:1.15em}
.s-btn.full{display:flex;width:100%}
.s-fig{max-width:var(--w,100%);margin-left:var(--ml,0);margin-right:var(--mr,auto)}
.s-fig img{width:100%;height:auto;border-radius:calc(var(--radius)*1.6)}
.s-fig figcaption{font-size:.88em;color:var(--muted);margin-top:10px}
.s-cards-grid{display:grid;grid-template-columns:repeat(var(--cols,3),minmax(0,1fr));gap:20px;margin-top:28px;text-align:left}
.s-card{background:var(--card);border:1px solid var(--line);border-radius:calc(var(--radius)*1.6);padding:24px}
.s-card h3{font-size:1.15em;margin-bottom:8px}
.s-card p{color:var(--muted);font-size:.96em}
.s-faq-list{margin-top:24px;border-top:1px solid var(--line);text-align:left}
.s-faq details{border-bottom:1px solid var(--line);padding:16px 0}
.s-faq summary{cursor:pointer;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:16px}
.s-faq summary::-webkit-details-marker{display:none}
.s-faq summary::after{content:"+";color:var(--primary);font-weight:700}
.s-faq details[open] summary::after{content:"\2013"}
.s-faq details p{color:var(--muted);margin-top:10px;max-width:68ch}
.s-form{display:grid;gap:14px;max-width:520px;margin-top:20px;margin-left:var(--ml,0);margin-right:var(--mr,auto);text-align:left}
.s-form label{display:grid;gap:6px;font-weight:600;font-size:.92em}
.s-form input,.s-form textarea{font:inherit;font-weight:400;padding:.7em .85em;border-radius:var(--radius);border:1px solid var(--line);background:var(--bg);color:var(--text);width:100%}
.s-form textarea{min-height:120px;resize:vertical}
.s-form input:focus,.s-form textarea:focus{outline:2px solid var(--primary);outline-offset:1px}
.s-form .s-btn{justify-self:start}
.s-form-ok{color:var(--primary);font-weight:600;margin-top:14px}
.s-hr{border:0;border-top:1px solid var(--line);margin:0}
.s-b.s-popup{position:fixed;inset:0;z-index:60;background:rgba(10,12,16,.55);display:grid;place-items:center;padding:24px;overflow:auto}
.s-pop-card{position:relative;background:var(--bg);color:var(--text);border-radius:calc(var(--radius)*2);padding:32px;width:min(460px,100%);box-shadow:0 24px 80px rgba(0,0,0,.35);font-family:var(--font);line-height:1.6;text-align:left}
.s-pop-card .s-h{font-size:1.5rem}
.s-pop-card .s-p{color:var(--muted);margin-top:10px}
.s-pop-card .s-btn{margin-top:20px}
.s-x{position:absolute;top:10px;right:12px;border:0;background:none;color:var(--muted);font-size:26px;line-height:1;cursor:pointer}
.s-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--text);color:var(--bg);padding:11px 18px;border-radius:999px;z-index:99;font:500 15px/1.3 var(--font);box-shadow:0 8px 30px rgba(0,0,0,.3);max-width:calc(100% - 32px);text-align:center}
@container (max-width:720px){
  .s-hero-in.has-img,.s-split{grid-template-columns:minmax(0,1fr)}
  .s-split.flip>:first-child{order:0}
  .s-cards-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .s-b{padding-left:18px;padding-right:18px}
}
@container (max-width:480px){.s-cards-grid{grid-template-columns:minmax(0,1fr)}}
`;

/** Extra rules that only apply inside the editor canvas. They never reach a published site. */
export const EDIT_CSS = String.raw`
.is-edit{min-height:62vh}
.is-edit a,.is-edit .s-btn{cursor:text}
.is-edit .s-b:hover{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 55%,transparent)}
.is-edit .s-b.sel{box-shadow:inset 0 0 0 2px var(--accent)}
.is-edit .s-navbar[data-sticky]{position:relative}
.is-edit [contenteditable="true"]{outline:1px dashed var(--accent);outline-offset:3px;cursor:text;min-width:1ch}
.is-edit .s-form input,.is-edit .s-form textarea{pointer-events:none}
.is-edit .s-html-ph{border:1px dashed var(--line);border-radius:8px;padding:18px;text-align:center;color:var(--muted);font-size:14px}
.is-edit .s-b.is-hidden{display:block!important;opacity:.6}
.is-edit .s-b.is-hidden::before{content:attr(data-hint);position:absolute;left:8px;top:6px;z-index:2;font:500 11px/1 var(--font-mono);color:var(--accent);background:var(--panel);padding:4px 7px;border-radius:5px;border:1px solid var(--line)}
.is-edit .s-b.s-popup{position:relative;inset:auto;background:color-mix(in srgb,var(--text) 6%,var(--bg));display:block!important;padding:48px 24px 32px;opacity:1;z-index:0}
.is-edit .s-pop-card{margin:0 auto}
.is-edit .s-spacer>div{background:repeating-linear-gradient(135deg,transparent 0 6px,color-mix(in srgb,var(--text) 8%,transparent) 6px 7px)}
.tb{position:absolute;top:8px;right:8px;z-index:30;display:flex;align-items:center;gap:2px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:3px;box-shadow:0 6px 18px rgba(0,0,0,.2);font:500 12px/1 var(--font-ui);text-align:left;letter-spacing:0;text-transform:none}
.tb .tb-n{padding:0 8px;color:var(--mute)}
.tb button{display:grid;place-items:center;width:28px;height:28px;border:0;background:none;border-radius:6px;cursor:pointer;color:var(--ink);padding:0}
.tb button:hover{background:var(--bg)}
.tb [data-tb="grip"]{cursor:grab}
.tb [data-tb="del"]:hover{color:var(--danger)}
.drop{height:0;position:relative;z-index:40}
.drop::before{content:"";position:absolute;left:0;right:0;top:-2px;height:4px;background:var(--accent);border-radius:2px}
.empty-page{margin:48px auto;max-width:360px;text-align:center;padding:28px;border:2px dashed var(--line);border-radius:12px;color:var(--mute);font:14px var(--font-ui)}
`;

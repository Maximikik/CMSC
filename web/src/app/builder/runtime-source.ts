/**
 * The behaviour of a published site (page switching, popups, button actions).
 * It is plain ES2017 source text, embedded as-is in every exported page and in the editor preview,
 * so it must not reference anything outside itself.
 */
export const RUNTIME_SOURCE = String.raw`function siteRuntime(SITE,opts){
  var root=opts.root,host=opts.host||document.body,scroller=opts.scroller||window;
  var pages=SITE.pages,els={};
  root.querySelectorAll('[data-bid]').forEach(function(e){els[e.dataset.bid]=e});
  var ov=document.createElement('div');
  ov.className=root.className+' ov';ov.setAttribute('style',root.getAttribute('style')||'');
  host.appendChild(ov);
  root.querySelectorAll('.s-popup').forEach(function(e){ov.appendChild(e)});
  var cur=null,hist=[],tt,tel;
  function toast(t){
    if(!tel){tel=document.createElement('div');tel.className='s-toast is-hidden';ov.appendChild(tel)}
    tel.textContent=t;tel.classList.remove('is-hidden');clearTimeout(tt);
    tt=setTimeout(function(){tel.classList.add('is-hidden')},2600);
  }
  function copy(txt){
    var done=function(){toast('Copied to clipboard')};
    var fb=function(){var ta=document.createElement('textarea');ta.value=txt;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done()}catch(e){toast('Copying is blocked here')}ta.remove()};
    try{navigator.clipboard.writeText(txt).then(done,fb)}catch(e){fb()}
  }
  function go(id,fromHash,noPush){
    var pg=pages.filter(function(p){return p.id===id})[0]||pages[0];
    var changed=cur!==pg.id;
    if(cur&&changed&&!noPush)hist.push(cur);
    cur=pg.id;
    root.querySelectorAll('.s-page').forEach(function(e){e.hidden=e.dataset.page!==pg.id});
    ov.querySelectorAll('.s-popup').forEach(function(e){e.classList.add('is-hidden')});
    if(changed)pg.blocks.forEach(function(b){var e=els[b.id];if(e&&b.type!=='popup')e.classList.toggle('is-hidden',!!b.hidden)});
    if(opts.hash){
      if(!fromHash&&location.hash.slice(1)!==pg.slug)location.hash=pg.slug;
      document.title=(pg.title||pg.name)+' | '+SITE.name;
    }
    scroller.scrollTo(0,0);
    pg.blocks.forEach(function(b){if(b.trigger==='pageopen'&&b.actions&&b.actions.length&&els[b.id])run(b,els[b.id])});
  }
  function allowedUrl(u){return /^(https?:|mailto:|tel:|#|\/|\.\/|\.\.\/)/i.test(u)||!/^[a-z][a-z0-9+.-]*:/i.test(u)}
  function exec(a,src){
    var el=a.target?els[a.target]:null;
    switch(a.type){
      case 'goto':go(a.page);break;
      case 'back':{var id=hist.pop();if(id)go(id,false,true);break}
      case 'url':{
        var u=String(a.url||'').trim();if(!u||!allowedUrl(u))break;
        var l=document.createElement('a');l.href=u;l.rel='noopener';
        if(a.blank!==false)l.target='_blank';
        document.body.appendChild(l);l.click();l.remove();break}
      case 'scroll':if(el)el.scrollIntoView({behavior:'smooth',block:'start'});break;
      case 'show':case 'popup':if(el)el.classList.remove('is-hidden');break;
      case 'hide':if(el)el.classList.add('is-hidden');break;
      case 'toggle':if(el)el.classList.toggle('is-hidden');break;
      case 'closepopup':{var pp=el||(src&&src.closest&&src.closest('.s-popup'));if(pp)pp.classList.add('is-hidden');break}
      case 'toast':toast(a.text||'');break;
      case 'copy':copy(a.text||'');break;
      case 'settext':if(el){var t=el.querySelector('[data-t]')||el;t.textContent=a.text||''}break;
      case 'count':if(el){var t2=el.querySelector('[data-t]')||el;var n=parseFloat((t2.textContent||'').replace(/[^0-9.\-]/g,''))||0;t2.textContent=String(Math.round((n+(+a.n||0))*1000)/1000)}break;
      case 'dark':root.classList.toggle('dark');ov.classList.toggle('dark');break;
      case 'top':scroller.scrollTo({top:0,behavior:'smooth'});break;
      case 'wait':return new Promise(function(r){setTimeout(r,+a.ms||0)});
    }
  }
  async function run(b,src){
    var acts=b.actions||[];
    for(var i=0;i<acts.length;i++){try{await exec(acts[i],src)}catch(e){}}
  }
  pages.forEach(function(pg){pg.blocks.forEach(function(b){
    var el=els[b.id];if(!el)return;
    if(b.type==='form'){
      var f=el.querySelector('form'),ok=el.querySelector('.s-form-ok');
      if(f)f.addEventListener('submit',function(e){e.preventDefault();if(ok)ok.classList.remove('is-hidden');run(b,f);f.reset()});
      return;
    }
    if(!b.actions||!b.actions.length)return;
    var tr=b.trigger||'click';if(tr==='pageopen')return;
    var tg=el.querySelector('[data-act]')||el;
    var ev=tr==='hover'?'mouseenter':tr==='dblclick'?'dblclick':'click';
    tg.addEventListener(ev,function(e){e.preventDefault();run(b,tg)});
    if(tr!=='hover')tg.style.cursor='pointer';
  })});
  function delegate(e){
    if(e.__sw)return;e.__sw=1;
    var t=e.target;if(!t||!t.closest)return;
    var g=t.closest('[data-go]');if(g){e.preventDefault();go(g.dataset.go);return}
    var c=t.closest('[data-close]');if(c){var p=c.closest('.s-popup');if(p)p.classList.add('is-hidden');return}
    if(t.classList.contains('s-popup'))t.classList.add('is-hidden');
  }
  function key(e){
    if(e.key==='Escape')ov.querySelectorAll('.s-popup').forEach(function(p){p.classList.add('is-hidden')});
    var t=e.target;
    if((e.key==='Enter'||e.key===' ')&&t&&t.getAttribute&&t.getAttribute('role')==='button'){e.preventDefault();t.click()}
  }
  root.addEventListener('click',delegate);ov.addEventListener('click',delegate);
  document.addEventListener('keydown',key);
  function onHash(){
    var h=location.hash.slice(1);
    var m=pages.filter(function(p){return p.slug===h})[0];
    if(m&&m.id!==cur)go(m.id,true);
  }
  var start=pages[0].id;
  if(opts.start&&pages.some(function(p){return p.id===opts.start}))start=opts.start;
  if(opts.hash){
    var h0=location.hash.slice(1),m0=pages.filter(function(p){return p.slug===h0})[0];
    if(m0)start=m0.id;
    window.addEventListener('hashchange',onHash);
  }
  go(start,true);
  return{go:go,stop:function(){document.removeEventListener('keydown',key);window.removeEventListener('hashchange',onHash);ov.remove()}};
}`;

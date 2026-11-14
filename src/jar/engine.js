// Dear Me, jar engine (Phase 2). Ported from the jar test (https://claude.ai/artifact/PXfcjuTM6ZPFvok3ZtqRFG).
// Canvas 2D + a small physics loop. Every orb is a circle for physics; the shape is drawn on top.
// Physics sleeps once orbs settle (battery). Reduced motion: no sparkles, shake or twinkle.
/* eslint-disable */
var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* ================= jars ================= */
var W=384, H=490, CX=182, OY=44, LT=40 /* extra room above the live jar so a lifted lid never gets cut */, BY=412, FY=400, T=8;
var JARS={
  classic:{name:'Classic',lv:1,prof:[[92,72,2],[110,72,26],[140,114,40],[412,114,44]],tint:[255,235,255],lid:'cork',r:29},
  rose:{name:'Rosewater',lv:2,prof:[[98,66,2],[114,66,20],[150,112,60],[262,128,120],[380,112,60],[412,96,22]],tint:[255,170,205],lid:'gold',deco:'flutes',r:28},
  moon:{name:'Moonlight',lv:3,prof:[[112,58,2],[134,58,10],[139,58,40],[155,86,40],[180,113,40],[210,132,40],[245,143,40],[273,146,40],[305,142,40],[340,130,40],[370,109,40],[395,80,40],[412,44,8]],tint:[185,205,255],lid:'silver',r:27},
  pearl:{name:'Pearl',lv:4,prof:[[84,60,2],[100,60,16],[126,92,24],[412,92,26]],tint:[255,238,222],lid:'ceramic',r:25},
  stardust:{name:'Stardust',lv:5,prof:[[90,44,2],[120,44,4],[152,112,6],[382,112,6],[412,92,6]],tint:[205,165,255],lid:'gem',deco:'facets',r:27},
  frost:{name:'Frost',lv:6,prof:[[100,92,2],[114,92,6],[130,118,10],[412,118,20]],tint:[170,212,255],lid:'glass',deco:'frost',r:27}
};
Object.keys(JARS).forEach(function(k){ var J=JARS[k]; J.id=k; J.y0=J.prof[0][0]; J.w0=J.prof[0][1]; J.wn=J.prof[J.prof.length-1][1]; J.lidB=J.y0+14; });
function wAt(J,y){ var p=J.table||J.prof; if(y<=p[0][0]) return p[0][1]; for(var i=1;i<p.length;i++){ if(y<=p[i][0]){ var a=p[i-1],b=p[i],t=(y-a[0])/(b[0]-a[0]); return a[1]+(b[1]-a[1])*t; } } return p[p.length-1][1]; }
function hw(J,y){ return wAt(J,Math.min(BY,y))-T-1.5; }
// Smooth jars (Classic, Rosewater, Moonlight, Pearl) are drawn as one spline: a straight neck that flows into the
// shoulders with no kink, then rounded bottom corners. Faceted jars (Stardust, Frost) keep their crisp corners.
var SPLINES={
  classic:{pts:[[92,72],[108,72],[128,94],[152,110],[178,114],[412,114]],bot:44,vEnd:true},
  rose:{pts:[[98,66],[114,66],[146,102],[192,123],[262,128],[338,121],[412,96]],bot:22,vEnd:false},
  pearl:{pts:[[84,60],[100,60],[116,78],[134,90],[152,92],[412,92]],bot:26,vEnd:true}
};
function jarPath(c,J,inset){
  if(J.id==='moon') return globePath(c,inset);
  var sp=SPLINES[J.id];
  if(sp) return splinePath(c,sp,inset);
  var p=J.prof, L=[], R=[];
  for(var i=0;i<p.length;i++){ var y=p[i][0]+(i===p.length-1?-inset*0.6:0), w=p[i][1]-inset; L.push([CX-w,y,p[i][2]]); R.unshift([CX+w,y,p[i][2]]); }
  var v=L.concat(R), n=v.length;
  c.beginPath(); c.moveTo(CX,v[0][1]);
  for(var j=0;j<n;j++){ var a=v[j], b=v[(j+1)%n], pr=v[(j-1+n)%n];
    var l1=Math.hypot(a[0]-pr[0],a[1]-pr[1]), l2=Math.hypot(b[0]-a[0],b[1]-a[1]);
    var rr=Math.max(0.1,Math.min(a[2],l1/2,l2/2)); c.arcTo(a[0],a[1],b[0],b[1],rr); }
  c.closePath();
}
function globePath(c,inset){
  var R=146-inset, cy=273, nw=58-inset, y0=112, by=BY-inset*0.6;
  var a0=Math.asin(nw/R), yn=cy-R*Math.cos(a0); // where the neck meets the bowl
  var ab=Math.acos(Math.min(0.995,(by-cy)/R)); // flat base
  c.beginPath(); c.moveTo(CX,y0); c.lineTo(CX-nw,y0); c.lineTo(CX-nw,yn-6);
  c.quadraticCurveTo(CX-nw,yn,CX-R*Math.sin(a0+0.12),cy-R*Math.cos(a0+0.12));
  c.arc(CX,cy,R,-Math.PI/2-(a0+0.12),-Math.PI/2-(Math.PI-ab),true);
  c.lineTo(CX+R*Math.sin(ab),by);
  c.arc(CX,cy,R,-Math.PI/2+(Math.PI-ab),-Math.PI/2+(a0+0.12),true);
  c.quadraticCurveTo(CX+nw,yn,CX+nw,yn-6); c.lineTo(CX+nw,y0); c.closePath();
}
// Width at each height, sampled from the drawn outline, so highlights, flutes and physics follow the real curve.
function buildTables(){
  Object.keys(SPLINES).forEach(function(id){
    var stop=false, sp=SPLINES[id], rec={moveTo:function(){},lineTo:function(x,y){ if(!stop && x<CX) pts.push([y,CX-x]);},closePath:function(){},beginPath:function(){},
      arcTo:function(){ stop=true; }, bezierCurveTo:function(a,b,c2,d,x,y){ if(stop) return; var p0=pts[pts.length-1]; var x0=CX-p0[1], y0=p0[0];
        for(var t=1;t<=24;t++){ var u=t/24, m=1-u; var X=m*m*m*x0+3*m*m*u*a+3*m*u*u*c2+u*u*u*x, Y=m*m*m*y0+3*m*m*u*b+3*m*u*u*d+u*u*u*y; if(X<CX) pts.push([Y,CX-X]); } } };
    var pts=[]; splinePath(rec,sp,0);
    var left=pts.filter(function(q){return q[1]>0;}).sort(function(a,b){return a[0]-b[0];});
    var r=sp.bot; left.push([BY-r*0.3,left[left.length-1][1]-r*0.3]); left.push([BY,left[left.length-1][1]-r*0.7]);
    JARS[id].table=left.map(function(q){return [q[0],q[1],2];});
  });
  var R=146, cy=273, g=[[112,58,2],[134,58,2]];
  for(var y=140;y<=412;y+=6){ g.push([y,Math.sqrt(Math.max(0,R*R-(y-cy)*(y-cy))),2]); }
  JARS.moon.table=g;
}
function splinePath(c,sp,inset){
  var by=BY-inset*0.6, r=Math.max(2,sp.bot-inset*0.6);
  var P=sp.pts.map(function(q){ return [q[1]-inset,q[0]]; }); // [w, y]
  var n=P.length; P[n-1]=[P[n-1][0],by-r];
  // Directions (unit) at each point; each segment's handles are a third of its own length, so no loops or hooks.
  var D=[], unit=function(v){ var l=Math.hypot(v[0],v[1])||1; return [v[0]/l,v[1]/l]; };
  for(var i=0;i<n;i++){
    if(i<=1) D.push([0,1]); // straight neck, meeting the shoulder vertically
    else if(i===n-1) D.push(sp.vEnd?[0,1]:unit([P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]]));
    else if(sp.vEnd && i===n-2) D.push([0,1]); // the straight side begins here
    else D.push(unit([P[i+1][0]-P[i-1][0],P[i+1][1]-P[i-1][1]]));
  }
  var segs=[];
  for(var k=1;k<n-1;k++){ var L=Math.hypot(P[k+1][0]-P[k][0],P[k+1][1]-P[k][1])/3;
    segs.push([P[k][0]+D[k][0]*L,P[k][1]+D[k][1]*L, P[k+1][0]-D[k+1][0]*L,P[k+1][1]-D[k+1][1]*L, P[k+1][0],P[k+1][1]]); }
  var wl=P[n-1][0];
  c.beginPath(); c.moveTo(CX,P[0][1]); c.lineTo(CX-P[0][0],P[0][1]); c.lineTo(CX-P[1][0],P[1][1]);
  segs.forEach(function(s){ c.bezierCurveTo(CX-s[0],s[1],CX-s[2],s[3],CX-s[4],s[5]); });
  c.arcTo(CX-wl,by,CX,by,r); c.arcTo(CX+wl,by,CX+wl,by-r,r);
  for(var m=segs.length-1;m>=0;m--){ var s=segs[m], end=m===0?P[1]:[segs[m-1][4],segs[m-1][5]];
    c.bezierCurveTo(CX+s[2],s[3],CX+s[0],s[1],CX+end[0],end[1]); }
  c.lineTo(CX+P[0][0],P[0][1]); c.closePath();
}

/* ================= orb themes ================= */
var THEMES={
  pearl:{name:'Pearls',lv:1,shape:'round',pal:[
    {l:'#fff3d6',b:'#ffcf7a',d:'#c9802a',g:[255,196,110]},{l:'#ffe3f0',b:'#ff9fc6',d:'#c94f88',g:[255,140,195]},
    {l:'#efe6ff',b:'#b9a2ff',d:'#6f50cf',g:[180,155,255]},{l:'#e3f8ff',b:'#8fdcff',d:'#3a93cc',g:[140,215,255]},
    {l:'#ffe9de',b:'#ffb18f',d:'#d8673f',g:[255,170,140]},{l:'#f8e8ff',b:'#e6a6ff',d:'#9d52cf',g:[225,160,255]}]},
  heart:{name:'Hearts',lv:2,shape:'heart',pal:[
    {l:'#ffe4ee',b:'#ff8fb6',d:'#c23f73',g:[255,120,170]},{l:'#fff0f3',b:'#ffb3c8',d:'#d9668c',g:[255,170,195]},
    {l:'#ffe6e0',b:'#ff9a8a',d:'#cc5148',g:[255,150,140]},{l:'#fbe8ff',b:'#f0a8e8',d:'#b0549f',g:[240,160,230]}]},
  star:{name:'Stars',lv:3,shape:'star',pal:[
    {l:'#fff6d6',b:'#ffd36b',d:'#d08a1c',g:[255,205,100]},{l:'#fff0dc',b:'#ffb867',d:'#d0762a',g:[255,180,110]},
    {l:'#fffbe8',b:'#ffe7a0',d:'#cfa640',g:[255,230,150]},{l:'#f3ecff',b:'#cdb8ff',d:'#7d62d6',g:[200,180,255]}]},
  moon:{name:'Moons',lv:4,shape:'moon',pal:[
    {l:'#eaf2ff',b:'#9fc0ff',d:'#3f62c9',g:[150,185,255]},{l:'#f2ecff',b:'#b9a2ff',d:'#6448c4',g:[180,155,255]},
    {l:'#e8fbff',b:'#8fe0f5',d:'#2f8eb0',g:[140,220,245]}]},
  fly:{name:'Butterflies',lv:5,shape:'butterfly',pal:[
    {l:'#fbe9ff',b:'#d9a2ff',d:'#8a4fcf',g:[215,160,255]},{l:'#ffe8f4',b:'#ffa6d2',d:'#c4558f',g:[255,160,210]},
    {l:'#e9f0ff',b:'#a9bfff',d:'#5368cf',g:[170,190,255]},{l:'#fff3e3',b:'#ffcf9a',d:'#d08a4a',g:[255,200,150]}]},
  flake:{name:'Snowflakes',lv:6,shape:'flake',pal:[
    {l:'#ffffff',b:'#d7ecff',d:'#7fb2e6',g:[190,225,255]},{l:'#ffffff',b:'#e6e0ff',d:'#9a8ee0',g:[210,200,255]},
    {l:'#ffffff',b:'#d8fff6',d:'#6fc9b8',g:[180,240,230]}]}
};

var S=1, DPR=Math.min(window.devicePixelRatio||1,2), K=1;
var corkTex=null, hasConic=typeof CanvasRenderingContext2D!=='undefined' && !!CanvasRenderingContext2D.prototype.createConicGradient;
function makeCorkTex(){
  var w=Math.ceil(170*K), h=Math.ceil(100*K), c=document.createElement('canvas'); c.width=w; c.height=h; var x=c.getContext('2d');
  x.fillStyle='#b88a5c'; x.fillRect(0,0,w,h);
  for(var i=0,n=Math.floor(w*h/40);i<n;i++){ var px=Math.random()*w, py=Math.random()*h, s=(Math.random()*1.1+0.3)*K, r=Math.random();
    x.fillStyle=r<0.45?'rgba(110,72,40,'+(0.15+Math.random()*0.3)+')':r<0.8?'rgba(226,186,138,'+(0.2+Math.random()*0.4)+')':'rgba(80,50,26,'+(0.25+Math.random()*0.3)+')';
    x.beginPath(); x.ellipse(px,py,s*1.4,s,Math.random()*3,0,Math.PI*2); x.fill(); }
  return c;
}
/* ================= orb sprites ================= */
function shapePath(c,shape,s){
  c.beginPath();
  if(shape==='heart'){ c.moveTo(0,0.82*s); c.bezierCurveTo(-1.12*s,0.08*s,-0.74*s,-0.98*s,0,-0.4*s); c.bezierCurveTo(0.74*s,-0.98*s,1.12*s,0.08*s,0,0.82*s); }
  else if(shape==='star'){ for(var i=0;i<10;i++){ var a=-Math.PI/2+i*Math.PI/5, rr=(i%2?0.47:1)*s; c[i?'lineTo':'moveTo'](Math.cos(a)*rr,Math.sin(a)*rr+0.08*s);} c.closePath(); }
  else if(shape==='butterfly'){
    c.ellipse(-0.46*s,-0.26*s,0.5*s,0.6*s,-0.65,0,Math.PI*2); c.moveTo(0.96*s,-0.26*s);
    c.ellipse(0.46*s,-0.26*s,0.5*s,0.6*s,0.65,0,Math.PI*2); c.moveTo(-0.02*s,0.42*s);
    c.ellipse(-0.36*s,0.44*s,0.32*s,0.4*s,0.5,0,Math.PI*2); c.moveTo(0.68*s,0.44*s);
    c.ellipse(0.36*s,0.44*s,0.32*s,0.4*s,-0.5,0,Math.PI*2); }
  else c.arc(0,0,s,0,Math.PI*2);
}
function orbSprite(o){
  var th=THEMES[o.th], p=th.pal[o.ci%th.pal.length], r=o.r*K, size=Math.ceil(r*2.7), m=size/2;
  var c=document.createElement('canvas'); c.width=c.height=size; var x=c.getContext('2d'); x.translate(m,m);
  var shape=th.shape, s=r*(shape==='round'?1:shape==='moon'?1.04:1.16);
  function body(){ var g=x.createRadialGradient(-s*0.2,-s*0.26,s*0.05,0,0,s*1.05);
    g.addColorStop(0,'#ffffff'); g.addColorStop(0.22,p.l); g.addColorStop(0.62,p.b); g.addColorStop(1,p.d); return g; }
  function gloss(){ x.globalCompositeOperation='source-atop';
    var gl=x.createLinearGradient(-s,-s,s*0.3,s*0.4); gl.addColorStop(0,'rgba(255,255,255,.55)'); gl.addColorStop(.45,'rgba(255,255,255,.08)'); gl.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=gl; x.fillRect(-m,-m,size,size);
    var bl=x.createRadialGradient(s*0.3,s*0.4,0,s*0.3,s*0.4,s*0.6); bl.addColorStop(0,'rgba(255,255,255,.35)'); bl.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=bl; x.fillRect(-m,-m,size,size); x.globalCompositeOperation='source-over'; }
  if(shape==='round'){
    x.fillStyle=body(); shapePath(x,'round',r); x.fill();
    x.save(); shapePath(x,'round',r); x.clip();
    if(hasConic){ var cg=x.createConicGradient(o.hue,0,0);
      cg.addColorStop(0,'rgba(255,150,210,.35)'); cg.addColorStop(.25,'rgba(150,220,255,.30)'); cg.addColorStop(.5,'rgba(255,230,150,.30)'); cg.addColorStop(.75,'rgba(190,160,255,.35)'); cg.addColorStop(1,'rgba(255,150,210,.35)');
      x.globalCompositeOperation='overlay'; x.fillStyle=cg; x.fillRect(-m,-m,size,size); }
    x.globalCompositeOperation='screen'; x.strokeStyle='rgba(255,255,255,.16)'; x.lineWidth=r*0.18;
    x.beginPath(); x.ellipse(0,r*0.05,r*0.62,r*0.28,o.hue,0.2,2.6); x.stroke();
    x.globalCompositeOperation='source-over';
    var rim=x.createRadialGradient(0,0,r*0.72,0,0,r); rim.addColorStop(0,'rgba(255,255,255,0)'); rim.addColorStop(1,'rgba(255,255,255,.38)');
    x.fillStyle=rim; x.fillRect(-m,-m,size,size); x.restore();
  } else if(shape==='moon'){
    x.fillStyle=body(); shapePath(x,'round',s*0.95); x.fill();
    x.globalCompositeOperation='destination-out'; x.beginPath(); x.arc(s*0.44,-s*0.24,s*0.8,0,Math.PI*2); x.fill(); x.globalCompositeOperation='source-over';
    gloss();
    x.globalCompositeOperation='source-atop'; x.strokeStyle='rgba(255,255,255,.45)'; x.lineWidth=s*0.08; x.beginPath(); x.arc(0,0,s*0.92,1.6,3.6); x.stroke(); x.globalCompositeOperation='source-over';
  } else if(shape==='flake'){
    var dg=x.createRadialGradient(0,0,0,0,0,s); dg.addColorStop(0,'rgba(255,255,255,.32)'); dg.addColorStop(.7,'rgba('+p.g+',.16)'); dg.addColorStop(1,'rgba('+p.g+',.05)');
    x.fillStyle=dg; x.beginPath(); x.arc(0,0,s*0.98,0,Math.PI*2); x.fill();
    x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=1; x.stroke();
    x.save(); x.rotate(o.hue); x.lineCap='round'; x.strokeStyle=p.l; x.shadowColor='rgba('+p.g+',1)'; x.shadowBlur=s*0.25;
    for(var i=0;i<6;i++){ x.save(); x.rotate(i*Math.PI/3); x.lineWidth=s*0.13;
      x.beginPath(); x.moveTo(0,0); x.lineTo(0,-s*0.8); x.stroke(); x.lineWidth=s*0.09;
      x.beginPath(); x.moveTo(0,-s*0.42); x.lineTo(-s*0.2,-s*0.6); x.moveTo(0,-s*0.42); x.lineTo(s*0.2,-s*0.6);
      x.moveTo(0,-s*0.62); x.lineTo(-s*0.12,-s*0.74); x.moveTo(0,-s*0.62); x.lineTo(s*0.12,-s*0.74); x.stroke(); x.restore(); }
    x.restore(); x.fillStyle='#ffffff'; x.beginPath(); x.arc(0,0,s*0.12,0,Math.PI*2); x.fill();
  } else {
    x.fillStyle=body(); shapePath(x,shape,s);
    if(shape==='star'){ x.lineJoin='round'; x.lineWidth=s*0.2; x.strokeStyle=p.b; x.stroke(); }
    x.fill(); gloss();
    if(shape==='butterfly'){ x.globalCompositeOperation='source-atop'; x.strokeStyle='rgba(255,255,255,.35)'; x.lineWidth=s*0.05;
      x.beginPath(); x.moveTo(0,0); x.lineTo(-0.75*s,-0.6*s); x.moveTo(0,0); x.lineTo(0.75*s,-0.6*s); x.moveTo(0,0.1*s); x.lineTo(-0.5*s,0.6*s); x.moveTo(0,0.1*s); x.lineTo(0.5*s,0.6*s); x.stroke();
      x.globalCompositeOperation='source-over'; x.fillStyle=p.d; x.beginPath(); x.ellipse(0,0.1*s,0.08*s,0.55*s,0,0,Math.PI*2); x.fill();
      x.strokeStyle=p.d; x.lineWidth=s*0.04; x.beginPath(); x.moveTo(0,-0.42*s); x.quadraticCurveTo(-0.1*s,-0.7*s,-0.22*s,-0.78*s); x.moveTo(0,-0.42*s); x.quadraticCurveTo(0.1*s,-0.7*s,0.22*s,-0.78*s); x.stroke(); }
    x.globalCompositeOperation='source-atop'; shapePath(x,shape,s); x.strokeStyle='rgba(255,255,255,.5)'; x.lineWidth=s*0.07; x.stroke(); x.globalCompositeOperation='source-over';
  }
  return c;
}
function haloSprite(o){
  var p=THEMES[o.th].pal[o.ci%THEMES[o.th].pal.length], R=o.r*2.4*K, size=Math.ceil(R*2), c=document.createElement('canvas'); c.width=c.height=size;
  var x=c.getContext('2d'), m=size/2, g=x.createRadialGradient(m,m,o.r*K*0.6,m,m,R);
  g.addColorStop(0,'rgba('+p.g+',.55)'); g.addColorStop(.45,'rgba('+p.g+',.16)'); g.addColorStop(1,'rgba('+p.g+',0)'); x.fillStyle=g; x.fillRect(0,0,size,size); return c;
}
var spriteCache={};
function sprites(o){ var key=o.th+'|'+o.ci+'|'+Math.round(o.r)+'|'+(o.th==='pearl'||o.th==='flake'?(o.hue*10|0):0)+'|'+K;
  if(!spriteCache[key]) spriteCache[key]={b:orbSprite(o),h:haloSprite(o)}; return spriteCache[key]; }

/* ================= state ================= */
var orbs=[], particles=[];
var jarId='classic', label='', sealed=false;
var tilt=0, wobbleT=-1, lift=0, liftPhase=null, dragging=false, dragX=0, dragMoved=false, glowPulse=0, sleeping=false, calm=0, hi=null;
var cv=null, ctx=null, raf=0, last=0, onLanded=null;
function J(){ return JARS[jarId]; }
function makeOrb(th,ci,x,y){ return {x:x,y:y,vx:0,vy:0,r:J().r,th:th,ci:ci,a:Math.random()*6,base:(Math.random()-0.5)*0.8,hue:Math.random()*6,tw:Math.random()*6,fresh:false}; }
function settle(list){
  var jj=J(); orbs=list.map(function(o,i){ o.r=jj.r; o.x=CX+(Math.random()*40-20); o.y=FY-o.r-i*(o.r*0.9); o.vx=o.vy=0; o.fresh=false; return o; });
  silent=true; for(var s=0;s<1100;s++) step(1/120, true); silent=false;
  orbs.forEach(function(o){o.vx=o.vy=0;});
}
/* ================= physics ================= */
var G=1500;
function step(dt,noCeil){
  var jj=J(), gx=G*Math.sin(tilt+gAng), gy=G*Math.cos(tilt+gAng), ceil=!noCeil && lift<8;
  for(var i=0;i<orbs.length;i++){ var o=orbs[i]; o.vx+=gx*dt; o.vy+=gy*dt; o.vx*=0.996; o.vy*=0.998; o.x+=o.vx*dt; o.y+=o.vy*dt; o.a+=o.vx/o.r*dt; }
  for(var it=0;it<3;it++){
    for(var a=0;a<orbs.length;a++){ var A=orbs[a];
      for(var b=a+1;b<orbs.length;b++){ var B=orbs[b], dx=B.x-A.x, dy=B.y-A.y, d2=dx*dx+dy*dy, rr=A.r+B.r;
        if(d2<rr*rr && d2>1e-4){ var d=Math.sqrt(d2), nx=dx/d, ny=dy/d, pen=(rr-d)*0.5;
          A.x-=nx*pen; A.y-=ny*pen; B.x+=nx*pen; B.y+=ny*pen;
          var rv=(B.vx-A.vx)*nx+(B.vy-A.vy)*ny;
          if(rv<0){ var j=-(1.2)*rv*0.5; A.vx-=j*nx; A.vy-=j*ny; B.vx+=j*nx; B.vy+=j*ny; if(-rv>110) clink(Math.min(1,-rv/900),(A.x+B.x)/2);
            if((A.fresh||B.fresh)&&-rv>260){ var f=A.fresh?A:B; burst((A.x+B.x)/2,(A.y+B.y)/2,f); A.fresh=B.fresh=false; } }
        } } }
    for(var q=0;q<orbs.length;q++) walls(orbs[q],jj,ceil);
  }
}
function walls(o,jj,ceil){
  var e=0.25;
  if(o.y+o.r>FY){ o.y=FY-o.r; if(o.vy>0){ if(o.vy>140) clink(Math.min(1,o.vy/1000),o.x); if(o.fresh&&o.vy>260){burst(o.x,FY-4,o);o.fresh=false;} o.vy=-o.vy*e; o.vx*=0.94; } }
  var h=Math.min(hw(jj,o.y-o.r*0.7),hw(jj,o.y),hw(jj,o.y+o.r*0.7));
  if(h<o.r) h=o.r;
  if(o.x-o.r<CX-h){ o.x=CX-h+o.r; if(o.vx<0){ if(o.vx<-160) clink(Math.min(1,-o.vx/1100),o.x); o.vx=-o.vx*e; } }
  if(o.x+o.r>CX+h){ o.x=CX+h-o.r; if(o.vx>0){ if(o.vx>160) clink(Math.min(1,o.vx/1100),o.x); o.vx=-o.vx*e; } }
  var ci=jj.prof[jj.prof.length-1][2]-T, iw=jj.wn-T;
  if(ci>o.r){ var cx=CX+(o.x<CX?-1:1)*(iw-ci), cy=FY-ci;
    if(Math.abs(o.x-CX)>iw-ci && o.y>cy){ var dx=o.x-cx, dy=o.y-cy, d=Math.hypot(dx,dy), mx=ci-o.r;
      if(d>mx&&d>0){ var nx=dx/d, ny=dy/d; o.x=cx+nx*mx; o.y=cy+ny*mx; var vn=o.vx*nx+o.vy*ny; if(vn>0){o.vx-=(1+e)*vn*nx;o.vy-=(1+e)*vn*ny;} } } }
  if(ceil && o.y-o.r<jj.lidB){ o.y=jj.lidB+o.r; if(o.vy<0) o.vy=-o.vy*e; }
}
function burst(x,y,o){ chime(x); if(REDUCED) return; var p=THEMES[o.th].pal[o.ci%THEMES[o.th].pal.length];
  for(var i=0;i<14;i++){ var a=Math.random()*Math.PI*2, s=40+Math.random()*120; particles.push({x:x,y:y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-60,life:1,c:p.g,s:Math.random()*1.6+0.8}); }
  glowPulse=1; }

/* ================= drawing ================= */
function rgba(c,a){return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')';}
function avgGlow(list){ if(!list.length) return [255,200,220]; var r=0,g=0,b=0;
  list.forEach(function(o){var p=THEMES[o.th].pal[o.ci%THEMES[o.th].pal.length].g; r+=p[0];g+=p[1];b+=p[2];}); var n=list.length; return [r/n|0,g/n|0,b/n|0]; }

// draws a jar scene into context c (already scaled to stage units)
function drawOrbList(c,list,t,o,live){
  c.globalCompositeOperation='lighter';
  for(var h=0;h<list.length;h++){ var ob=list[h], sp2=sprites(ob), hs=sp2.h.width/K;
    c.globalAlpha=(REDUCED||!live?1:0.85+0.15*Math.sin(t/900+ob.tw))*(0.75+0.25*(o.pulse||0));
    c.drawImage(sp2.h,ob.x-hs/2,ob.y-hs/2,hs,hs); }
  c.globalAlpha=1; c.globalCompositeOperation='source-over';
  for(var q=0;q<list.length;q++){ var b=list[q], spr=sprites(b).b, sz=spr.width/K, shp=THEMES[b.th].shape;
    c.save(); c.translate(b.x,b.y); c.rotate(shp==='round'||shp==='flake'?b.a:b.base+b.a*0.25); c.drawImage(spr,-sz/2,-sz/2,sz,sz); c.restore();
    if(shp==='round'){ var r=b.r;
      var bl=c.createRadialGradient(b.x+r*0.32,b.y+r*0.42,0,b.x+r*0.32,b.y+r*0.42,r*0.55); bl.addColorStop(0,'rgba(255,255,255,.42)'); bl.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=bl; c.beginPath(); c.arc(b.x,b.y,r,0,Math.PI*2); c.fill();
      c.save(); c.translate(b.x-r*0.34,b.y-r*0.42); c.rotate(-0.65); var hl=c.createRadialGradient(0,0,0,0,0,r*0.3);
      hl.addColorStop(0,'rgba(255,255,255,.95)'); hl.addColorStop(.5,'rgba(255,255,255,.45)'); hl.addColorStop(1,'rgba(255,255,255,0)');
      c.scale(1,0.6); c.fillStyle=hl; c.beginPath(); c.arc(0,0,r*0.3,0,Math.PI*2); c.fill(); c.restore();
      c.fillStyle='rgba(255,255,255,.95)'; c.beginPath(); c.arc(b.x-r*0.42,b.y-r*0.5,r*0.06,0,Math.PI*2); c.fill();
      c.strokeStyle='rgba(255,255,255,.28)'; c.lineWidth=1.2; c.beginPath(); c.arc(b.x,b.y,r*0.82,0.35,1.25); c.stroke(); }
  }
}
function drawScene(c,jj,list,t,o){
  var fillN=list.length/12, ag=avgGlow(list), tint=jj.tint, live=o.live;
  // light spill + shadow
  c.save(); c.scale(1,0.22); var sp=c.createRadialGradient(CX,(BY+6)/0.22,0,CX,(BY+6)/0.22,190);
  sp.addColorStop(0,rgba(ag,0.10+0.22*fillN+0.12*(o.pulse||0))); sp.addColorStop(1,rgba(ag,0)); c.fillStyle=sp; c.beginPath(); c.arc(CX,(BY+6)/0.22,190,0,Math.PI*2); c.fill(); c.restore();
  c.save(); c.scale(1,0.12); var sh=c.createRadialGradient(CX,(BY+4)/0.12,0,CX,(BY+4)/0.12,jj.wn+20);
  sh.addColorStop(0,'rgba(0,0,0,.45)'); sh.addColorStop(1,'rgba(0,0,0,0)'); c.fillStyle=sh; c.beginPath(); c.arc(CX,(BY+4)/0.12,jj.wn+20,0,Math.PI*2); c.fill(); c.restore();

  c.save(); c.translate(CX,BY); c.rotate(o.tilt||0); c.translate(-CX,-BY);
  if(list.length){ var ig=c.createRadialGradient(CX,FY-80,0,CX,FY-80,180); ig.addColorStop(0,rgba(ag,0.10+0.18*fillN+0.1*(o.pulse||0))); ig.addColorStop(1,rgba(ag,0));
    c.save(); jarPath(c,jj,0); c.clip(); c.fillStyle=ig; c.fillRect(0,0,W,H); c.restore(); }
  // back glass
  var maxW=0; jj.prof.forEach(function(p){maxW=Math.max(maxW,p[1]);});
  var gb=c.createLinearGradient(CX-maxW,0,CX+maxW,0);
  gb.addColorStop(0,rgba(tint,.22)); gb.addColorStop(.1,rgba(tint,.08)); gb.addColorStop(.5,rgba(tint,.03)); gb.addColorStop(.9,rgba(tint,.08)); gb.addColorStop(1,rgba(tint,.2));
  jarPath(c,jj,0); c.fillStyle=gb; c.fill();
  c.beginPath(); c.ellipse(CX,FY,jj.wn-T,11,0,Math.PI,Math.PI*2); c.strokeStyle=rgba(tint,.16); c.lineWidth=1.2; c.stroke();

  // orbs: the ones still in the neck (falling in) are drawn after the glass rim, so no rim line crosses them
  var mouth=jj.y0+14, settled=list.filter(function(q){ return q.y-q.r*0.6>mouth; }), entering=list.filter(function(q){ return q.y-q.r*0.6<=mouth; });
  c.save(); jarPath(c,jj,2); c.rect(CX-60,-200,120,jj.y0+210); c.clip();
  drawOrbList(c,settled,t,o,live);
  c.restore();
  if(o.particles){ c.globalCompositeOperation='lighter';
    o.particles.forEach(function(pp){ c.fillStyle=rgba(pp.c,pp.life*0.9); c.beginPath(); c.arc(pp.x,pp.y,pp.s*(0.6+pp.life),0,Math.PI*2); c.fill(); });
    c.globalCompositeOperation='source-over'; }

  // front glass
  c.save(); jarPath(c,jj,0); c.clip();
  function strip(off,wid,a,y1,y2){ c.beginPath(); for(var y=y1;y<=y2;y+=6){ var x=CX+(off<0?-wAt(jj,y)-off:wAt(jj,y)-off); if(y===y1) c.moveTo(x,y); else c.lineTo(x,y); }
    var g=c.createLinearGradient(0,y1,0,y2); g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.25,'rgba(255,255,255,'+a+')'); g.addColorStop(.75,'rgba(255,255,255,'+a*0.8+')'); g.addColorStop(1,'rgba(255,255,255,0)');
    c.strokeStyle=g; c.lineWidth=wid; c.lineCap='round'; c.stroke(); }
  var top=jj.prof[2]?jj.prof[2][0]+18:jj.y0+40;
  strip(-14,10,0.42,top,FY-24); strip(-30,3,0.26,top+14,FY-60); strip(19,6,0.3,top+10,FY-40); strip(30,2,0.16,top+40,FY-90);
  if(jj.deco==='flutes'){ [-0.78,-0.5,-0.2,0.2,0.5,0.78].forEach(function(f){ c.beginPath(); for(var y=top-6;y<=FY;y+=6){ var x=CX+f*wAt(jj,y); if(y===top-6) c.moveTo(x,y); else c.lineTo(x,y);} c.strokeStyle=rgba(tint,.22); c.lineWidth=2; c.stroke(); c.strokeStyle='rgba(255,255,255,.10)'; c.lineWidth=5; c.stroke(); }); }
  if(jj.deco==='facets'){ [-0.55,0,0.55].forEach(function(f){ c.beginPath(); c.moveTo(CX+f*wAt(jj,top-10),top-10); c.lineTo(CX+f*wAt(jj,FY),FY); c.strokeStyle='rgba(255,255,255,.18)'; c.lineWidth=1.4; c.stroke(); });
    c.beginPath(); c.moveTo(CX-jj.w0,jj.y0+28); c.lineTo(CX,jj.y0+40); c.lineTo(CX+jj.w0,jj.y0+28); c.strokeStyle='rgba(255,255,255,.2)'; c.stroke(); }
  if(jj.deco==='frost'){ [-0.62,0.62].forEach(function(f){ c.beginPath(); c.moveTo(CX+f*wAt(jj,200),top-6); c.lineTo(CX+f*wAt(jj,200),FY); c.strokeStyle='rgba(255,255,255,.16)'; c.lineWidth=1.4; c.stroke(); });
    var fr=c.createLinearGradient(0,FY-40,0,BY); fr.addColorStop(0,'rgba(220,240,255,0)'); fr.addColorStop(1,'rgba(220,240,255,.18)'); c.fillStyle=fr; c.fillRect(0,FY-40,W,60); }
  // soft edge light that follows the body, fading in below the shoulder (no hard start in the neck)
  var ed=c.createLinearGradient(0,top-10,0,top+50); ed.addColorStop(0,rgba(tint,0)); ed.addColorStop(1,rgba(tint,.1));
  jarPath(c,jj,0); c.strokeStyle=ed; c.lineWidth=16; c.stroke();
  var base=c.createLinearGradient(0,FY-6,0,BY); base.addColorStop(0,'rgba(255,240,255,.05)'); base.addColorStop(1,'rgba(255,240,255,.24)'); c.fillStyle=base; c.fillRect(0,FY-6,W,BY-FY+8);
  c.restore();
  c.beginPath(); c.ellipse(CX,FY+3,jj.wn-T-4,8,0,0.15*Math.PI,0.85*Math.PI); c.strokeStyle=rgba(ag,0.2+0.5*fillN); c.lineWidth=2.4; c.stroke();
  jarPath(c,jj,0); c.strokeStyle='rgba(255,240,255,.42)'; c.lineWidth=1.6; c.stroke();

  drawLid(c,jj,o.lift||0,t,o.sealed);
  if(entering.length) drawOrbList(c,entering,t,o,live);

  if(live && !REDUCED){ glint(c,CX-wAt(jj,top+20)+16,top+20,t,0); glint(c,CX+wAt(jj,260)-22,260,t,2.1); glint(c,CX-jj.w0+12,jj.y0+8,t,4.2); }
  if(!o.noTag) drawTag(c,jj,t,o.label,live);
  c.restore();
}
function glint(c,x,y,t,ph){ var a=Math.max(0,Math.sin(t/1100+ph)); a=a*a*a; if(a<0.02) return;
  c.save(); c.translate(x,y); c.globalCompositeOperation='lighter'; c.fillStyle='rgba(255,255,255,'+a+')';
  c.beginPath(); c.moveTo(0,-7); c.lineTo(1.2,-1.2); c.lineTo(7,0); c.lineTo(1.2,1.2); c.lineTo(0,7); c.lineTo(-1.2,1.2); c.lineTo(-7,0); c.lineTo(-1.2,-1.2); c.closePath(); c.fill(); c.restore(); }
function metal(c,x0,x1,cols){ var g=c.createLinearGradient(x0,0,x1,0); cols.forEach(function(col,i){ g.addColorStop(i/(cols.length-1),col); }); return g; }
function drawLid(c,jj,lift,t,sealedNow){
  var y0=jj.y0, w0=jj.w0;
  c.save(); c.translate(0,-lift); if(lift>1){ c.translate(CX,y0); c.rotate(-0.12*Math.min(1,lift/60)); c.translate(-CX,-y0); }
  if(jj.lid==='cork'){
    var top=y0-52, bot=y0+14, rt=w0-3, rb=w0-T+1;
    c.beginPath(); c.moveTo(CX-rt,top); c.lineTo(CX-rb,bot); c.ellipse(CX,bot,rb,9,0,Math.PI,0,true); c.lineTo(CX+rt,top); c.ellipse(CX,top,rt,12,0,0,Math.PI); c.closePath();
    c.save(); c.clip(); c.drawImage(corkTex,CX-85,top-12,170,100);
    c.fillStyle=metal(c,CX-rt,CX+rt,['rgba(40,20,8,.55)','rgba(255,230,190,.10)','rgba(255,240,210,.18)','rgba(40,20,8,.25)','rgba(40,20,8,.6)']); c.fillRect(CX-rt-2,top-14,rt*2+4,bot-top+30);
    if(sealedNow){ c.fillStyle='rgba(255,200,120,'+(0.12+0.08*Math.sin(t/700))+')'; c.fillRect(CX-rt-2,top-14,rt*2+4,bot-top+30); }
    c.restore();
    c.beginPath(); c.ellipse(CX,top,rt,12,0,0,Math.PI*2); c.save(); c.clip(); c.drawImage(corkTex,CX-85,top-30,170,60); c.fillStyle='rgba(255,225,180,.16)'; c.fillRect(CX-rt,top-12,rt*2,24); c.restore();
    c.strokeStyle='rgba(70,40,18,.55)'; c.lineWidth=1; c.beginPath(); c.ellipse(CX,top,rt,12,0,0,Math.PI*2); c.stroke();
  } else if(jj.lid==='gold'||jj.lid==='silver'){
    var cols=jj.lid==='gold'?['#7a4f1c','#e9c47a','#fff0c8','#c9963f','#6e4416']:['#5c5f6e','#cfd3e0','#ffffff','#9aa0b4','#4a4d5a'];
    var rx=w0+6, bandT=y0-12;
    c.fillStyle=metal(c,CX-rx,CX+rx,cols); c.beginPath(); c.moveTo(CX-rx,bandT); c.lineTo(CX-rx,y0+2); c.ellipse(CX,y0+2,rx,9,0,Math.PI,0,true); c.lineTo(CX+rx,bandT); c.closePath(); c.fill();
    if(jj.lid==='gold'){ c.beginPath(); c.ellipse(CX,bandT,rx,9,0,Math.PI,0); c.bezierCurveTo(CX+rx*0.9,bandT-52,CX-rx*0.9,bandT-52,CX-rx,bandT); c.fillStyle=metal(c,CX-rx,CX+rx,cols); c.fill();
      c.fillStyle='rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(CX-rx*0.42,bandT-20,5,13,0.7,0,Math.PI*2); c.fill();
      c.fillStyle=metal(c,CX-10,CX+10,cols); c.beginPath(); c.arc(CX,bandT-46,10,0,Math.PI*2); c.fill(); c.fillStyle='rgba(255,255,255,.7)'; c.beginPath(); c.arc(CX-3,bandT-49,2.6,0,Math.PI*2); c.fill(); }
    else { c.beginPath(); c.ellipse(CX,bandT,rx,9,0,0,Math.PI*2); c.fillStyle=metal(c,CX-rx,CX+rx,['#8a8ea0','#eef0f8','#ffffff','#b9bdcc','#777b8c']); c.fill();
      c.fillStyle=metal(c,CX-10,CX+10,cols); c.beginPath(); c.ellipse(CX,bandT-6,10,6,0,0,Math.PI*2); c.fill(); }
    c.strokeStyle='rgba(255,255,255,.3)'; c.lineWidth=1; c.beginPath(); c.ellipse(CX,bandT+3,rx-5,8,0,0.15*Math.PI,0.85*Math.PI); c.stroke();
    if(sealedNow){ var sg=c.createRadialGradient(CX,bandT-8,4,CX,bandT-8,rx+18); sg.addColorStop(0,'rgba(255,220,150,'+(0.22+0.08*Math.sin(t/700))+')'); sg.addColorStop(1,'rgba(255,220,150,0)'); c.fillStyle=sg; c.beginPath(); c.ellipse(CX,bandT-8,rx+18,34,0,0,Math.PI*2); c.fill(); }
  } else if(jj.lid==='ceramic'){
    var rx2=w0+6, b2=y0-8;
    var cg=metal(c,CX-rx2,CX+rx2,['#b9a691','#f6ebdd','#fffaf2','#e2d2bf','#a8937c']);
    c.fillStyle=cg; c.beginPath(); c.moveTo(CX-rx2,b2); c.lineTo(CX-rx2,y0+4); c.ellipse(CX,y0+4,rx2,9,0,Math.PI,0,true); c.lineTo(CX+rx2,b2); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(CX,b2,rx2,9,0,Math.PI,0); c.bezierCurveTo(CX+rx2*0.9,b2-58,CX-rx2*0.9,b2-58,CX-rx2,b2); c.fillStyle=cg; c.fill();
    c.beginPath(); c.arc(CX,b2-50,12,0,Math.PI*2); c.fillStyle=metal(c,CX-12,CX+12,['#c2ae98','#fffaf2','#d8c6b2']); c.fill();
    c.fillStyle='rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(CX-rx2*0.45,b2-12,6,12,0.5,0,Math.PI*2); c.fill();
  } else if(jj.lid==='gem'){
    c.fillStyle='rgba(215,180,255,.25)'; c.fillRect(CX-w0+8,y0-8,(w0-8)*2,22);
    var gy=y0-8, gw=34;
    var pts=[[CX-gw*0.55,gy-56],[CX+gw*0.55,gy-56],[CX+gw,gy-36],[CX,gy-2],[CX-gw,gy-36]];
    c.beginPath(); pts.forEach(function(p,i){ c[i?'lineTo':'moveTo'](p[0],p[1]); }); c.closePath();
    var gg=c.createLinearGradient(CX-gw,gy-56,CX+gw,gy); gg.addColorStop(0,'rgba(240,220,255,.8)'); gg.addColorStop(.5,'rgba(190,140,255,.45)'); gg.addColorStop(1,'rgba(150,100,230,.7)');
    c.fillStyle=gg; c.fill(); c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=1.2; c.stroke();
    c.beginPath(); c.moveTo(CX-gw,gy-36); c.lineTo(CX+gw,gy-36); c.moveTo(CX-gw*0.55,gy-56); c.lineTo(CX-gw*0.3,gy-36); c.lineTo(CX,gy-2); c.lineTo(CX+gw*0.3,gy-36); c.lineTo(CX+gw*0.55,gy-56); c.moveTo(CX-gw*0.3,gy-36); c.lineTo(CX,gy-56); c.lineTo(CX+gw*0.3,gy-36);
    c.strokeStyle='rgba(255,255,255,.45)'; c.lineWidth=1; c.stroke();
    if(!REDUCED) glint(c,CX-gw*0.4,gy-50,t,1);
  } else if(jj.lid==='glass'){
    var rx3=w0+8, by3=y0-2;
    c.beginPath(); c.roundRect?c.roundRect(CX-rx3,by3-14,rx3*2,18,6):c.rect(CX-rx3,by3-14,rx3*2,18);
    c.fillStyle='rgba(200,230,255,.18)'; c.fill(); c.strokeStyle='rgba(235,245,255,.6)'; c.lineWidth=1.4; c.stroke();
    c.beginPath(); c.ellipse(CX,by3-24,16,12,0,0,Math.PI*2); c.fillStyle='rgba(200,230,255,.22)'; c.fill(); c.stroke();
    c.strokeStyle='rgba(255,255,255,.7)'; c.lineWidth=2.5; c.lineCap='round'; c.beginPath(); c.moveTo(CX-rx3+10,by3-9); c.lineTo(CX-rx3+40,by3-9); c.stroke();
  }
  c.restore();
}
var tagBox=null; // where the tag sits (jar units), for taps
function drawTag(c,jj,t,text,live){
  var sway=REDUCED||!live?0:Math.sin(t/1500)*0.04;
  var ax=CX+jj.w0-2, ay=jj.y0+14, tx=CX+jj.w0+Math.max(26,44-(jj.w0-60)*0.6), ty=jj.y0+70, h=34;
  var fs=13; c.font='italic 500 13px Fraunces, Georgia, serif';
  var tw=text?c.measureText(text).width:0; if(tw>134){ fs=Math.max(10,13*134/tw); c.font='italic 500 '+fs.toFixed(1)+'px Fraunces, Georgia, serif'; tw=c.measureText(text).width; }
  var w=text?Math.max(70,tw+18):64;
  // tilt the tag down until its far corner stays inside the canvas
  var ang=0.42; while(ang<1.4 && tx+Math.cos(ang)*w+Math.sin(ang)*h/2>W-8) ang+=0.03;
  tagBox={x:tx,y:ty,a:ang,w:w,h:h};
  c.strokeStyle='rgba(222,190,160,.85)'; c.lineWidth=1.3; c.beginPath(); c.moveTo(ax,ay); c.quadraticCurveTo(ax+24,ay+10,tx-8*Math.cos(ang),ty-14); c.stroke();
  c.save(); c.translate(tx,ty); c.rotate(ang+sway);
  c.shadowColor='rgba(0,0,0,.35)'; c.shadowBlur=8; c.shadowOffsetY=3; c.fillStyle='#f5e4d6';
  c.beginPath(); c.moveTo(-10,-h/2); c.lineTo(w-6,-h/2); c.quadraticCurveTo(w,-h/2,w,-h/2+6); c.lineTo(w,h/2-6); c.quadraticCurveTo(w,h/2,w-6,h/2); c.lineTo(-10,h/2); c.lineTo(-22,0); c.closePath(); c.fill();
  c.shadowColor='transparent'; c.fillStyle='#d9c0ad'; c.beginPath(); c.arc(-11,0,3.2,0,Math.PI*2); c.fill();
  c.fillStyle='#6d3a52'; c.textBaseline='middle'; c.fillText(text||'Dear Me',0,1);
  if(!text){ c.save(); c.translate(53,0); c.scale(0.55,0.55); c.beginPath(); c.moveTo(0,5); c.bezierCurveTo(-9,-1,-6,-9,0,-4); c.bezierCurveTo(6,-9,9,-1,0,5); c.fillStyle='#c46a8e'; c.fill(); c.restore(); }
  c.restore();
}
function onTag(q){ if(!tagBox) return false; var dx=q.x-tagBox.x, dy=q.y-tagBox.y, ca=Math.cos(-tagBox.a), sa=Math.sin(-tagBox.a);
  var u=dx*ca-dy*sa, v=dx*sa+dy*ca; return u>-26 && u<tagBox.w+8 && Math.abs(v)<tagBox.h/2+10; }

/* ================= sound (Web Audio, made on the fly: soft glass clinks) ================= */
var AC=null, soundOn=true, silent=false, lastClink=0;
function unlockAudio(){ if(!soundOn) return; try{ if(!AC){ var A=window.AudioContext||window.webkitAudioContext; if(!A) return; AC=new A(); } if(AC.state==='suspended') AC.resume(); }catch(_){ } }
function tone(freqs,vol,pan,dur){
  if(silent||!soundOn||!AC||AC.state!=='running') return;
  var now=AC.currentTime, out=AC.createGain(); out.gain.value=vol;
  if(AC.createStereoPanner){ var p=AC.createStereoPanner(); p.pan.value=Math.max(-0.8,Math.min(0.8,pan)); out.connect(p); p.connect(AC.destination); } else out.connect(AC.destination);
  freqs.forEach(function(f,i){ var o=AC.createOscillator(), g=AC.createGain(), d=dur*(i?0.55/i:1); o.type='sine'; o.frequency.value=f;
    g.gain.setValueAtTime(0.0001,now); g.gain.linearRampToValueAtTime(i?0.5/i:1,now+0.004); g.gain.exponentialRampToValueAtTime(0.0001,now+d);
    o.connect(g); g.connect(out); o.start(now); o.stop(now+d+0.05); });
}
function clink(v,x){ if(silent||!AC) return; var n=AC.currentTime; if(n-lastClink<0.04) return; lastClink=n;
  var f=1800+Math.random()*1100; tone([f,f*2.76,f*5.4],Math.min(0.2,0.025+0.2*v*v),(x-CX)/150,0.18+0.2*v); }
function chime(x){ if(silent||!AC) return; lastClink=AC.currentTime; var f=[1046.5,1318.5,1568][Math.random()*3|0];
  tone([f,f*2,f*3.01],0.14,(x-CX)/150,0.9); setTimeout(function(){ tone([f*1.5,f*3],0.07,(x-CX)/150,0.8); },90); }

/* ================= move with the phone (tilt = gravity follows, shake = orbs jump) ================= */
var motionOn=true, motionBound=false, gAng=0, gTarget=0, lastShake=0, gfx=0, gfy=9.8;
// iOS reports motion with the opposite sign to Android/Chrome (upright: y = -9.8 on iPhone, +9.8 elsewhere)
var IOS=/iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints>1);
function onMotion(e){ if(!cv) return;
  // Tilt: gravity on the screen plane follows the phone (low-pass filtered), so orbs roll to the low side.
  var g=e.accelerationIncludingGravity;
  if(g && g.x!=null && g.y!=null){ var x=-g.x, y=g.y; if(IOS){ x=-x; y=-y; } // iOS reports the opposite sign
    gfx+=(x-gfx)*0.25; gfy+=(y-gfy)*0.25;
    var ang=(screen.orientation&&screen.orientation.angle)||0, t2=0;
    if(!ang && Math.hypot(gfx,gfy)>2.5) t2=Math.atan2(gfx,gfy);
    var lim=liftPhase?0.45:1.25; t2=Math.max(-lim,Math.min(lim,t2));
    if(Math.abs(t2-gTarget)>0.008){ gTarget=t2; if(Math.abs(gTarget-gAng)>0.015) wake(); } }
  // Shake: a quick jolt makes the orbs jump.
  var a=e.acceleration; if(!a||a.x==null||liftPhase) return;
  var m=Math.hypot(a.x,a.y||0), n=performance.now(); if(m<9||n-lastShake<110) return; lastShake=n;
  var k=Math.min(1.6,m/14), sx=IOS?-1:1;
  orbs.forEach(function(o){ o.vx+=(-a.x*sx*24+(Math.random()*2-1)*90)*k; o.vy+=((a.y||0)*sx*24-80-Math.random()*140)*k;
    var sp=Math.hypot(o.vx,o.vy); if(sp>900){ o.vx*=900/sp; o.vy*=900/sp; } });
  wake(); }
function bindMotion(){ if(motionBound||!motionOn||REDUCED) return; motionBound=true; window.addEventListener('devicemotion',onMotion); }
function unbindMotion(){ motionBound=false; gTarget=0; window.removeEventListener('devicemotion',onMotion); }
function askMotion(){ if(!motionOn||REDUCED) return;
  var DM=window.DeviceMotionEvent;
  if(DM && typeof DM.requestPermission==='function'){ // iOS: needs a tap first
    DM.requestPermission().then(function(r){ if(r==='granted') bindMotion(); }).catch(function(){});
  } else bindMotion(); }
var firstTapDone=false;
function onFirstTap(){ unlockAudio(); if(!firstTapDone){ firstTapDone=true; askMotion(); } }

function ease(x){return 1-Math.pow(1-x,3);}
function wake(){ sleeping=false; calm=0; if(cv && !raf) raf=requestAnimationFrame(frame); }

/* ================= live loop ================= */
function frame(now){
  raf=0; if(!cv) return;
  var dt=Math.min(0.033,(now-(last||now))/1000); last=now;
  if(wobbleT>=0){ wobbleT+=dt; tilt=0.16*Math.exp(-wobbleT*3.2)*Math.sin(wobbleT*16); if(wobbleT>2){wobbleT=-1;tilt=0;} }
  else tilt+=(0-tilt)*Math.min(1,dt*6);
  gAng+=(gTarget-gAng)*Math.min(1,dt*8);
  if(liftPhase){ var e=now-liftPhase.t0;
    lift = e<260 ? 80*ease(e/260) : e<820 ? 80 : e<1160 ? 80*(1-ease((e-820)/340)) : 0;
    if(!liftPhase.spawned && e>=230){ liftPhase.spawned=true; var sp=liftPhase.spec; var o=makeOrb(sp.inside,sp.color,CX+(Math.random()*12-6),J().y0-40);
      o.id=sp.id; o.hue=sp.hue==null?o.hue:sp.hue; o.vy=60; o.fresh=true; orbs.push(o); sleeping=false; calm=0; }
    if(e>=1160){ var cb=liftPhase.done; liftPhase=null; lift=0; if(cb) setTimeout(cb, 500); } }
  if(!sleeping){ for(var s=0;s<4;s++) step(dt/4);
    var en=0; orbs.forEach(function(o){en+=Math.abs(o.vx)+Math.abs(o.vy);});
    if(en<orbs.length*6 && !liftPhase && Math.abs(tilt)<0.002 && Math.abs(gTarget-gAng)<0.004 && !dragging){ if(++calm>40){ sleeping=true; orbs.forEach(function(o){o.vx=o.vy=0;}); } } else calm=0; }
  for(var i=particles.length-1;i>=0;i--){ var p=particles[i]; p.vy+=180*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; if(p.y>FY-2){ p.y=FY-2; p.vy*=-0.3; p.vx*=0.6; } p.life-=dt*1.4; if(p.life<=0) particles.splice(i,1); }
  glowPulse=Math.max(0,glowPulse-dt*1.2);
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,cv.width,cv.height); ctx.setTransform(K,0,0,K,0,0);
  ctx.translate(0,OY+LT);
  drawScene(ctx,J(),orbs,now,{live:true,tilt:tilt,lift:lift,pulse:glowPulse,particles:particles,label:label,sealed:sealed});
  if(hi){ var h=orbs.find(function(o){return o.id===hi;}); if(h){ ctx.save(); ctx.translate(CX,BY); ctx.rotate(tilt); ctx.translate(-CX,-BY);
    ctx.strokeStyle='#efb94f'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.arc(h.x,h.y,h.r+5,0,Math.PI*2); ctx.stroke();
    ctx.globalAlpha=.35; ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(h.x,h.y,h.r+11,0,Math.PI*2); ctx.stroke(); ctx.restore(); } }
  // Keep drawing while anything moves; when asleep, a gentle 12 fps keeps glints and twinkle alive (none with reduced motion).
  if(!sleeping || liftPhase || particles.length || wobbleT>=0 || dragging) raf=requestAnimationFrame(frame);
  else if(!REDUCED) setTimeout(function(){ if(cv && !raf) raf=requestAnimationFrame(frame); }, 83);
}

function resize(){
  if(!cv) return;
  DPR=Math.min(window.devicePixelRatio||1,2);
  var box=cv.parentElement, avail=Math.min(box.clientWidth||360, 400), availH=Math.max(400, Math.min(box.clientHeight||520, 560));
  S=Math.min(avail/W, availH/(H+LT)); K=S*DPR;
  cv.style.width=(W*S)+'px'; cv.style.height=((H+LT)*S)+'px'; cv.width=Math.round(W*K); cv.height=Math.round((H+LT)*K);
  corkTex=makeCorkTex(); spriteCache={}; wake();
}

function toLocal(e){ var r=cv.getBoundingClientRect(); return { x:(e.clientX-r.left)/S, y:(e.clientY-r.top)/S-OY-LT }; }
function onDown(e){ dragging=true; dragMoved=false; dragX=e.clientX; wobbleT=-1; try{cv.setPointerCapture(e.pointerId);}catch(_){} wake(); }
function onMove(e){ if(!dragging) return; if(Math.abs(e.clientX-dragX)>6) dragMoved=true; }
function onUp(e){ if(!dragging) return; dragging=false; wake();
  if(!dragMoved && mounted.onTapTag && onTag(toLocal(e))){ mounted.onTapTag(); return; }
  if(!dragMoved && mounted.onTapOrb){ var p=toLocal(e), hit=null;
    orbs.forEach(function(o){ if(Math.hypot(o.x-p.x,o.y-p.y)<=o.r+6) hit=o; });
    mounted.onTapOrb(hit?hit.id:null); } }
var mounted={onTapOrb:null,onTapTag:null};

/* ================= public API ================= */
/** Put the live jar on a canvas. orbList: [{id, inside, color, hue}] in the order they were kept. */
export function mountJar(canvas, opts){
  unmountJar();
  cv=canvas; ctx=cv.getContext('2d'); jarId=JARS[opts.style]?opts.style:'classic'; label=opts.label||''; sealed=false; hi=null;
  mounted.onTapOrb=opts.onTapOrb||null; mounted.onTapTag=opts.onTapTag||null;
  soundOn=opts.sound!==false; motionOn=opts.motion!==false; if(!motionOn) unbindMotion();
  document.addEventListener('pointerup',onFirstTap,true); document.addEventListener('click',onFirstTap,true);
  resize();
  settle((opts.orbs||[]).map(function(s){ var o=makeOrb(s.inside,s.color,0,0); o.id=s.id; if(s.hue!=null) o.hue=s.hue; return o; }));
  cv.addEventListener('pointerdown',onDown); cv.addEventListener('pointermove',onMove);
  cv.addEventListener('pointerup',onUp); cv.addEventListener('pointercancel',onUp);
  window.addEventListener('resize',resize);
  wake();
}
export function unmountJar(){
  if(!cv) return;
  cv.removeEventListener('pointerdown',onDown); cv.removeEventListener('pointermove',onMove);
  cv.removeEventListener('pointerup',onUp); cv.removeEventListener('pointercancel',onUp);
  window.removeEventListener('resize',resize);
  document.removeEventListener('pointerup',onFirstTap,true); document.removeEventListener('click',onFirstTap,true); unbindMotion(); firstTapDone=false;
  if(raf) cancelAnimationFrame(raf); raf=0; cv=null; ctx=null; particles=[]; liftPhase=null; lift=0;
}
/** The cork lifts, the orb drops in, the cork closes. Calls done() once it has landed. */
export function dropOrb(spec, done){ if(!cv){ if(done) done(); return; } if(REDUCED){ var o=makeOrb(spec.inside,spec.color,0,0); o.id=spec.id; if(spec.hue!=null) o.hue=spec.hue; settle(orbs.concat([o])); wake(); if(done) setTimeout(done,300); return; }
  liftPhase={t0:performance.now(),spawned:false,spec:spec,done:done}; wake(); }
export function shakeJar(){ if(REDUCED||!cv) return; wobbleT=0; orbs.forEach(function(o){ o.vx+=(Math.random()*2-1)*260; o.vy-=120+Math.random()*260; }); wake(); }
export function setJarStyle(style){ if(!JARS[style]) return; jarId=style; settle(orbs.slice()); spriteCache={}; wake(); }
export function setJarLabel(text){ label=text||''; wake(); }
export function highlightOrb(id){ hi=id||null; wake(); }
export function isBusy(){ return !!liftPhase; }
/** Resting places (jar units) of every orb, to freeze a sealed jar exactly as it is. */
export function snapshot(){ return orbs.map(function(o){ return {id:o.id,x:+o.x.toFixed(1),y:+o.y.toFixed(1),a:+o.a.toFixed(2),r:o.r}; }); }
/** Where an orb sits on screen (CSS px, relative to the canvas), for the "tap an orb" card. */
export function orbScreenPos(id){ var o=orbs.find(function(x){return x.id===id;}); if(!o||!cv) return null; return { x:o.x*S, y:(o.y+OY+LT)*S, r:o.r*S }; }

/** A still jar (shelf, pickers). orbList items: {inside,color,hue,x?,y?,a?}. Without positions they are settled first. */
export function drawStillJar(canvas, cssW, style, orbList, text){
  var jj=JARS[style]||JARS.classic, sc=cssW/W, cssH=Math.round(H*sc), dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.style.width=cssW+'px'; canvas.style.height=cssH+'px'; canvas.width=Math.round(cssW*dpr); canvas.height=Math.round(cssH*dpr);
  var list=orbList.map(function(s){ var o={x:s.x,y:s.y,vx:0,vy:0,r:s.r||jj.r,th:s.inside,ci:s.color,a:s.a||0,base:0,hue:s.hue||1,tw:0,fresh:false,id:s.id}; return o; });
  if(list.some(function(o){return o.x==null;})){ var sJ=jarId, sO=orbs; jarId=jj.id; settle(list); list=orbs; jarId=sJ; orbs=sO; }
  var c=canvas.getContext('2d'), sK=K; K=sc*dpr; var sCache=spriteCache; spriteCache={}; var sCork=corkTex; corkTex=makeCorkTex();
  c.setTransform(sc*dpr,0,0,sc*dpr,0,0); c.translate(0,OY);
  var sTag=tagBox; drawScene(c,jj,list,0,{live:false,label:text||'',sealed:true,noTag:text==null}); tagBox=sTag;
  K=sK; spriteCache=sCache; corkTex=sCork;
}
/** One orb on its own (pickers). */
export function drawOrbPreview(canvas, inside, size){
  size=size||56; var dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.style.width=size+'px'; canvas.style.height=size+'px'; canvas.width=size*dpr; canvas.height=size*dpr;
  var c=canvas.getContext('2d'); var o={x:0,y:0,r:size*0.36,th:inside,ci:0,a:0,base:0,hue:1};
  var sK=K; K=dpr; var s=orbSprite(o), h=haloSprite(o); K=sK;
  c.globalCompositeOperation='lighter'; c.drawImage(h,(size*dpr-h.width)/2,(size*dpr-h.height)/2);
  c.globalCompositeOperation='source-over'; c.drawImage(s,(size*dpr-s.width)/2,(size*dpr-s.height)/2);
}
export const JAR_STYLES = Object.keys(JARS).map(function(k){ return { id:k, name:JARS[k].name, level:JARS[k].lv }; });
export const INSIDES = Object.keys(THEMES).map(function(k){ return { id:k, name:THEMES[k].name, level:THEMES[k].lv, colors:THEMES[k].pal.length }; });
buildTables();
/** An orb's colours, for small dots in lists: {light, base, deep, glow:"r,g,b"}. */
export function orbColors(inside, color){ var t=THEMES[inside]||THEMES.pearl, p=t.pal[color%t.pal.length]; return { light:p.l, base:p.b, deep:p.d, glow:p.g.join(',') }; }

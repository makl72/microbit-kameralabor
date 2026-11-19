/* Pure project validation, diversity heuristic and stable-command gate. No camera or network access. */
(function(root){
  'use strict';

  const TARGET=50;
  const MIN=10;
  const MAX=300;
  const SYMBOLS=['heart','smile','left','right','up','down','check','cross','square','off'];
  const LEGACY_SYMBOLS=['heart','smile','left','right','check'];

  function trainingReadiness(classes){
    const active=classes
      .map((c,i)=>({
        index:i,
        name:c.name||'Klasse '+(i+1),
        count:c.samples.length,
        missing:Math.max(0,MIN-c.samples.length)
      }))
      .filter(c=>c.count>0);
    const missing=active.filter(c=>c.missing>0);
    return {ready:active.length>0&&missing.length===0,active,missing};
  }

  function normalize(row){
    const norm=Math.hypot(...row);
    return row.map(v=>norm?v/norm:0);
  }

  function cosine(a,b){
    let sum=0;
    for(let i=0;i<a.length;i++)sum+=a[i]*b[i];
    return sum;
  }

  function sampleDiversity(samples){
    if(!Array.isArray(samples)||samples.length<3){
      return {score:null,label:'noch zu wenige Bilder',level:'empty'};
    }
    const limit=36;
    const step=Math.max(1,Math.floor(samples.length/limit));
    const picked=[];
    for(let i=0;i<samples.length&&picked.length<limit;i+=step){
      picked.push(normalize(samples[i]));
    }
    let sum=0;
    let pairs=0;
    for(let i=0;i<picked.length;i++){
      for(let j=i+1;j<picked.length;j++){
        sum+=Math.max(0,1-cosine(picked[i],picked[j]));
        pairs++;
      }
    }
    const distance=pairs?sum/pairs:0;
    const score=Math.max(0,Math.min(1,distance/.12));
    if(score<.12)return {score:score,label:'1/6 · sehr ähnlich',level:'very-low'};
    if(score<.24)return {score:score,label:'2/6 · wenig vielfältig',level:'low'};
    if(score<.38)return {score:score,label:'3/6 · etwas vielfältig',level:'fair'};
    if(score<.55)return {score:score,label:'4/6 · gut gemischt',level:'good'};
    if(score<.75)return {score:score,label:'5/6 · sehr gut gemischt',level:'very-good'};
    return {score:score,label:'6/6 · sehr vielfältig',level:'great'};
  }

  function singleProfile(samples){
    const refs=samples.map(normalize);
    const nearest=refs
      .map((a,i)=>Math.max(...refs.map((b,j)=>i===j?-1:cosine(a,b))))
      .sort((a,b)=>a-b);
    const reference=Math.max(.70,Math.min(.98,nearest[Math.floor(nearest.length*.1)]||.9));
    return {refs:refs,reference:reference,floor:Math.max(.45,reference-.15)};
  }

  function singleScore(row,profile){
    const ref=normalize(row);
    const similarity=Math.max(...profile.refs.map(r=>cosine(ref,r)));
    return Math.max(0,Math.min(.99,.95*(similarity-profile.floor)/(profile.reference-profile.floor)));
  }

  function mapProbabilities(values,indices,size){
    const length=Math.max(Number(size)||0,...indices.map(i=>i+1),0);
    const result=Array(length).fill(0);
    indices.forEach((slot,i)=>{result[slot]=values[i]??0;});
    return result;
  }

  function command(s){
    return /^[A-Z0-9_]{1,18}$/.test(s);
  }

  function projectFilename(name){
    const slug=(name||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-|-$/g,'');
    return (slug||'teachable-labor-projekt')+'.json';
  }

  function projectNameForFile(filename,embeddedName){
    const embedded=typeof embeddedName==='string'?embeddedName.trim().slice(0,60):'';
    const stem=typeof filename==='string'&&/\.json$/i.test(filename)
      ?filename.slice(0,-5).trim().slice(0,60)
      :'';
    return stem&&filename!==projectFilename(embedded)?stem:embedded||stem||'Importiertes Experiment';
  }

  function validateProject(p){
    if(
      !p||
      p.format!=='microbit-kameralabor-v1'||
      p.base!=='mobilenet-v1-050'||
      !Array.isArray(p.classes)||
      p.classes.length<1||
      p.classes.length>200
    ){
      throw Error('Keine passende Teachable-Labor-Projektdatei.');
    }

    let dim=null;
    const classes=p.classes.map((c,i)=>{
      if(
        !c||
        typeof c.name!=='string'||
        c.name.length>60||
        !command(c.command)||
        !Array.isArray(c.samples)||
        c.samples.length>MAX
      ){
        throw Error('Ungültige Klasse '+(i+1)+'.');
      }

      const samples=c.samples.map(row=>{
        if(
          !Array.isArray(row)||
          row.length<16||
          row.length>4096||
          row.some(v=>!Number.isFinite(v)||Math.abs(v)>10000)
        ){
          throw Error('Ungültige Lernmerkmale.');
        }
        if(dim===null)dim=row.length;
        if(row.length!==dim)throw Error('Uneinheitliche Lernmerkmale.');
        return row;
      });

      const thumb=(
        typeof c.thumb==='string'&&
        c.thumb.length<100000&&
        /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(c.thumb)
      )?c.thumb:'';

      if(c.images!==undefined&&(!Array.isArray(c.images)||c.images.length!==samples.length)){
        throw Error('Bildübersicht und Lernmerkmale passen nicht zusammen.');
      }

      const images=c.images
        ?c.images.map(v=>(
          typeof v==='string'&&
          v.length<100000&&
          /^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(v)
        )?v:null)
        :Array(samples.length).fill(null);

      if(!c.images&&thumb&&images.length)images[images.length-1]=thumb;

      const requested=c.symbol;
      let symbol=null;
      if(requested===undefined)symbol=LEGACY_SYMBOLS[i]||null;
      else if(requested===null||requested==='')symbol=null;
      else if(SYMBOLS.includes(requested))symbol=requested;

      return {
        name:c.name.trim(),
        command:c.command,
        samples:samples,
        images:images,
        thumb:thumb,
        symbol:symbol
      };
    });
    return classes;
  }

  function removeSamples(c,indices){
    const remove=new Set(indices.filter(i=>Number.isInteger(i)&&i>=0&&i<c.samples.length));
    if(!remove.size)return 0;
    const images=Array.isArray(c.images)?c.images:Array(c.samples.length).fill(null);
    c.samples=c.samples.filter((_,i)=>!remove.has(i));
    c.images=images.filter((_,i)=>!remove.has(i));
    c.thumb=[...c.images].reverse().find(Boolean)||'';
    return remove.size;
  }

  function createGate(){
    let candidate=-1;
    let since=0;
    return {
      reset(){
        candidate=-1;
        since=0;
      },
      update(probs,threshold,now){
        const high=Math.max(...probs);
        const index=probs.indexOf(high);
        if(!Number.isFinite(high)||high<threshold){
          candidate=-1;
          since=0;
          return {index:-1,reason:'Unsicher erkannt → STOPP'};
        }
        if(candidate!==index){
          candidate=index;
          since=now;
          return {index:-1,reason:'Zeichen stabilisieren …'};
        }
        if(now-since<600)return {index:-1,reason:'Zeichen stabilisieren …'};
        return {index:index,reason:'Seit mindestens 0,6 s stabil erkannt'};
      }
    };
  }

  const api={
    TARGET,MIN,MAX,
    trainingReadiness,
    sampleDiversity,
    singleProfile,
    singleScore,
    mapProbabilities,
    command,
    projectFilename,
    projectNameForFile,
    removeSamples,
    validateProject,
    createGate
  };

  if(typeof module!=='undefined')module.exports=api;
  else root.CameraLabCore=api;
})(typeof window!=='undefined'?window:globalThis);

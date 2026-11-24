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

  // Capture appends immutable feature rows. Deletion/import supplies a new array.
  const diversityCache=new WeakMap();
  const nearDuplicateDistance=.12;

  function diversityDistances(samples){
    let state=diversityCache.get(samples);
    if(!state||state.rows.length>samples.length){
      state={rows:[],nearest:[],distanceSum:0};
      diversityCache.set(samples,state);
    }
    for(let i=state.rows.length;i<samples.length;i++){
      const row=normalize(samples[i]);
      const empty=row.every(value=>value===0);
      let nearest=Infinity;
      for(let j=0;j<i;j++){
        const other=state.rows[j];
        const distance=empty&&other.empty?0:Math.max(0,1-cosine(row,other.row));
        nearest=Math.min(nearest,distance);
        state.nearest[j]=Math.min(state.nearest[j],distance);
        state.distanceSum+=distance;
      }
      state.rows.push({row,empty});
      state.nearest.push(nearest);
    }
    return state;
  }

  function sampleDiversity(samples){
    if(!Array.isArray(samples)||samples.length<3){
      return {
        score:null,label:'Noch nicht bewertbar',level:'empty',reliability:'Noch zu wenige Bilder',
        duplicateRate:null,duplicateFreedom:null,spread:null,novelty:null,
        advice:'Nimm zuerst mindestens 3 unterschiedliche Bilder auf.'
      };
    }

    const {nearest,distanceSum}=diversityDistances(samples);
    const n=samples.length;
    // A photo counts as repeated if any other photo looks very similar.
    const duplicateRate=nearest.filter(distance=>distance<=nearDuplicateDistance).length/n;
    const duplicateFreedom=1-duplicateRate;
    const meanDistance=2*distanceSum/(n*(n-1));
    const spread=Math.min(1,meanDistance/.75);
    const novelty=nearest.reduce((sum,distance)=>{
      const beyondDuplicate=Math.max(0,distance-nearDuplicateDistance);
      return sum+Math.min(1,beyondDuplicate/.46);
    },0)/n;
    // Grade similarity continuously around the displayed near-duplicate threshold.
    const repeatWeight=nearest.reduce((sum,distance)=>{
      const fraction=(2*nearDuplicateDistance-distance)/(2*nearDuplicateDistance);
      return sum+Math.max(0,Math.min(1,fraction));
    },0)/n;
    // Wide gaps between a few repeatedly photographed poses do not earn a high score.
    const raw=(.45*spread+.55*novelty)*(1-.85*repeatWeight);
    const score=Math.round(100*raw);

    let level,label;
    if(score<18){level='very-low';label='Fast identisch'}
    else if(score<32){level='low';label='Wenig abwechslungsreich'}
    else if(score<47){level='fair';label='Erste echte Unterschiede'}
    else if(score<62){level='good';label='Gut variiert'}
    else if(score<76){level='very-good';label='Sehr abwechslungsreich'}
    else if(score<90){level='great';label='Stark gemischt'}
    else{level='excellent';label='Außergewöhnlich vielfältig'}

    const reliability=samples.length<6?'Erste Schätzung':samples.length<10?'Vorläufige Bewertung':samples.length<20?'Solide Bewertung':'Stabile Bewertung';

    let advice;
    if(duplicateRate>.45)advice='Viele Aufnahmen sind nahezu doppelt. Ändere die Szene deutlicher statt nur weiterzuklicken.';
    else if(spread<.34)advice='Die Gesamtansichten liegen noch eng beieinander. Variiere Perspektive, Abstand oder Hintergrund stärker.';
    else if(novelty<.32)advice='Neue Bilder ähneln den vorhandenen stark. Suche bewusst Ansichten, die bisher fehlen.';
    else if(score<62)advice='Die Richtung stimmt. Ergänze einige deutlich andere Ansichten derselben Klasse.';
    else if(score<76)advice='Gute Mischung. Ein paar ungewohnte Perspektiven machen das Training robuster.';
    else advice='Breite Mischung. Jetzt lohnt sich besonders der Test mit wirklich neuen Ansichten.';

    return {
      score,label,level,reliability,advice,
      duplicateRate,
      duplicateFreedom:Math.round(duplicateFreedom*100),
      spread:Math.round(spread*100),
      novelty:Math.round(novelty*100)
    };
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

'use strict';
const $=id=>document.getElementById(id);
const {TARGET,MIN,MAX}=CameraLabCore;
const colors=['#ffc43d','#4285e9','#42c83d','#f2558c','#9a4de0'];
let classes=[['Offene Hand','STOPP'],['Faust','VORWAERTS'],['Zeichen links','LINKS'],['Zeichen rechts','RECHTS'],['Hintergrund / keine Geste','STOPP']].map(([name,command])=>({name,command,samples:[],images:[],thumb:''}));
let stream=null,front=false,base=null,basePromise=null,head=null,trained=false,training=false,predicting=false,recording=null,extracting=false,cameraStarting=false,revision=0,trainMessage='',trainError=false;
let currentCommand='STOPP',lastInference=0,lastLogged='',toastTimer;
let captureSerial=0,predictSerial=0,confidence=0.85;
let cameraWatchTimer=null,lastVideoTime=0,lastVideoProgress=0,lastCameraRecovery=0;
let trainingBackend=null,activeIndices=[],oneClass=null,savedModel=null,selectedClass=0,currentPane='collect',restoring=true,saveTimer,savePending=false,storageHealthy=true,saveChain=Promise.resolve();
let projectDirty=false,storageVersion=null;
let projectName='Mein Experiment',undoDeletion=null,gallerySelection=new Set(),gallerySlot=0;
let bitLink=null,bitMode=window.webkit?.messageHandlers?.microbit?'native':/iPad|iPhone|iPod/.test(navigator.userAgent)||(!navigator.serial&&navigator.bluetooth)?'ble':'usb',bitConnecting=false,bitTesting=false,bitReady=false,bitView='connect',currentClass=-1,currentSymbol='off',sending=false,pendingSymbol=false;
const gate=CameraLabCore.createGate();
const canvas=document.createElement('canvas');canvas.width=canvas.height=224;
const ctx=canvas.getContext('2d',{willReadFrequently:true});
const thumbCanvas=document.createElement('canvas');thumbCanvas.width=thumbCanvas.height=96;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500)}
function imageCount(n){return n+' '+(n===1?'Bild':'Bilder')}
function renderCards(){
 const cards=$('classCards');cards.replaceChildren();
 classes.forEach((c,i)=>{
  const card=document.createElement('article');card.className='classcard';card.style.setProperty('--color',colors[i]);card.id='class'+i;
  card.innerHTML='<div class="card-top"><span class="classnumber">'+(i+1)+'</span><input class="class-name" maxlength="60" aria-label="Name Klasse '+(i+1)+'"><button class="plain clear" aria-label="Bilder von Klasse '+(i+1)+' löschen">Alle löschen</button></div><div class="card-body"><div class="thumbnail"></div><div class="sampleinfo"><div class="count"><span></span><small>Startziel</small></div><div class="track"><i></i></div><div class="remaining"></div></div><div class="capturebuttons"><button class="record" disabled>● Aufnehmen</button><button class="series" disabled>Serie</button></div></div><div class="photo-review"><div class="photo-review-head"><strong>Deine Bilder · sofort löschbar</strong><button class="gallery-open secondary">Alle ansehen und löschen</button></div><div class="photo-strip" aria-label="Zuletzt aufgenommene Bilder"></div></div><div class="action-choice"><div class="led-matrix class-action-preview" aria-hidden="true"></div><label><strong>Wenn diese Klasse erkannt wird:</strong><select class="class-symbol" aria-label="micro:bit-Aktion für Klasse '+(i+1)+'"></select></label></div><label class="mapping">→ Befehl <input maxlength="18" aria-label="Befehl Klasse '+(i+1)+'" spellcheck="false"></label>';
  const nameWrap=document.createElement('label');nameWrap.className='name-field';const nameCaption=document.createElement('span');nameCaption.textContent='Name der Klasse';const nameInput=card.querySelector('.class-name');nameInput.before(nameWrap);nameWrap.append(nameCaption,nameInput);nameInput.placeholder='Eigenen Namen eingeben';nameInput.autocomplete='off';
  const name=card.querySelector('.class-name');name.value=c.name;name.addEventListener('input',()=>{c.name=name.value;renderBars();updateControls();updateClassTabs();scheduleSave()});name.addEventListener('blur',()=>{c.name=name.value.trim()||'Klasse '+(i+1);name.value=c.name;renderBars();updateControls();updateClassTabs();scheduleSave()});
  const cmd=card.querySelector('.mapping input');cmd.value=c.command;cmd.addEventListener('change',()=>{const s=cmd.value.trim().toUpperCase();if(!CameraLabCore.command(s)){cmd.value=c.command;toast('Befehle: 1–18 Zeichen, nur A–Z, 0–9 und Unterstrich.');return}stopPrediction();c.command=s;cmd.value=s;scheduleSave();toast('Befehl geändert. Erkennung bei Bedarf neu starten.')});
  card.querySelector('.clear').onclick=()=>deleteImages(i,c.samples.map((_,j)=>j));
  card.querySelector('.gallery-open').onclick=()=>openGallery(i);
  const symbolSelect=card.querySelector('.class-symbol');for(const [value,number] of Object.entries(actionNumbers)){const option=document.createElement('option');option.value=value;option.textContent=number;option.setAttribute('aria-label',number+' – '+symbolLabels[value]);symbolSelect.append(option)}
  symbolSelect.value=getClassSymbol(i);renderNumberLED(card.querySelector('.class-action-preview'),getClassSymbol(i));
  symbolSelect.onchange=()=>setClassSymbol(i,symbolSelect.value);
  const rec=card.querySelector('.record');rec.addEventListener('pointerdown',e=>{e.preventDefault();rec.setPointerCapture(e.pointerId);startCapture(i,false)});
  ['pointerup','pointercancel','lostpointercapture'].forEach(event=>rec.addEventListener(event,()=>{if(recording?.i===i&&!recording.series)stopCapture()}));
  rec.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();startCapture(i,false)}});rec.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter')stopCapture()});
  card.querySelector('.series').addEventListener('click',()=>{if(recording?.i===i)stopCapture();else startCapture(i,true)});
  card.hidden=i!==selectedClass;cards.append(card);
 });updateCards();renderBars();updateClassTabs();
}
function updateCards(){
 let total=0;
 classes.forEach((c,i)=>{
  total+=c.samples.length;const card=$('class'+i),n=c.samples.length;
  card.querySelector('.count span').textContent=n+' / '+TARGET+' Bilder';card.querySelector('.track i').style.width=Math.min(100,n/TARGET*100)+'%';
  card.querySelector('.remaining').textContent=n>=TARGET?'Startziel erreicht · neue Ansichten ergänzbar':'Noch '+imageCount(TARGET-n)+' bis zum Startziel';
  const thumb=card.querySelector('.thumbnail');thumb.replaceChildren();if(c.thumb){const im=new Image();im.src=c.thumb;im.alt='Letzte Aufnahme: '+c.name;thumb.append(im)}else thumb.textContent='+';
  const own=recording?.i===i;card.classList.toggle('collecting',own);
  card.querySelector('.record').disabled=!stream||!base||training||cameraStarting||n>=MAX||!!recording&&!own;
  const series=card.querySelector('.series');series.disabled=!stream||!base||training||cameraStarting||!!recording&&!own||n>=MAX;series.textContent=own&&recording.series?'■ Ende':'Serie';
  card.querySelector('.clear').disabled=restoring||training||!!recording||extracting||!n;
  card.querySelector('.gallery-open').disabled=restoring||training||!!recording||extracting||!n;card.querySelector('.gallery-open').textContent='Alle '+imageCount(n)+' ansehen und löschen';
  card.querySelector('.class-symbol').disabled=restoring||training;
  renderPhotoStrip(i,card);
  card.querySelector('.class-name').disabled=training||restoring;card.querySelector('.mapping input').disabled=training||!!recording;
 });
 $('totalCount').textContent=imageCount(total);updateControls();updateClassTabs();
}
function renderPhotoStrip(slot,card){
 const strip=card.querySelector('.photo-strip'),c=classes[slot],start=Math.max(0,c.samples.length-8);strip.replaceChildren();
 if(!c.samples.length){strip.textContent='Noch keine Bilder. Nach der ersten Aufnahme erscheint hier sofort die Löschmöglichkeit.';return}
 for(let i=start;i<c.samples.length;i++){
  const tile=document.createElement('div');tile.className='photo-tile';const data=c.images?.[i];
  if(data){const image=new Image();image.src=data;image.alt='Bild '+(i+1);tile.append(image)}else{const missing=document.createElement('span');missing.textContent='#'+(i+1);tile.append(missing)}
  const remove=document.createElement('button');remove.type='button';remove.className='photo-remove';remove.textContent='×';remove.setAttribute('aria-label','Bild '+(i+1)+' sofort löschen');remove.disabled=restoring||training||!!recording||extracting;remove.onclick=()=>deleteImages(slot,[i]);tile.append(remove);strip.append(tile)
 }
}
function showTrainMessage(message,error=false){trainMessage=message;trainError=error;$('trainMessage').textContent=message;$('trainMessage').hidden=!message;$('trainMessage').classList.toggle('error',error)}
function updateControls(){
 const status=CameraLabCore.trainingReadiness(classes),ready=status.ready;
 // Keep the action available so a tap can explain precisely what is missing.
 $('trainBtn').disabled=restoring||training||!!recording||extracting||cameraStarting;
 $('trainBtn').setAttribute('aria-describedby','trainHint trainMessage');
 $('predictBtn').disabled=!trained||!stream||training||!!recording;
 $('predictBtn').textContent=predicting?'Erkennung läuft':'Erkennung starten';$('predictBtn').disabled=restoring||predicting||!trained||!stream||training||!!recording;
 $('goLive').disabled=!trained||training;updateBitUI();
 $('singleHint').hidden=activeIndices.length!==1;
 $('singleHint').textContent='Eine Klasse: Ähnlichkeit mit deinen Beispielen. Mit einer Hintergrundklasse wird die Unterscheidung zuverlässiger.';
 $('trainBtn').textContent=training?'KI lernt …':trained?'Erneut trainieren':ready?'KI trainieren':'Trainingsbereitschaft prüfen';
 $('trainHint').textContent=training?'Die belegten Klassen werden auf deinem Gerät gelernt.':trained?'Trainiert. Teste jetzt in der Live-Ansicht.':ready?status.active.length+' belegte '+(status.active.length===1?'Klasse ist':'Klassen sind')+' bereit. Leere Klassen bleiben unbenutzt.':status.active.length?'Für jede belegte Klasse sind mindestens 10 Bilder nötig. Leere Klassen bleiben frei.':'Wähle eine Klasse und sammle mindestens 10 Bilder. Du kannst 1 bis 5 Klassen trainieren.';
 const list=$('trainReadiness');list.replaceChildren();classes.forEach((c,i)=>{const row=document.createElement('div');row.className='readiness-row';const label=document.createElement('span');label.textContent=c.name||'Klasse '+(i+1);const count=document.createElement('strong');count.textContent=!c.samples.length?'Leer · wird übersprungen':c.samples.length>=MIN?'✓ '+c.samples.length+' Bilder':c.samples.length+' / '+MIN+' · noch '+(MIN-c.samples.length);count.className=c.samples.length>=MIN?'ready':c.samples.length?'missing':'';row.append(label,count);list.append(row)});
 list.hidden=training||trained;
 $('cameraBtn').disabled=restoring||cameraStarting||training;$('switchCam').disabled=!stream||training||!!recording||cameraStarting;$('restartCam').disabled=!stream||training||cameraStarting;$('stopCam').disabled=!stream||training||cameraStarting;
 $('newProjectBtn').disabled=restoring||training||extracting;$('projectName').disabled=restoring||training;
 $('quickSaveBtn').disabled=restoring||training||!!recording||extracting;
 $('loadBtn').disabled=restoring||training||!!recording||extracting;$('saveBtn').disabled=restoring||training||!!recording||extracting;
}

function renderBars(probs){
 const rows=$('predictionBars');rows.replaceChildren();
 const active=classes.map((c,i)=>({c,i})).filter(({c})=>c.samples.length);
 rows.dataset.classCount=String(active.length);
 const best=probs&&active.length?active.reduce((a,b)=>(probs[b.i]||0)>(probs[a.i]||0)?b:a,active[0]).i:-1;
 active.forEach(({c,i})=>{
  const score=probs?Math.max(0,Math.min(1,probs[i]||0)):0;
  const row=document.createElement('div');row.className='predrow prediction-card'+(i===best?' is-leading':'');row.style.setProperty('--class-color',colors[i]);
  const top=document.createElement('div');top.className='prediction-top';
  const identity=document.createElement('div');identity.className='prediction-identity';
  const dot=document.createElement('span');dot.className='prediction-dot';dot.textContent=i+1;
  const name=document.createElement('strong');name.textContent=c.name;
  identity.append(dot,name);
  const value=document.createElement('b');value.className='prediction-value';value.textContent=probs?Math.round(score*100)+' %':'—';
  top.append(identity,value);
  const track=document.createElement('div');track.className='track prediction-track';const bar=document.createElement('i');bar.style.background=colors[i];bar.style.width=probs?score*100+'%':'0%';track.append(bar);
  const caption=document.createElement('small');caption.className='prediction-caption';caption.textContent=i===best&&probs?'höchste Übereinstimmung':'';
  row.append(top,track,caption);rows.append(row);
 })
}
function invalidate(){savedModel=null;oneClass=null;activeIndices=[];showTrainMessage('');revision++;stopPrediction();trained=false;if(head){head.dispose();head=null}$('resultBadge').textContent='Neu trainieren';$('resultTitle').textContent='Was sieht deine KI?';renderBars();updateControls()}
async function loadBase(){
 if(base)return base;
 if(!basePromise)basePromise=(async()=>{try{
  if(!window.tf)throw Error('Die Bildmodell-Bibliothek konnte nicht geladen werden. Seite neu laden.');
  $('modelStatus').textContent='Bildmodell wird geladen …';await tf.ready();
  const full=await tf.loadLayersModel(new URL('../model/model.json',location.href).href,{onProgress:p=>{$('modelStatus').textContent='Bildmodell wird geladen … '+Math.round(p*100)+' %'}});
  const extractor=tf.model({inputs:full.inputs,outputs:full.getLayer('global_average_pooling2d_1').output});
  base={infer(source){return tf.tidy(()=>{const image=source instanceof tf.Tensor?source:tf.browser.fromPixels(source);const normalized=tf.image.resizeBilinear(image.toFloat(),[224,224]).div(127.5).sub(1).expandDims();return extractor.predict(normalized)})}};
  $('modelStatus').textContent='✓ Bildmodell bereit · Lernen und Erkennen laufen lokal';updateCards();return base;
 }catch(e){basePromise=null;$('modelStatus').textContent='Bildmodell nicht verfügbar: '+e.message;throw e}})();
 return basePromise;
}
async function startCamera(){
 if(cameraStarting||training)return;cameraStarting=true;clearInterval(cameraWatchTimer);cameraWatchTimer=null;stopPrediction();stopCapture();updateControls();
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('Kein Kamerazugriff. Öffne die App über ihre HTTPS-Adresse in Safari, Chrome oder Edge.');
  if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}
  let expired=false,timer;const request=navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:front?'user':'environment'},width:{ideal:640},height:{ideal:640}},audio:false});
  request.then(s=>{if(expired)s.getTracks().forEach(t=>t.stop())},()=>{});
  try{stream=await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('Kamera antwortet nicht. Bitte erneut starten.'))},12000)})])}finally{clearTimeout(timer)}
  const video=$('video');video.srcObject=stream;
  let playTimer;try{await Promise.race([video.play(),new Promise((_,reject)=>{playTimer=setTimeout(()=>reject(Error('Kamerabild startet nicht. Bitte erneut versuchen.')),8000)})])}finally{clearTimeout(playTimer)}
  video.classList.toggle('mirror',front);$('cameraEmpty').hidden=true;$('liveBadge').hidden=false;$('camDot').classList.add('on');$('cameraStatus').textContent='Kamera aktiv · mittlerer Bildausschnitt';
  const activeStream=stream;activeStream.getVideoTracks()[0].addEventListener('ended',()=>{if(stream===activeStream)stopCamera()});
  await loadBase();if(!stream)return;lastVideoTime=video.currentTime;lastVideoProgress=performance.now();cameraWatchTimer=setInterval(checkCameraFrame,1000);
 }catch(e){const message=e.name==='NotAllowedError'?'Kamerazugriff verweigert. Bitte erlaube der App den Kamerazugriff in deinem Browser.':e.name==='NotFoundError'?'Keine Kamera gefunden. Öffne die App auf deinem iPad oder einem Gerät mit Kamera.':e.message;toast(message);if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}resetCameraUI()}
 finally{cameraStarting=false;updateCards()}
}
function resetCameraUI(){$('video').srcObject=null;$('cameraEmpty').hidden=false;$('liveBadge').hidden=true;$('camDot').classList.remove('on');$('cameraStatus').textContent='Kamera ist ausgeschaltet'}
function stopCamera(){clearInterval(cameraWatchTimer);cameraWatchTimer=null;stopCapture();stopPrediction();const s=stream;stream=null;if(s)s.getTracks().forEach(t=>t.stop());resetCameraUI();updateCards()}
function checkCameraFrame(){
 if(!stream||cameraStarting||document.hidden)return;const video=$('video'),now=performance.now();
 if(video.currentTime>lastVideoTime+.02){lastVideoTime=video.currentTime;lastVideoProgress=now;return}
 if(now-lastVideoProgress<5000)return;
 if(now-lastCameraRecovery<15000){stopCamera();toast('Das Kamerabild steht. Tippe auf „Kamera starten“, um es erneut zu versuchen.');return}
 lastCameraRecovery=now;clearInterval(cameraWatchTimer);cameraWatchTimer=null;toast('Kamerabild steht. Die Kamera wird neu gestartet.');startCamera();
}
async function features(){
 const video=$('video');if(!stream||video.readyState<2||!video.videoWidth)throw Error('Kamerabild noch nicht bereit.');
 const side=Math.min(video.videoWidth,video.videoHeight);ctx.save();if(front){ctx.translate(224,0);ctx.scale(-1,1)}ctx.drawImage(video,(video.videoWidth-side)/2,(video.videoHeight-side)/2,side,side,0,0,224,224);ctx.restore();
 const tensor=base.infer(canvas,true);try{return Array.from(await tensor.data())}finally{tensor.dispose()}
}
async function startCapture(i,series){
 if(!stream||!base||training||recording||extracting||classes[i].samples.length>=MAX)return;
 if(series&&classes[i].samples.length>=TARGET){toast('Startziel erreicht. Für weitere Ansichten „Aufnehmen“ gedrückt halten.');return}
 invalidate();const token=++captureSerial;recording={i,series,token};$('captureBadge').hidden=false;updateCards();
 let count=0;
 while(recording?.token===token&&stream){
  extracting=true;
  try{const row=await features();if(recording?.token!==token)break;classes[i].samples.push(row);thumbCanvas.getContext('2d').drawImage(canvas,0,0,96,96);classes[i].thumb=thumbCanvas.toDataURL('image/jpeg',0.65);if(!classes[i].images)classes[i].images=Array(classes[i].samples.length-1).fill(null);classes[i].images.push(classes[i].thumb);count++;updateCards();scheduleSave(1200);
   const tips=['Drehe dein Zeichen oder deinen Gegenstand leicht.','Verändere den Abstand zur Kamera.','Probiere einen anderen Hintergrund.','Halte das Zeichen auch an den Bildrand.'];
   $('tipText').textContent=tips[Math.floor(count/10)%tips.length];
   if(classes[i].samples.length>=MAX||series&&classes[i].samples.length>=TARGET){stopCapture();break}
  }catch(e){stopCapture();toast('Aufnahme angehalten: '+e.message);break}
  finally{extracting=false;updateCards()}
  await new Promise(resolve=>setTimeout(resolve,220));
 }
 extracting=false;updateCards();
}
function stopCapture(){const wasRecording=!!recording;recording=null;captureSerial++;$('captureBadge').hidden=true;updateCards();if(wasRecording)saveNow(true)}
async function train(){
 if(restoring||training||recording||extracting||cameraStarting)return;
 const status=CameraLabCore.trainingReadiness(classes);
 if(!status.ready){showTrainMessage(status.active.length?'Noch nicht bereit: '+status.missing.map(c=>c.name+' – noch '+c.missing+' Bilder').join('; ')+'.':'Sammle zuerst mindestens 10 Bilder in einer Klasse. Weitere Klassen sind freiwillig.',true);showPane('train');return}
 showTrainMessage('Das Training wird vorbereitet …');stopPrediction();training=true;trained=false;savedModel=null;activeIndices=status.active.map(c=>c.index);oneClass=null;updateCards();$('trainingProgress').hidden=false;$('epochProgress').value=0;$('epochLabel').textContent='Training wird vorbereitet …';
 let xs,ys;
 try{
  if(!window.tf)throw Error('Die Lernbibliothek fehlt. Bitte lade die Seite neu.');await tf.ready();trainingBackend=tf.getBackend();await tf.setBackend('cpu');await tf.ready();
  if(head){head.dispose();head=null}
  if(activeIndices.length===1){
   oneClass=CameraLabCore.singleProfile(classes[activeIndices[0]].samples);$('epochProgress').value=30;
   savedModel={kind:'single',activeIndices:[...activeIndices]};
  }else{
   showTrainMessage('Training läuft. Bitte diese Seite geöffnet lassen.');
   const rows=[],labels=[];activeIndices.forEach((slot,label)=>classes[slot].samples.forEach(row=>{rows.push(row);labels.push(label)}));
   const dim=rows[0].length;xs=tf.tensor2d(rows);ys=tf.tidy(()=>tf.oneHot(tf.tensor1d(labels,'int32'),activeIndices.length));
   head=tf.sequential();head.add(tf.layers.dense({inputShape:[dim],units:48,activation:'relu',kernelRegularizer:tf.regularizers.l2({l2:0.001})}));head.add(tf.layers.dropout({rate:0.2}));head.add(tf.layers.dense({units:activeIndices.length,activation:'softmax'}));head.compile({optimizer:tf.train.adam(.001),loss:'categoricalCrossentropy',metrics:['accuracy']});
   await head.fit(xs,ys,{epochs:30,batchSize:Math.min(16,rows.length),shuffle:true,yieldEvery:'batch',callbacks:{onEpochEnd:async epoch=>{$('epochProgress').value=epoch+1;$('epochLabel').textContent='Lernrunde '+(epoch+1)+' / 30';await tf.nextFrame()}}});
   await head.save(tf.io.withSaveHandler(async a=>{savedModel={kind:'multi',activeIndices:[...activeIndices],artifacts:{modelTopology:a.modelTopology,weightSpecs:a.weightSpecs,weightData:a.weightData}};return {modelArtifactsInfo:tf.io.getModelArtifactsInfoForJSON(a)}}));
  }
  trained=true;showTrainMessage('✓ Training abgeschlossen. Öffne jetzt die Live-Erkennung.');$('resultBadge').textContent='Bereit zum Testen';$('resultTitle').textContent=activeIndices.length===1?'Ähnlichkeit prüfen':'Teste deine Klassen';await saveNow(true);toast(storageHealthy?'Training abgeschlossen und lokal gesichert.':'Training abgeschlossen. Bitte das Projekt exportieren.');
 }catch(e){if(head){head.dispose();head=null}savedModel=null;oneClass=null;trained=false;showTrainMessage('Training fehlgeschlagen: '+e.message+' · Du kannst es erneut versuchen.',true);$('resultBadge').textContent='Training fehlgeschlagen'}
 finally{xs?.dispose();ys?.dispose();if(trainingBackend&&tf.getBackend()!==trainingBackend){try{await tf.setBackend(trainingBackend);await tf.ready()}catch(e){$('modelStatus').textContent='Kompatibilitätsmodus (CPU) aktiv'}}trainingBackend=null;training=false;$('trainingProgress').hidden=true;updateCards()}
}

async function predictLoop(){
 const myRevision=revision,mySerial=predictSerial;
 while(predicting&&trained&&stream&&myRevision===revision&&mySerial===predictSerial&&!document.hidden){
  try{const row=await features();if(!predicting||myRevision!==revision||mySerial!==predictSerial)break;
   let probs;if(oneClass){probs=CameraLabCore.mapProbabilities([CameraLabCore.singleScore(row,oneClass)],activeIndices)}else{const output=tf.tidy(()=>head.predict(tf.tensor2d([row])));try{probs=CameraLabCore.mapProbabilities(Array.from(await output.data()),activeIndices)}finally{output.dispose()}}
   if(!predicting||myRevision!==revision||mySerial!==predictSerial)break;lastInference=performance.now();renderBars(probs);
   const result=gate.update(probs,confidence,lastInference);const best=probs.indexOf(Math.max(...probs));
   const high=Math.max(...probs);$('resultTitle').textContent=result.index<0?(oneClass?'Noch keine sichere Übereinstimmung':'Ich prüfe …'):'Ich sehe: '+classes[best].name;$('resultBadge').textContent=Math.round(high*100)+' %';$('resultBadge').classList.toggle('recognized',result.index>=0);
   setCommand(result.index<0?'STOPP':classes[result.index].command,result.reason,result.index);
  }catch(e){stopPrediction();toast('Erkennung angehalten: '+e.message);break}
  await new Promise(resolve=>setTimeout(resolve,140));
 }
}
function startPrediction(){if(!trained||!stream||predicting)return;predicting=true;predictSerial++;gate.reset();lastInference=performance.now();updateControls();predictLoop()}
function stopPrediction(){bitTesting=false;predicting=false;predictSerial++;gate.reset();setCommand('STOPP','Erkennung ist ausgeschaltet');updateControls()}
function log(command){lastLogged=command}
function getClassSymbol(slot){return classes[slot]?.symbol||['heart','smile','left','right','check'][slot]||'off'}
function updateConnectionBadge(state){
 const badge=$('bitConnectionBadge');if(!badge)return;
 badge.dataset.state=state||(bitConnecting?'connecting':!bitLink?.connected?'offline':bitReady?'ready':'connecting');
 badge.textContent=badge.dataset.state==='ready'?'● micro:bit ✓':badge.dataset.state==='connecting'?'◌ micro:bit …':'○ micro:bit aus';
 badge.setAttribute('aria-label',badge.dataset.state==='ready'?'micro:bit verbunden – Verbindung öffnen':badge.dataset.state==='connecting'?'micro:bit verbindet – Verbindung öffnen':'micro:bit nicht verbunden – Verbindung öffnen');
}
function setCommand(command,reason,slot=-1){
 const symbol=slot>=0?getClassSymbol(slot):'off';const changed=currentSymbol!==symbol;const previousClass=currentClass;currentCommand=command;currentClass=slot;currentSymbol=symbol;
 $('currentCommand').textContent=slot>=0?classes[slot].name:'—';$('liveAction').textContent=slot>=0?(actionNumbers[symbol]||'—'):'—';
 if(slot<0)$('liveDelivery').textContent='';
 else if(!bitReady||!bitLink?.connected)$('liveDelivery').textContent='Vorschau · micro:bit nicht verbunden';
 else if(!changed&&previousClass!==slot)$('liveDelivery').textContent='✓ bereits angezeigt';
 else if(changed)$('liveDelivery').textContent='Wird gesendet …';
 $('commandReason').textContent=reason;log(command);if(changed&&bitLink?.connected&&bitReady)sendCurrent();
}
async function sendCurrent(){
 if(!bitLink?.connected||!bitReady)return;if(sending){pendingSymbol=true;return}sending=true;
 const link=bitLink;
 try{do{pendingSymbol=false;const value=currentSymbol.toUpperCase();if(currentClass>=0)$('liveDelivery').textContent='Wird gesendet …';await link.send(value);if(link===bitLink){$('linkLiveStatus').textContent='micro:bit: Zahl '+actionNumbers[value.toLowerCase()]+' bestätigt.';if(value===currentSymbol.toUpperCase()&&currentClass>=0)$('liveDelivery').textContent='✓ micro:bit bestätigt'}}while(pendingSymbol&&link===bitLink&&link.connected)}
 catch(e){if(link===bitLink){
  $('linkLiveStatus').textContent='micro:bit: Antwort ausgeblieben. Verbindung wird geprüft …';
  if(currentClass>=0)$('liveDelivery').textContent='Antwort wird geprüft';
  let reachable=false;
  if(link.connected){try{await link.probe();reachable=true}catch(probeError){}}
  if(link!==bitLink)return;
  if(reachable){$('linkLiveStatus').textContent='micro:bit: Verbindung steht noch. Letzter Befehl wurde nicht bestätigt.';if(currentClass>=0)$('liveDelivery').textContent='Nicht bestätigt · Erkennung erneut zeigen'}
  else{await link.disconnect();bitLink=null;bitReady=false;$('bitStatus').textContent='micro:bit antwortet nicht mehr. USB-Kabel und COM-Port prüfen, dann erneut verbinden.';$('linkLiveStatus').textContent='micro:bit: Keine Antwort auf PING. Bitte erneut verbinden.';if(currentClass>=0)$('liveDelivery').textContent='micro:bit getrennt';updateBitUI()}
 }}
 finally{sending=false}
}
function onBitDisconnect(error){const link=bitLink;bitLink=null;bitReady=false;const detail=link instanceof MicrobitTransport.USBLink?'USB getrennt: '+(error?.message||'Kabel und COM-Port prüfen.'):'Verbindung getrennt.';$('bitStatus').textContent=detail;$('linkLiveStatus').textContent='micro:bit: '+detail+' Die KI erkennt weiter.';if(currentClass>=0)$('liveDelivery').textContent='Vorschau · micro:bit getrennt';updateBitUI();if(link)void link.disconnect()}
async function disconnectBit(){if(bitLink)await bitLink.disconnect();bitLink=null;bitReady=false;$('bitStatus').textContent='Noch nicht verbunden.';if(currentClass>=0)$('liveDelivery').textContent='Vorschau · micro:bit nicht verbunden';updateBitUI()}
async function connectBit(){
 if(bitConnecting||bitLink?.connected)return;stopPrediction();bitConnecting=true;$('bitError').hidden=true;$('bitStatus').textContent='Warte auf den micro:bit und seine Antwort …';updateBitUI();
 const link=bitMode==='native'?new MicrobitTransport.NativeLink(window.webkit.messageHandlers.microbit,onBitDisconnect):bitMode==='usb'?new MicrobitTransport.USBLink(navigator.serial,onBitDisconnect):new MicrobitTransport.BLELink(navigator.bluetooth,onBitDisconnect);
 bitLink=link;
 try{const name=await link.connect();bitReady=true;$('bitStatus').textContent='✓ '+name+' antwortet auf PING. Verbindung bereit.';$('testStatus').textContent='Jetzt „2 senden und Antwort prüfen“ tippen.';$('linkLiveStatus').textContent='micro:bit: Verbindung bereit.'}
 catch(e){bitReady=false;$('bitStatus').textContent='Noch nicht verbunden.';const cancelled=e.name==='NotFoundError'||/no port selected|user cancelled|user canceled/i.test(e.message||'');$('bitError').textContent=cancelled?bitMode==='usb'?'Auswahl abgebrochen. Wähle den micro:bit-Anschluss und versuche es erneut.':'Auswahl abgebrochen. Prüfe Taste A am micro:bit und versuche es erneut.':e.message||'Verbindung fehlgeschlagen. Startprogramm prüfen.';$('bitError').hidden=false;await link.disconnect();if(bitLink===link)bitLink=null}
 finally{bitConnecting=false;updateBitUI()}
}
function projectFilename(){return CameraLabCore.projectFilename(projectName)}
async function exportProject(){
 const project={format:'microbit-kameralabor-v1',base:'mobilenet-v1-050',name:projectName,classes,created:new Date().toISOString()};const name=projectFilename();
 if(window.showSaveFilePicker){
  let handle;try{handle=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Teachable-Labor-Projekt',accept:{'application/json':['.json']}}]})}catch(e){if(e.name==='AbortError')return}
  if(handle){try{const chosenName=CameraLabCore.projectNameForFile(handle.name,projectName);project.name=chosenName;const writable=await handle.createWritable();await writable.write(new Blob([JSON.stringify(project)],{type:'application/json'}));await writable.close();if(chosenName!==projectName){projectName=chosenName;$('projectName').value=projectName;await saveNow(true);$('projectFileName').textContent=projectFilename()}toast('Projektdatei '+handle.name+' im gewählten Ordner gespeichert.');return}catch(e){toast('Projektdatei konnte nicht gespeichert werden: '+e.message);return}}
 }
 const blob=new Blob([JSON.stringify(project)],{type:'application/json'});
 const file=new File([blob],name,{type:'application/json'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Teachable-Labor-Projekt sichern'});toast('Projektdatei über die Teilen-Auswahl übergeben.');return}catch(e){if(e.name==='AbortError')return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);toast('Projektdatei heruntergeladen. Suche in „Downloads“ nach '+name+'.');
}
async function importProject(file){
 if(!file)return;try{if(file.size>50000000)throw Error('Datei ist zu groß (maximal 50 MB).');const raw=JSON.parse(await file.text());const imported=CameraLabCore.validateProject(raw);if(imported.some(c=>c.samples.some(row=>row.length!==512)))throw Error('Unpassende Lernmerkmale.');
 if(classes.some(c=>c.samples.length)&&!confirm('Projektdatei „'+file.name+'“ öffnen? Das aktuelle Projekt „'+projectName+'“ wird im Browser ersetzt. Sichere es zuvor als .json, falls du es behalten möchtest.'))return;
 stopCapture();invalidate();undoDeletion=null;$('undoBar').hidden=true;projectName=CameraLabCore.projectNameForFile(file.name,raw.name);$('projectName').value=projectName;classes=imported;selectedClass=Math.max(0,classes.findIndex(c=>c.samples.length));renderCards();showPane('collect');await saveNow();$('newProjectDialog').close();
 toast('Projektdatei „'+file.name+'“ geladen. Bei Bedarf erneut trainieren.');
 }catch(e){toast('Import nicht möglich: '+e.message)}finally{$('loadFile').value=''}
}
$('cameraBtn').onclick=startCamera;$('switchCam').onclick=()=>{front=!front;startCamera()};$('restartCam').onclick=startCamera;$('stopCam').onclick=stopCamera;
$('stepCollect').onclick=()=>showPane('collect');$('goTrain').onclick=()=>showPane('train');$('goLive').onclick=()=>showPane('live');$('stepLive').onclick=()=>showPane('live');
$('stepTrain').onclick=()=>showPane('train');$('stepConnect').onclick=()=>showPane('connect');
$('bitConnectionBadge').onclick=()=>{showBitView('connect');showPane('connect')};
$('trainBtn').onclick=train;$('predictBtn').onclick=()=>predicting?stopPrediction():startPrediction();
$('threshold').oninput=e=>{confidence=Number(e.target.value)/100;$('thresholdValue').textContent=e.target.value+' %';scheduleSave();gate.reset();setCommand('STOPP','Neue Erkennungsschwelle · Zeichen erneut zeigen')};
$('emergencyBtn').onclick=()=>{stopCapture();stopPrediction();toast('Erkennung gestoppt. Zum Fortfahren erneut starten.')};
$('saveBtn').onclick=exportProject;$('loadBtn').onclick=()=>$('loadFile').click();$('loadFile').onchange=e=>importProject(e.target.files[0]);
$('quickSaveBtn').onclick=exportProject;
$('helpBtn').onclick=()=>$('helpDialog').showModal();
for(const d of document.querySelectorAll('dialog')){d.querySelectorAll('.close,.close-action').forEach(b=>b.onclick=()=>d.close());d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}})}
setInterval(()=>{if(predicting&&performance.now()-lastInference>1200){stopPrediction();toast('Erkennung zu langsam. STOPP gesetzt; erneut starten.')}},400);
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopCapture();stopPrediction()}else if(stream){lastVideoTime=$('video').currentTime;lastVideoProgress=performance.now();$('video').play().catch(()=>{})}});
window.addEventListener('pagehide',()=>{stopCapture();stopPrediction();saveNow();disconnectBit()});
window.addEventListener('orientationchange',()=>saveNow());
window.addEventListener('beforeunload',e=>{if(!storageHealthy||savePending){e.preventDefault();e.returnValue=''}});
function updateClassTabs(){
 const nav=$('classTabs');if(!nav.children.length)classes.forEach((c,i)=>{const b=document.createElement('button');b.innerHTML='<b></b><small></small><span></span>';b.onclick=()=>{selectedClass=i;classes.forEach((c,j)=>$('class'+j).hidden=j!==i);updateClassTabs();scheduleSave()};nav.append(b)});
 classes.forEach((c,i)=>{const b=nav.children[i];b.querySelector('b').textContent=i+1;b.querySelector('small').textContent=c.name||'Klasse '+(i+1);b.querySelector('span').textContent=c.samples.length?imageCount(c.samples.length):'Leer';b.setAttribute('aria-label','Klasse '+(i+1)+': '+(c.name||'ohne Namen'));b.setAttribute('aria-pressed',String(i===selectedClass));b.classList.toggle('selected',i===selectedClass);b.disabled=restoring||!!recording||training});
}
function showPane(pane,persist=true){
 const ids={collect:'collectPane',train:'trainingSection',live:'liveSection',connect:'connectionSection'},buttons={collect:'stepCollect',train:'stepTrain',live:'stepLive',connect:'stepConnect'};
 if(!ids[pane])return;currentPane=pane;Object.entries(ids).forEach(([key,id])=>{$(id).hidden=key!==pane;$(buttons[key]).classList.toggle('active',key===pane);$(buttons[key]).setAttribute('aria-pressed',String(key===pane))});if(persist)scheduleSave();if(pane==='connect')renderBitMappings();
}
function scheduleSave(delay=120){if(restoring)return;projectDirty=true;savePending=true;$('saveStatus').textContent='Wird lokal gespeichert …';clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,delay)}
function saveNow(changed=false){
 if(restoring)return Promise.resolve();if(changed===true)projectDirty=true;if(!projectDirty)return saveChain;projectDirty=false;clearTimeout(saveTimer);savePending=true;
 $('saveStatus').textContent='Wird lokal gespeichert …';
 const snapshot=makeSnapshot();
 saveChain=saveChain.catch(()=>{}).then(async()=>{try{await LabStorage.write(snapshot,'project',storageVersion);storageVersion=snapshot.savedAt;storageHealthy=true;$('saveStatus').textContent='✓ Auf diesem Gerät gespeichert';$('saveStatus').classList.remove('error')}catch(e){storageHealthy=false;$('saveStatus').textContent=e.name==='ProjectConflict'?'Anderer Tab hat Änderungen – bitte exportieren und neu laden':'Speichern nicht möglich – bitte exportieren';$('saveStatus').classList.add('error')}finally{savePending=false}});return saveChain;
}
async function restoreProject(override){
 try{
  const state=override||await LabStorage.read();if(!override)storageVersion=state?.savedAt??null;
  if(state){const restored=CameraLabCore.validateProject(state.project);if(restored.some(c=>c.samples.some(row=>row.length!==512)))throw Error('Unpassendes lokales Projekt');classes=restored;projectName=typeof state.project.name==='string'?state.project.name.slice(0,60):'Mein Experiment';$('projectName').value=projectName;selectedClass=Number.isInteger(state.selectedClass)&&state.selectedClass>=0&&state.selectedClass<5?state.selectedClass:0;confidence=Math.max(.6,Math.min(.99,Number(state.confidence)||.85));$('threshold').value=Math.round(confidence*100);$('thresholdValue').textContent=Math.round(confidence*100)+' %';
   const status=CameraLabCore.trainingReadiness(classes);const indices=status.active.map(c=>c.index);
   if(state.model&&status.ready&&JSON.stringify(indices)===JSON.stringify(state.model.activeIndices)){
    activeIndices=indices;
    try{if(state.model.kind==='single'&&indices.length===1){oneClass=CameraLabCore.singleProfile(classes[indices[0]].samples);trained=true}else if(state.model.kind==='multi'&&indices.length>1){await tf.ready();head=await tf.loadLayersModel(tf.io.fromMemory(state.model.artifacts));trained=true}if(trained)savedModel=state.model}catch(e){trained=false;savedModel=null}
   }
   currentPane=['collect','train','live','connect'].includes(state.currentPane)?state.currentPane:'collect';
   $('saveStatus').textContent='✓ Projekt wiederhergestellt';if(trained){$('resultBadge').textContent='Modell wiederhergestellt';showTrainMessage('✓ Dein trainiertes Modell ist wieder bereit.')}else if(classes.some(c=>c.samples.length)){showTrainMessage('Deine Bilder sind wiederhergestellt. Bei Bedarf trainieren.');}
  }else $('saveStatus').textContent='Automatisches Speichern aktiv';
 }catch(e){storageHealthy=false;$('saveStatus').textContent='Lokales Speichern nicht verfügbar – bitte exportieren';$('saveStatus').classList.add('error')}
 finally{restoring=false;renderCards();showPane(currentPane,false)}
}
function makeSnapshot(){return {project:{format:'microbit-kameralabor-v1',base:'mobilenet-v1-050',name:projectName,classes:structuredClone(classes)},model:savedModel,selectedClass,currentPane,confidence,savedAt:Date.now()}}
function openGallery(slot){if(training||recording||extracting)return;stopPrediction();gallerySlot=slot;gallerySelection.clear();renderGallery();$('galleryDialog').showModal()}
function renderGallery(){
 const c=classes[gallerySlot];$('galleryUndo').disabled=!undoDeletion||undoDeletion.slot!==gallerySlot;$('galleryTitle').textContent=c.name+' · '+imageCount(c.samples.length);const grid=$('galleryGrid');grid.replaceChildren();
 $('galleryHint').textContent=c.samples.length?(c.images?.some(im=>!im)?'Einige ältere Aufnahmen haben kein Vorschaubild. Die Lernmerkmale lassen sich trotzdem einzeln löschen.':'Tippe auf Bilder zum Markieren oder lösche ein Bild direkt mit ×.'):'Diese Klasse ist jetzt leer. Du kannst neue Bilder sammeln.';
 c.samples.forEach((_,i)=>{const item=document.createElement('div');item.className='gallery-item';const choose=document.createElement('button');choose.className='gallery-choice';choose.setAttribute('aria-label','Bild '+(i+1)+' markieren');choose.setAttribute('aria-pressed',String(gallerySelection.has(i)));choose.classList.toggle('selected',gallerySelection.has(i));const im=c.images?.[i];if(im){const image=new Image();image.src=im;image.alt='Lernbild '+(i+1);image.loading='lazy';choose.append(image)}else{const missing=document.createElement('span');missing.textContent='Vorschau fehlt';choose.append(missing)}const label=document.createElement('small');label.textContent='#'+(i+1);choose.append(label);choose.onclick=()=>{gallerySelection.has(i)?gallerySelection.delete(i):gallerySelection.add(i);renderGallery()};const remove=document.createElement('button');remove.className='gallery-remove';remove.textContent='×';remove.setAttribute('aria-label','Bild '+(i+1)+' löschen');remove.onclick=()=>deleteImages(gallerySlot,[i]);item.append(choose,remove);grid.append(item)});
 $('galleryCount').textContent=gallerySelection.size+' markiert';$('deleteSelectedImages').disabled=!gallerySelection.size;$('selectAllImages').disabled=!c.samples.length;$('selectAllImages').textContent=gallerySelection.size===c.samples.length&&c.samples.length?'Auswahl aufheben':'Alle markieren';
}
function deleteImages(slot,indices){
 if(training||recording||extracting||restoring)return;const c=classes[slot];const backup={slot,samples:structuredClone(c.samples),images:structuredClone(c.images||Array(c.samples.length).fill(null)),thumb:c.thumb};
 const n=CameraLabCore.removeSamples(c,indices);if(!n)return;undoDeletion=backup;invalidate();updateCards();gallerySelection.clear();if($('galleryDialog').open)renderGallery();$('undoLabel').textContent=n+(n===1?' Bild gelöscht.':' Bilder gelöscht.');$('undoBar').hidden=false;saveNow(true);
}
$('undoDelete').onclick=()=>{if(!undoDeletion||training||recording||extracting)return;const b=undoDeletion;classes[b.slot].samples=b.samples;classes[b.slot].images=b.images;classes[b.slot].thumb=b.thumb;undoDeletion=null;invalidate();updateCards();if($('galleryDialog').open)renderGallery();$('undoBar').hidden=true;saveNow(true);toast('Bilder wiederhergestellt. Bei Bedarf erneut trainieren.')};
$('galleryUndo').onclick=()=>$('undoDelete').click();
$('undoDismiss').onclick=()=>$('undoBar').hidden=true;
$('selectAllImages').onclick=()=>{const c=classes[gallerySlot];gallerySelection=gallerySelection.size===c.samples.length?new Set():new Set(c.samples.map((_,i)=>i));renderGallery()};
$('deleteSelectedImages').onclick=()=>deleteImages(gallerySlot,[...gallerySelection]);
$('projectName').oninput=e=>{projectName=e.target.value;scheduleSave()};$('projectName').onblur=e=>{projectName=e.target.value.trim()||'Mein Experiment';e.target.value=projectName;scheduleSave()};
$('newProjectBtn').onclick=async()=>{if(training||restoring||extracting)return;stopCapture();stopPrediction();$('projectDialogStatus').textContent='';$('projectFileName').textContent=projectFilename();$('newProjectDialog').showModal();$('restorePrevious').disabled=!(await LabStorage.read('previous').catch(()=>null))};
$('startNewProject').onclick=async()=>{
 if(training||restoring||extracting)return;$('startNewProject').disabled=true;
 try{stopCapture();stopPrediction();await saveNow();await LabStorage.write(makeSnapshot(),'previous');invalidate();classes=Array.from({length:5},(_,i)=>({name:'Klasse '+(i+1),command:'STOPP',samples:[],images:[],thumb:''}));projectName=$('newProjectName').value.trim()||'Neues Experiment';$('projectName').value=projectName;selectedClass=0;undoDeletion=null;$('undoBar').hidden=true;renderCards();showPane('collect');await saveNow();$('newProjectDialog').close();toast('Neues Projekt bereit. Das vorige kannst du über „Neues Projekt“ zurückholen.')}
 catch(e){$('projectDialogStatus').textContent='Die lokale Sicherung ist nicht möglich. Exportiere zuerst dein jetziges Projekt; es wurde noch nichts verworfen.'}
 finally{$('startNewProject').disabled=false}
};
$('restorePrevious').onclick=async()=>{
 if(training||restoring||extracting)return;const previous=await LabStorage.read('previous').catch(()=>null);if(!previous){$('projectDialogStatus').textContent='Noch kein vorheriges Projekt vorhanden.';return}stopCapture();stopPrediction();const current=makeSnapshot();restoring=true;invalidate();undoDeletion=null;$('undoBar').hidden=true;await restoreProject(previous);await LabStorage.write(current,'previous');await saveNow(true);$('newProjectDialog').close();toast('Vorheriges Projekt wiederhergestellt.');
};
const patterns=MicrobitTransport.symbols;
const numberPatterns={number1:[4,12,4,4,14],number2:[14,17,2,4,31],number3:[30,1,6,1,30],number4:[18,18,31,2,2],number5:[31,16,30,1,30],number6:[15,16,30,17,14],number7:[31,2,4,8,8],number8:[14,17,14,17,14],number9:[14,17,15,1,30],number10:[23,21,21,21,23]};
function renderLED(element,pattern){if(!element)return;const rows=numberPatterns[pattern]||patterns[pattern]||patterns.square;if(!element.children.length)for(let i=0;i<25;i++)element.append(document.createElement('i'));[...element.children].forEach((led,i)=>led.classList.toggle('lit',!!(rows[Math.floor(i/5)]&(1<<(4-i%5)))));element.dataset.pattern=pattern}
function renderNumberLED(element,symbol){renderLED(element,'number'+(actionNumbers[symbol]||'1'))}
function updateBitUI(){
 const connected=!!bitLink?.connected;$('connectBtn').disabled=bitConnecting||connected;$('connectBtn').textContent=bitConnecting?'Verbinde …':bitMode==='usb'?'micro:bit über USB verbinden':bitMode==='native'?'micro:bit in iPad-App verbinden':'micro:bit über Bluetooth verbinden';$('disconnectBtn').hidden=!connected;$('testLedBtn').disabled=!connected||!bitReady||bitTesting;$('testLedBtn').textContent=bitTesting?'Warte auf Antwort …':'2 senden und Antwort prüfen';$('bitGoLive').disabled=!trained||training;$('bitGoLive2').disabled=!trained||training;
 updateConnectionBadge();
 $('usbTab').hidden=bitMode==='native';$('bleTab').hidden=bitMode==='native';$('usbTab').classList.toggle('active',bitMode==='usb');$('bleTab').classList.toggle('active',bitMode==='ble');$('usbTab').setAttribute('aria-pressed',String(bitMode==='usb'));$('bleTab').setAttribute('aria-pressed',String(bitMode==='ble'));
 $('modeHint').textContent=bitMode==='native'?'iPad-App: Kamera-KI und Bluetooth laufen zusammen. Starte zuerst das Teachable-Labor-Startprogramm auf dem micro:bit.':bitMode==='usb'?'Windows: USB-Datenkabel, Chrome oder Edge. Wähle im Fenster den seriellen micro:bit-Anschluss.':'iPad: Bluefy öffnen. Vor dem Verbinden Taste A drücken: zwei LEDs = richtiges Programm. Balken = Kopplungsmodus; einmal Reset drücken.';
 if(bitMode==='native'){$('bitStatus').title='Die iPad-App stellt die Bluetooth-Verbindung her.';document.querySelector('.bit-hint').textContent='Die iPad-App nutzt die Kamera für Training und Live-Erkennung und sendet Befehle direkt über Bluetooth.';document.querySelector('.teacher-steps>div:nth-child(3) p').textContent='iPad-App: micro:bit mit Strom versorgen, Bluetooth einschalten und im Teachable Labor auf Verbinden tippen.'}
 $('connectInstruction').textContent=bitMode==='native'?'Bluetooth einschalten und den micro:bit im Auswahlfenster der App wählen.':bitMode==='usb'?'USB-Datenkabel einstecken und den seriellen micro:bit-Anschluss auswählen.':'Bluetooth einschalten, diese Seite in Bluefy öffnen und den BBC micro:bit auswählen. Nicht A+B+Reset oder dreimal Reset drücken.';
}
function showBitView(view){bitView=view;document.querySelector('.bit-connect-view').hidden=view!=='connect';$('bitActionsView').hidden=view!=='actions';renderBitMappings();updateBitUI()}
const symbolLabels={heart:'♥ Herz',smile:'☺ Lächeln',left:'← Pfeil links',right:'→ Pfeil rechts',up:'↑ Pfeil oben',down:'↓ Pfeil unten',check:'✓ Häkchen',cross:'× Kreuz',square:'□ Quadrat',off:'○ LEDs aus'};
const actionNumbers=Object.fromEntries(Object.entries(MicrobitTransport.COMMAND_CODES).map(([name,number])=>[name.toLowerCase(),number]));
function setClassSymbol(slot,symbol){
 const c=classes[slot];if(!c||!Object.hasOwn(actionNumbers,symbol))return;
 c.symbol=symbol;const card=$('class'+slot);
 if(card){card.querySelector('.class-symbol').value=symbol;renderNumberLED(card.querySelector('.class-action-preview'),symbol)}
 renderBitMappings();scheduleSave();
 if(currentClass===slot){currentSymbol=symbol;$('liveAction').textContent=actionNumbers[symbol];sendCurrent()}
}
function renderBitMappings(){
 const container=$('bitMappings');container.replaceChildren();const occupied=classes.map((c,i)=>({c,i})).filter(({c})=>c.samples.length);
 if(!occupied.length){const p=document.createElement('p');p.className='mapping-empty';p.textContent='Wähle die micro:bit-Aktion schon beim Sammeln direkt bei deiner Klasse. Nach der ersten Aufnahme erscheint sie auch hier.';container.append(p);return}
 occupied.forEach(({c,i})=>{const row=document.createElement('div');row.className='symbol-row';const matrix=document.createElement('div');matrix.className='led-matrix symbol-mini';matrix.setAttribute('aria-hidden','true');renderNumberLED(matrix,getClassSymbol(i));const label=document.createElement('label');const name=document.createElement('span');name.textContent=c.name;const select=document.createElement('select');select.setAttribute('aria-label','Zahl für '+c.name);for(const [value,number] of Object.entries(actionNumbers)){const option=document.createElement('option');option.value=value;option.textContent=number;option.setAttribute('aria-label',number+' – '+symbolLabels[value]);select.append(option)}select.value=getClassSymbol(i);select.onchange=()=>setClassSymbol(i,select.value);label.append(name,select);row.append(matrix,label);container.append(row)});
}
function openTeacher(){stopPrediction();$('setupDialog').showModal()}
$('teacherBtn').onclick=openTeacher;$('teacherQuick').onclick=openTeacher;
$('usbTab').onclick=async()=>{if(bitMode==='usb')return;await disconnectBit();bitMode='usb';$('bitError').hidden=true;updateBitUI()};
$('bleTab').onclick=async()=>{if(bitMode==='ble')return;await disconnectBit();bitMode='ble';$('bitError').hidden=true;updateBitUI()};
$('connectBtn').onclick=connectBit;$('disconnectBtn').onclick=disconnectBit;
$('bitActionsTab').onclick=()=>showBitView('actions');$('bitBack').onclick=()=>showBitView('connect');$('bitGoLive').onclick=()=>showPane('live');$('bitGoLive2').onclick=()=>showPane('live');
$('testLedBtn').onclick=async()=>{if(!bitLink?.connected||bitTesting)return;bitTesting=true;$('testStatus').textContent='Zahl 2 unterwegs …';updateBitUI();try{await bitLink.send('HEART');$('testStatus').textContent='✓ micro:bit meldet OK:2. Auf den LEDs erscheint das Muster mit zwei Punkten.'}catch(e){$('testStatus').textContent='Keine Antwort auf die Zahl 2. USB-Kabel und COM-Port prüfen, dann erneut verbinden.';await disconnectBit()}finally{bitTesting=false;updateBitUI()}};
for(const matrix of document.querySelectorAll('.led-matrix'))renderLED(matrix,matrix.dataset.pattern||'heart');
renderCards();showBitView('connect');restoreProject();

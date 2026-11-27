// The picture view reuses the lab's existing controls and project storage.
(() => {
  const steps = [
    ['stepCollect','Bilder sammeln','#ffda69','<path d="M3 8h4l2-3h6l2 3h4v12H3z"/><circle cx="12" cy="13" r="3.5"/>'],
    ['stepTrain','KI trainieren','#cdbbfa','<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 7V3m-3 13h6"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>'],
    ['stepLive','Ausprobieren','#ffb8a4','<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'],
    ['stepMap','Zahlen zuordnen','#99e1dd','<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><path d="M9 6h11m-3-3 3 3-3 3M9 18h11m-3-3 3 3-3 3"/>'],
    ['stepConnect','micro:bit verbinden','#f5bad8','<path d="M8 3v5m8-5v5M6 8h12v3a6 6 0 0 1-12 0zm6 9v4"/>']
  ];
  const icon = drawing => '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">'+drawing+'</svg>';
  const homeIcon = icon('<path d="m3 11 9-8 9 8m-16-1v11h14V10m-10 11v-7h6v7"/>');
  const root = document.documentElement;
  const requestFull = root.requestFullscreen || root.webkitRequestFullscreen;
  const exitFull = document.exitFullscreen || document.webkitExitFullscreen;
  const fullAllowed = document.fullscreenEnabled ?? document.webkitFullscreenEnabled;
  if (requestFull && exitFull && fullAllowed !== false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plain fullscreen-button';
    const isFull = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    function updateFullscreen() {
      const active = isFull();
      const label = active ? 'Vollbild beenden' : 'Vollbild';
      const corners = active ? 'M9 3v6H3m18 0h-6V3M3 15h6v6m6 0v-6h6' : 'M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6';
      button.innerHTML = icon('<path d="'+corners+'"/>')+'<span>'+label+'</span>';
      button.title = label;
      button.setAttribute('aria-label',label);
    }
    button.onclick = async () => {
      try {
        if (isFull()) await exitFull.call(document);
        else await requestFull.call(root);
      } catch {
        toast('Der Browser erlaubt diesen Vollbildwechsel gerade nicht.');
      }
      updateFullscreen();
    };
    document.querySelector('.header-actions').append(button);
    document.addEventListener('fullscreenchange',updateFullscreen);
    document.addEventListener('webkitfullscreenchange',updateFullscreen);
    updateFullscreen();
  }
  const main = document.querySelector('main');
  const home = document.createElement('section');
  home.className = 'picture-home';
  home.innerHTML = '<h1 tabindex="-1">Deine Schritte</h1><div class="picture-tiles"></div>';
  main.prepend(home);
  const brand = document.querySelector('.brand');
  brand.querySelector('.brand-mark').innerHTML = homeIcon;
  brand.addEventListener('click', event => {
    event.preventDefault();
    if (stream || predicting || recording) stopCamera();
    root.classList.add('picture-start');
    home.querySelector('h1').focus();
  });
  function setColor() {
    const active = steps.find(([id]) => document.getElementById(id).classList.contains('active'));
    if (active) {
      root.style.setProperty('--picture-color',active[2]);
      root.classList.toggle('picture-collect',active[0]==='stepCollect');
    }
  }
  for (const [index,[id,label,color,drawing]] of steps.entries()) {
    const tab = document.getElementById(id);
    tab.style.setProperty('--tile',color);
    tab.querySelector('.step-icon').innerHTML = icon(drawing);
    tab.lastElementChild.textContent = label;
    const tile = document.createElement('button');
    tile.className = 'picture-tile';
    tile.style.setProperty('--tile',color);
    tile.innerHTML = '<small>Schritt '+(index+1)+'</small>'+icon(drawing)+'<span>'+label+'</span>';
    tile.onclick = () => {
      root.classList.remove('picture-start');
      tab.click();
      tab.focus();
    };
    home.querySelector('.picture-tiles').append(tile);
  }
  new MutationObserver(setColor).observe(document.querySelector('.steps'),{attributes:true,attributeFilter:['aria-pressed'],subtree:true});
  setColor();
  function fold(node,label) {
    if (!node) return;
    const details = document.createElement('details');
    details.className = 'picture-tip';
    const summary = document.createElement('summary');
    summary.textContent = label;
    node.before(details);
    details.append(summary,node);
  }
  for (const selector of ['.tip','.training-meta','.mapping-intro','.microbit-visual-copy','.bit-hint']) {
    fold(document.querySelector(selector),'💡 Tipp');
  }
  const cards = document.getElementById('classCards');
  function simplifyCards() {
    for (const card of cards.children) {
      if (card.querySelector('.picture-photos')) continue;
      const details = document.createElement('details');
      details.className = 'picture-tip picture-photos';
      const summary = document.createElement('summary');
      summary.textContent = '🖼 Meine Bilder';
      details.append(summary,card.querySelector('.photo-review'),card.querySelector('.diversity'),card.querySelector('.clear'));
      const undo = document.createElement('button');
      undo.type = 'button';
      undo.className = 'plain picture-undo';
      undo.textContent = 'Letzte Löschung rückgängig';
      undo.onclick = () => document.getElementById('undoDelete').click();
      undo.hidden = !undoDeletion || card.id !== 'class'+undoDeletion.slot;
      details.append(undo);
      card.append(details);
    }
  }
  new MutationObserver(simplifyCards).observe(cards,{childList:true});
  simplifyCards();
  document.querySelector('.class-name-hint').textContent = 'Sammle 10 Bilder pro Klasse.';
  fold(document.getElementById('removeClassBtn'),'Klassen verwalten');
  document.getElementById('goTrain').textContent = 'Weiter →';
  document.querySelector('.camera-empty h3').textContent = 'Kamera bereit?';
  document.getElementById('goLive').textContent = 'Ausprobieren →';
  document.getElementById('trainBtn').textContent = '🤖 KI trainieren';
  document.getElementById('cameraBtn').textContent = '📷 Kamera starten';
})();

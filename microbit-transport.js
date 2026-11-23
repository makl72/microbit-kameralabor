'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.MicrobitTransport=api})(typeof window==='undefined'?globalThis:window,function(){
 const SERVICE='6e400001-b5a3-f393-e0a9-e50e24dcca9e',TX='6e400002-b5a3-f393-e0a9-e50e24dcca9e',RX='6e400003-b5a3-f393-e0a9-e50e24dcca9e';
 const symbols={off:[0,0,0,0,0],heart:[10,31,31,14,4],giraffe:[24,8,8,14,10],smile:[0,10,0,17,14],left:[4,8,31,8,4],right:[4,2,31,2,4],up:[4,14,21,4,4],down:[4,4,21,14,4],check:[0,1,2,20,8],cross:[17,10,4,10,17],square:[31,17,17,17,31]};
 const COMMAND_CODES=Object.freeze({OFF:'1',HEART:'2',SMILE:'3',LEFT:'4',RIGHT:'5',UP:'6',CHECK:'7',CROSS:'8',SQUARE:'9',DOWN:'10'});
 const encoder=new TextEncoder();
 class Link{
  constructor(onDisconnect=()=>{},timeout=3500){this.onDisconnect=onDisconnect;this.timeout=timeout;this.connected=false;this.pending=null;this.chain=Promise.resolve();this.buffer='';this.decoder=new TextDecoder();this.closing=false}
  async probe(){try{await this.send('PING')}catch(e){await new Promise(resolve=>setTimeout(resolve,350));await this.send('PING')}}
  receive(bytes){this.buffer+=this.decoder.decode(bytes,{stream:true});if(this.buffer.length>512)this.buffer=this.buffer.slice(-128);let index;while((index=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,index).replace(/\r/g,'').trim();this.buffer=this.buffer.slice(index+1);if(this.pending&&line===this.pending.expected){this.pending.resolve(line);this.pending=null}}}
  fail(error){if(this.pending){this.pending.reject(error);this.pending=null}if(this.connected&&!this.closing){this.connected=false;this.onDisconnect(error)}}
  send(command){if(!this.connected)return Promise.reject(Error('Nicht verbunden'));if(command!=='PING'&&!Object.hasOwn(COMMAND_CODES,command))return Promise.reject(Error('Unbekannter Befehl'));
   const task=async()=>{if(!this.connected)throw Error('Verbindung getrennt');const wireCommand=command==='PING'?'PING':COMMAND_CODES[command];const expected=command==='PING'?'PONG':'OK:'+wireCommand;let timer;const response=new Promise((resolve,reject)=>{this.pending={expected,resolve,reject};timer=setTimeout(()=>{if(this.pending?.expected===expected){this.pending=null;reject(Error('Der micro:bit antwortet nicht. Schülerprogramm und Verbindung prüfen.'))}},this.timeout)});
    try{await this.write(encoder.encode(wireCommand+'\n'));return await response}catch(e){if(this.pending?.expected===expected){this.pending=null}response.catch(()=>{});throw e}finally{clearTimeout(timer)}};
   const promise=this.chain.then(task);this.chain=promise.catch(()=>{});return promise;
  }
 }
 class USBLink extends Link{
  constructor(serial,onDisconnect,timeout){super(onDisconnect,timeout);this.serial=serial;this.port=null;this.reader=null}
  async connect(){if(!this.serial?.requestPort)throw Error('USB aus Webseiten braucht Chrome oder Edge auf Windows.');this.port=await this.serial.requestPort();try{await this.port.open({baudRate:115200});if(!this.port.readable||!this.port.writable)throw Error('Kein serieller USB-Anschluss. Wähle den micro:bit-Anschluss.');this.connected=true;this.closing=false;this.pump=this.readLoop();await this.probe();return 'USB'}catch(e){await this.disconnect();throw e}}
  async readLoop(){
   let error=Error('USB-Verbindung unterbrochen. Kabel, Stromversorgung und COM-Port prüfen.');
   try{
    while(this.connected&&!this.closing&&this.port){
     if(!this.port.readable){
      let recovered=false;
      for(let attempt=0;attempt<12&&this.connected&&!this.closing;attempt++){
       await new Promise(resolve=>setTimeout(resolve,100));
       if(this.port?.readable){recovered=true;break}
      }
      if(!recovered)break;
     }

     const reader=this.port.readable.getReader();this.reader=reader;
     let streamEnded=false;
     try{
      while(this.connected&&!this.closing){
       const {value,done}=await reader.read();
       if(done){streamEnded=true;break}
       if(value)this.receive(value)
      }
     }catch(e){
      error=e;
      streamEnded=true;
     }finally{
      try{reader.releaseLock()}catch(e){}
      if(this.reader===reader)this.reader=null
     }

     if(!this.connected||this.closing)break;
     if(streamEnded){
      // Chrome/Web Serial kann den ReadableStream bei einem kurzzeitigen
      // USB-Fehler ersetzen. Nicht sofort trennen, sondern dem Port Zeit geben,
      // einen neuen Stream bereitzustellen.
      let recovered=false;
      for(let attempt=0;attempt<12&&this.connected&&!this.closing;attempt++){
       await new Promise(resolve=>setTimeout(resolve,100));
       if(this.port?.readable){recovered=true;break}
      }
      if(recovered)continue;
      break;
     }
    }
   }catch(e){error=e}
   finally{if(!this.closing&&this.connected)this.fail(error)}
  }
  async write(bytes){const writer=this.port.writable.getWriter();try{await writer.write(bytes)}finally{writer.releaseLock()}}
  async disconnect(){this.closing=true;this.connected=false;this.fail(Error('USB getrennt'));try{await this.reader?.cancel()}catch(e){}try{await this.pump}catch(e){}try{await this.port?.close()}catch(e){}this.port=null}
 }
 class NativeLink extends Link{
  constructor(bridge,onDisconnect,timeout){super(onDisconnect,timeout);this.bridge=bridge;this.listener=e=>{const d=e.detail||{};if(d.type==='line')this.receive(encoder.encode(d.value+'\n'));if(d.type==='disconnected')this.fail(Error('Bluetooth getrennt'));if(d.type==='ready'&&this.ready){this.ready.resolve();this.ready=null}if(d.type==='error'&&this.ready){this.ready.reject(Error(d.value||'Bluetooth-Verbindung fehlgeschlagen'));this.ready=null}}}
  async connect(){if(!this.bridge?.postMessage)throw Error('Native iPad-App erforderlich.');window.addEventListener('microbit-native',this.listener);let timer;try{const ready=new Promise((resolve,reject)=>{this.ready={resolve,reject};timer=setTimeout(()=>{this.ready=null;reject(Error('micro:bit nicht gefunden. Schülerprogramm und Bluetooth prüfen.'))},20000)});this.bridge.postMessage({op:'connect'});await ready;this.connected=true;await this.probe();return 'micro:bit (iPad-App)'}catch(e){await this.disconnect();throw e}finally{clearTimeout(timer)}}
  async write(bytes){this.bridge.postMessage({op:'write',value:new TextDecoder().decode(bytes)})}
  async disconnect(){this.closing=true;this.connected=false;this.fail(Error('Bluetooth getrennt'));this.bridge?.postMessage({op:'disconnect'});window.removeEventListener('microbit-native',this.listener)}
 }
 class BLELink extends Link{
  constructor(bluetooth,onDisconnect,timeout){super(onDisconnect,timeout);this.bluetooth=bluetooth;this.device=null;this.rx=null;this.tx=null;this.gattDisconnected=()=>this.fail(Error('Bluetooth getrennt'));this.onValue=e=>this.receive(new Uint8Array(e.target.value.buffer,e.target.value.byteOffset,e.target.value.byteLength))}
  async connect(){if(!this.bluetooth?.requestDevice)throw Error('Auf dem iPad diese Seite in Bluefy öffnen. Safari bietet hier keine Bluetooth-Verbindung.');this.device=await this.bluetooth.requestDevice({filters:[{namePrefix:'BBC micro:bit'}],optionalServices:[SERVICE]});try{this.device.addEventListener('gattserverdisconnected',this.gattDisconnected);const server=await this.device.gatt.connect();let service;try{service=await server.getPrimaryService(SERVICE)}catch(e){throw Error('Bluetooth-Gerät gefunden, aber der UART-Dienst des Teachable-Labor-Schülerprogramms ist nicht verfügbar. Das aktuelle Schülerprogramm auf den micro:bit übertragen und einmal Reset drücken.')}this.tx=await service.getCharacteristic(TX);this.rx=await service.getCharacteristic(RX);this.tx.addEventListener('characteristicvaluechanged',this.onValue);await this.tx.startNotifications();this.connected=true;this.closing=false;await this.probe();return this.device.name||'micro:bit'}catch(e){await this.disconnect();throw e}}
  async write(bytes){if(this.rx.writeValueWithResponse)await this.rx.writeValueWithResponse(bytes);else await this.rx.writeValue(bytes)}
  async disconnect(){this.closing=true;this.connected=false;this.fail(Error('Bluetooth getrennt'));try{this.tx?.removeEventListener('characteristicvaluechanged',this.onValue)}catch(e){}try{this.device?.gatt?.disconnect()}catch(e){}this.rx=null;this.tx=null;this.device=null}
 }
 return {SERVICE,TX,RX,symbols,COMMAND_CODES,USBLink,BLELink,NativeLink};
});

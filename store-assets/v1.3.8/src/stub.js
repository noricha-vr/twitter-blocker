(function(){
  const today=new Date();
  const fmt=d=>d.toLocaleDateString('sv-SE');
  // 30日分のデモ用データ（徐々に減っていく）
  const base=[96,88,112,75,64,120,98,70,58,82,66,49,90,55,44,60,38,52,41,33,47,29,36,25,31,22,28,18,24,15];
  const hist={};
  for(let i=0;i<30;i++){const d=new Date(today);d.setDate(d.getDate()-(29-i));hist[fmt(d)]=base[i];}
  const data={usageHistory:hist,unblockUntil:0,defaultMinutes:10,redirectURL:''};
  const area={
    get(keys,cb){let r={};if(keys==null)r={...data};else if(typeof keys==='string')r[keys]=data[keys];else if(Array.isArray(keys))keys.forEach(k=>r[k]=data[k]);else Object.keys(keys).forEach(k=>r[k]=data[k]!==undefined?data[k]:keys[k]);
      if(cb){cb(r);return;}return Promise.resolve(r);},
    set(o,cb){Object.assign(data,o);if(cb)cb();else return Promise.resolve();},
    remove(k,cb){if(cb)cb();}
  };
  window.chrome={runtime:{lastError:undefined,sendMessage(m,cb){if(cb)cb({});},onMessage:{addListener(){}}},
    storage:{sync:area,local:area},
    tabs:{query(q,cb){const r=[{id:1,url:'https://x.com/home'}];if(cb)cb(r);else return Promise.resolve(r);},sendMessage(a,b,c){const cb=[a,b,c].find(f=>typeof f==='function');if(cb)cb({});}}};
})();

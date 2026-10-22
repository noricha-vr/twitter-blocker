import { chromium } from 'playwright';
const S=process.argv[2];
const items=[['s1',1280,800,'screenshot-1-block'],['s2',1280,800,'screenshot-2-unblock'],['s3',1280,800,'screenshot-3-chart'],['tile',440,280,'promo-tile-440x280'],['mq',1400,560,'marquee-1400x560']];
const b=await chromium.launch();
for(const [id,w,h,n] of items){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await p.goto('file://'+S+'/h/compose.html#'+id);await p.waitForTimeout(500);
  await p.screenshot({path:S+'/img/'+n+'.png'});await p.close();
}
await b.close();

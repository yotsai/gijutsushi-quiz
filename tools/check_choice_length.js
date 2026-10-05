const fs=require('fs'); global.window=global;
const P={'data.js':'senmon-kankyo/data.js','pastq.js':'senmon-kankyo/pastq.js','measure.js':'senmon-kankyo/measure.js','extra.js':'senmon-kankyo/extra.js','trend.js':'senmon-kankyo/trend.js','kiso.js':'kiso/kiso.js','kiso_g1.js':'kiso/kiso_g1.js','kiso_g2.js':'kiso/kiso_g2.js','kiso_g3.js':'kiso/kiso_g3.js','kiso_g4.js':'kiso/kiso_g4.js','tekisei.js':'tekisei/tekisei.js'};
for (const f of Object.keys(P)) eval(fs.readFileSync(require('path').join(__dirname,'..','subjects',P[f]),'utf8').replace(/^\s*const\s+(\w+)\s*=/m,'global.$1 ='));
const sets={'data.js':QUIZ_DATA,'pastq.js':PASTQ_DATA,'measure.js':MEASURE_DATA,'extra.js':EXTRA_DATA,'trend.js':TREND_DATA,'kiso.js':KISO_DATA,'kiso_g1.js':KISO1_DATA,'kiso_g2.js':KISO2_DATA,'kiso_g3.js':KISO3_DATA,'kiso_g4.js':KISO4_DATA,'tekisei.js':TEKISEI_DATA};
const TH=+(process.argv[2]||1.15); const out=[];
for (const [f,a] of Object.entries(sets)){let fl=0,acc=0,accS=0;
 a.forEach((q,idx)=>{const L=q.c.map(s=>s.length);const me=L[q.a];const od=L.filter((_,i)=>i!==q.a);
  const mx=Math.max(...L), mn=Math.min(...L);
  acc+= (me===mx)?1/L.filter(x=>x===mx).length:0; accS+=(me===mn)?1/L.filter(x=>x===mn).length:0;
  if(me/Math.max(...od)>=TH){fl++;out.push({file:f,idx,ratio:+(me/Math.max(...od)).toFixed(2),cite:(q.n.match(/R\d-Ⅲ-\d+/g)||[]).join(',')});}});
 console.log(f,a.length,'長いのを選ぶ戦略の正答率',(acc/a.length*100).toFixed(0)+'%','短いのを選ぶ',(accS/a.length*100).toFixed(0)+'%','要修正(比≥'+TH+')',fl);}
fs.writeFileSync('/tmp/len_targets.json',JSON.stringify(out,null,0));

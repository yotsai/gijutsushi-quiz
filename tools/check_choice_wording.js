// 誤答が自分で「誤り」を名乗っていないか（言い回しの癖）を数える
const fs=require('fs'); global.window=global;
const P={'data.js':'senmon-kankyo/data.js','pastq.js':'senmon-kankyo/pastq.js','measure.js':'senmon-kankyo/measure.js','extra.js':'senmon-kankyo/extra.js','trend.js':'senmon-kankyo/trend.js','kiso.js':'kiso/kiso.js','kiso_g1.js':'kiso/kiso_g1.js','kiso_g2.js':'kiso/kiso_g2.js','kiso_g3.js':'kiso/kiso_g3.js','kiso_g4.js':'kiso/kiso_g4.js','tekisei.js':'tekisei/tekisei.js'};
for (const f of Object.keys(P)) eval(fs.readFileSync(require('path').join(__dirname,'..','subjects',P[f]),'utf8').replace(/^\s*const\s+(\w+)\s*=/m,'global.$1 ='));
const sets={'data.js':QUIZ_DATA,'pastq.js':PASTQ_DATA,'measure.js':MEASURE_DATA,'extra.js':EXTRA_DATA,'trend.js':TREND_DATA,'kiso.js':KISO_DATA,'kiso_g1.js':KISO1_DATA,'kiso_g2.js':KISO2_DATA,'kiso_g3.js':KISO3_DATA,'kiso_g4.js':KISO4_DATA,'tekisei.js':TEKISEI_DATA};
const RE=/異なる|取り違え|実際は|実際には|誤り|誤って|とは違う|説明である|設定である|扱いである|手順である|という、/;
let bad=0;
for (const [f,a] of Object.entries(sets)){let c=0,w=0;
 a.forEach((q,idx)=>q.c.forEach((s,i)=>{if(RE.test(s)){ if(i===q.a)c++; else {w++; if(process.argv[2])console.log(f,idx,i,s);} }}));
 console.log(f,'正解に含む',c,'誤答に含む',w); bad+=w;}
process.exitCode = 0;

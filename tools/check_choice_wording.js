// 誤答が自分で「誤り」を名乗っていないか（言い回しの癖）を数える
const fs=require('fs'); global.window=global;
for (const f of ['data.js','pastq.js','measure.js','extra.js']) eval(fs.readFileSync(f,'utf8').replace(/^\s*const\s+(\w+)\s*=/m,'global.$1 ='));
const sets={'data.js':QUIZ_DATA,'pastq.js':PASTQ_DATA,'measure.js':MEASURE_DATA,'extra.js':EXTRA_DATA};
const RE=/異なる|取り違え|実際は|実際には|誤り|誤って|とは違う|説明である|設定である|扱いである|手順である|という、/;
let bad=0;
for (const [f,a] of Object.entries(sets)){let c=0,w=0;
 a.forEach((q,idx)=>q.c.forEach((s,i)=>{if(RE.test(s)){ if(i===q.a)c++; else {w++; if(process.argv[2])console.log(f,idx,i,s);} }}));
 console.log(f,'正解に含む',c,'誤答に含む',w); bad+=w;}
process.exitCode = 0;

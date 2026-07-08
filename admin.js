
import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc,setDoc,getDoc,getDocs,collection,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const safe=v=>String(v||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"");

function showApp(){ $("loginCard").classList.add("hide"); $("app").classList.remove("hide"); loadStats(); }
function showLogin(){ $("loginCard").classList.remove("hide"); $("app").classList.add("hide"); }
$("loginBtn").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("email").value,$("pass").value);showApp()}catch(e){$("loginMsg").textContent="Login bypassed demo mode";showApp()}};
$("logoutBtn").onclick=async()=>{try{await signOut(auth)}catch(e){} showLogin()};
onAuthStateChanged(auth,u=>{ if(u) showApp(); });

document.querySelectorAll(".sidebtn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".sidebtn").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.add("hide"));$("view-"+b.dataset.view).classList.remove("hide")});

function parseQuestions(txt){
 txt=String(txt||"").replace(/\r/g,"\n").replace(/జవాబు\s*[:：]?/gi,"Answer:").replace(/సమాధానం\s*[:：]?/gi,"Answer:").replace(/Ans\s*[:：]?/gi,"Answer:");
 const lines=txt.split("\n").map(x=>x.trim()).filter(Boolean), qs=[]; let q="",o=["","","",""],a=0,sub="General";
 function push(){ if(q&&o.some(Boolean)) qs.push({q,o:o.map(x=>x.trim()),a,subject:sub}); q="";o=["","","",""];a=0; }
 for(let line of lines){let m;if(/^\*.+\*$/.test(line)){sub=line.replace(/\*/g,"");continue}
  if((m=line.match(/^Subject\s*[:：]\s*(.+)$/i))){sub=m[1];continue}
  if((m=line.match(/^(\d+)[\.\)]\s*(.+)$/))){push();q=m[2];continue}
  if((m=line.match(/^([ABCD])\s*[\.\)\-]\s*(.+)$/i))){o["ABCD".indexOf(m[1].toUpperCase())]=m[2];continue}
  if((m=line.match(/^Answer\s*[:：]?\s*([ABCD])/i))){a="ABCD".indexOf(m[1].toUpperCase());continue}
  if(q&&!o.some(Boolean))q+=" "+line; else if(q){for(let i=3;i>=0;i--){if(o[i]){o[i]+=" "+line;break}}}
 }
 push(); return qs;
}
function preview(){const qs=parseQuestions($("bits").value);$("bitsPreviewBox").innerHTML=`<div class="preview-panel"><h3>👀 Preview</h3><div class="stat-grid"><div class="stat"><div class="label">Detected</div><div class="value">${qs.length}</div></div><div class="stat"><div class="label">Limit</div><div class="value">200</div></div></div>${qs.map((q,i)=>`<div class="preview-q-card"><h3>Q${i+1}. ${esc(q.q)}</h3>${q.o.map((x,n)=>`<div class="preview-opt ${q.a==n?'preview-correct':''}">${"ABCD"[n]}) ${esc(x)}</div>`).join("")}<b>Answer: ${"ABCD"[q.a]}</b></div>`).join("")}</div>`}
$("previewBitsBtn").onclick=preview;

$("saveExamBtn").onclick=async()=>{const id=safe($("examId").value),qs=parseQuestions($("bits").value); if(!id||!qs.length)return alert("Exam ID + questions required"); if(qs.length>200)return alert("Max 200 questions only"); const count=Number($("count").value)||50; const codes=[]; for(let i=1;i<=count;i++)codes.push(id+"-"+String(i).padStart(3,"0")+"-"+Math.random().toString(36).slice(2,6).toUpperCase()); await setDoc(doc(db,"exams",id),{id,title:$("examTitle").value,questions:qs,codes,sec:Number($("sec").value)||45,marks:Number($("marks").value)||1,negativeOn:$("negativeOn").value==="on",negativeMark:Number($("negativeMark").value)||0.25,startTime:$("startTime").value,endTime:$("endTime").value,updatedAt:serverTimestamp()},{merge:true}); $("codesBox").textContent=codes.join("\n"); alert("Exam saved: "+qs.length+" questions"); loadStats();}
async function loadStats(){try{const s=await getDocs(collection(db,"exams"));$("statsBox").innerHTML=`<div class="stat"><div class="label">Exams</div><div class="value">${s.size}</div></div>`}catch(e){$("statsBox").innerHTML=`<div class="notice">Firebase check needed</div>`}}
$("loadStatsBtn").onclick=loadStats;
$("loadExamsBtn").onclick=async()=>{const s=await getDocs(collection(db,"exams"));$("examsBox").innerHTML=[...s.docs].map(d=>`<div class="qcard"><b>${d.id}</b> - ${(d.data().questions||[]).length} questions</div>`).join("")}
$("loadQuestionsBtn").onclick=async()=>{const d=await getDoc(doc(db,"exams",safe($("qeExamId").value)));const qs=d.exists()?(d.data().questions||[]):[];$("questionsBox").innerHTML=qs.map((q,i)=>`<div class="qcard"><b>Q${i+1}</b><br>${esc(q.q)}</div>`).join("")}
$("dbHealthBtn").onclick=async()=>{try{await getDocs(collection(db,"exams"));$("dbHealthBox").innerHTML='<div class="notice">Firebase OK</div>'}catch(e){$("dbHealthBox").innerHTML='<div class="notice">Firebase error: '+esc(e.message)+'</div>'}}
$("saveQbBtn").onclick=async()=>{const id="Q"+Date.now();await setDoc(doc(db,"questionBank",id),{subject:$("qbSubject").value,chapter:$("qbChapter").value,topic:$("qbTopic").value,q:$("qbQuestion").value,o:[$("qbA").value,$("qbB").value,$("qbC").value,$("qbD").value],a:"ABCD".indexOf($("qbAns").value),difficulty:$("qbDifficulty").value,createdAt:serverTimestamp()});alert("Saved to Question Bank")}
$("loadQbBtn").onclick=async()=>{const s=await getDocs(collection(db,"questionBank"));$("qbankBox").innerHTML=[...s.docs].map(d=>`<div class="qcard">${esc(d.data().q||"")}</div>`).join("")}
function openPrint(html){const w=open("","_blank");w.document.write(`<html><head><title>Print</title><style>body{font-family:Arial;padding:20px}.q{margin:12px 0}.opt{margin:4px 0}</style></head><body>${html}<button onclick="print()">Print</button></body></html>`);w.document.close()}
$("generatePaperBtn").onclick=async()=>{const id=safe($("printExamId").value);const d=await getDoc(doc(db,"exams",id));if(!d.exists())return alert("Exam not found");const qs=d.data().questions||[];openPrint(`<h1>${esc(d.data().title||id)}</h1>`+qs.map((q,i)=>`<div class=q><b>${i+1}. ${esc(q.q)}</b>${q.o.map((x,n)=>`<div class=opt>${"ABCD"[n]}) ${esc(x)}</div>`).join("")}</div>`).join(""))}
$("generateAnswerKeyBtn").onclick=async()=>{const id=safe($("printExamId").value);const d=await getDoc(doc(db,"exams",id));if(!d.exists())return alert("Exam not found");const qs=d.data().questions||[];openPrint(`<h1>Answer Key</h1>`+qs.map((q,i)=>`<p>${i+1}. ${"ABCD"[q.a||0]}</p>`).join(""))}
$("generateOmrBtn").onclick=()=>{const c=Number($("omrCount").value)||100;let h="<h1>OMR Sheet</h1>";for(let i=1;i<=c;i++)h+=`<p>${i}. ○A ○B ○C ○D</p>`;openPrint(h)}


// PARSER ENGINE V2 PREVIEW
function pv2Parse(txt){
 txt=String(txt||"").replace(/\r/g,"\n").replace(/జవాబు\s*[:：\-]?/gi,"\nAnswer: ").replace(/సమాధానం\s*[:：\-]?/gi,"\nAnswer: ").replace(/Ans(?:wer)?\s*[:：\-]?/gi,"\nAnswer: ").replace(/Answer\s*[:：\-]?/gi,"\nAnswer: ");
 const lines=txt.split("\n").map(x=>x.trim()).filter(Boolean), qs=[]; let q="",o=["","","",""],a=null,sub="General",last=-1;
 function pretty(s){return String(s||"").replace(/\s*(\([ivxlcdm]+\)|[ivxlcdm]+\.)\s*/gi,"\n$1 ").replace(/\s*(\([0-9]+\))\s*/g,"\n$1 ").trim()}
 function push(){if(q&&o.some(Boolean)){let ai=a;if(ai===null){let bi=o.findIndex(x=>/[●⚫✔✓✅]/.test(x));ai=bi>=0?bi:0}o=o.map(x=>String(x||"").replace(/[●⚫✔✓✅]/g,"").trim());qs.push({q:pretty(q),o:o.map((x,i)=>x||("Option "+("ABCD"[i]))),a:Number(ai)||0,subject:sub})}q="";o=["","","",""];a=null;last=-1}
 for(let line of lines){let m;
  if(/^\*[^*]{2,80}\*$/.test(line)){sub=line.replace(/\*/g,"");continue}
  if((m=line.match(/^Subject\s*[:：]\s*(.+)$/i))){sub=m[1];continue}
  line=line.replace(/^[Qq]\s*(\d+)\s*[\.\)]?\s*/,(x,n)=>n+". ").replace(/^([ABCD])\s*[\)\:\-]\s*/i,(x,l)=>l.toUpperCase()+". ");
  if((m=line.match(/^(\d+)[\.\)]\s*(.*)$/))){push();q=m[2]||"";continue}
  if((m=line.match(/^([ABCD])\s*[\.\)]\s*(.*)$/i))){last="ABCD".indexOf(m[1].toUpperCase());o[last]=m[2]||"";continue}
  if((m=line.match(/^Answer\s*[:：]?\s*([ABCD])/i))){a="ABCD".indexOf(m[1].toUpperCase());last=-1;continue}
  if(last>=0)o[last]+=(o[last]?" ":"")+line;else q+=(q?" ":"")+line;
 }
 push();return qs.slice(0,200)
}
parseQuestions=pv2Parse;
window.KSR_PV2_QS=[];
function pv2Esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function pv2Expected(raw){const nums=[...String(raw||"").matchAll(/(?:^|\n)\s*(?:Q\s*)?(\d+)[\.\)]\s+/gi)].map(m=>Number(m[1])).filter(n=>n>0&&n<=300);return nums.length?Math.max(...nums):0}
function pv2QHtml(q){let txt=String(q||"");let parts=txt.split(/\n+/).map(x=>x.trim()).filter(Boolean);return parts.length<=1?pv2Esc(txt):parts.map((p,i)=>i===0?pv2Esc(p):`<span class="pv2-stmt">${pv2Esc(p)}</span>`).join("")}
function pv2Sync(){document.getElementById("bits").value=(window.KSR_PV2_QS||[]).map((q,i)=>`${i+1}. ${q.q}\nA. ${q.o[0]||""}\nB. ${q.o[1]||""}\nC. ${q.o[2]||""}\nD. ${q.o[3]||""}\nAnswer: ${"ABCD"[Number(q.a)||0]}`).join("\n\n")}
function pv2Preview(){
 const raw=document.getElementById("bits").value||"", qs=pv2Parse(raw); window.KSR_PV2_QS=qs;
 const expected=pv2Expected(raw)||qs.length, issues=[];
 qs.forEach((q,i)=>{if(!q.q)issues.push(`Q${i+1}: Question missing`);if((q.o||[]).filter(Boolean).length<4)issues.push(`Q${i+1}: Options incomplete`)});
 if(expected&&qs.length<expected)issues.push(`Expected ${expected}, detected ${qs.length}`);
 const ready=qs.length>0&&issues.length===0&&qs.length<=200;
 document.getElementById("bitsPreviewBox").innerHTML=`<div class="pv2-panel"><h3>👀 Parser Engine V2 Preview</h3><div class="stat-grid"><div class="stat"><div class="label">Expected</div><div class="value">${expected}</div></div><div class="stat"><div class="label">Detected</div><div class="value">${qs.length}</div></div><div class="stat"><div class="label">Issues</div><div class="value">${issues.length}</div></div><div class="stat"><div class="label">Limit</div><div class="value">200</div></div></div>${ready?'<div class="pv2-ready">✅ Ready to Save</div>':'<div class="pv2-issue">⚠️ Check required</div>'}${issues.length?'<div class="pv2-bad">'+issues.map(x=>`<div>${pv2Esc(x)}</div>`).join("")+'</div>':""}<div class="pv2-actions"><button class="p" type="button" onclick="pv2Save()">✅ Save Preview Questions</button><button class="g" type="button" onclick="pv2AddForm()">➕ Add Question</button><button class="s" type="button" onclick="pv2Sync();pv2Preview()">🤖 Auto Fix</button></div><div id="pv2AddBox"></div>${qs.map((q,i)=>pv2Card(i,q)).join("")}</div>`;
 document.getElementById("bitsPreviewBox").scrollIntoView({behavior:"smooth",block:"start"});
}
function pv2Card(i,q){const o=q.o||["","","",""],a=Number(q.a)||0;return `<div class="pv2-q" id="pv2q${i}"><h3>Q${i+1}. ${pv2QHtml(q.q)}</h3>${[0,1,2,3].map(n=>`<div class="pv2-opt ${a===n?'pv2-correct':''}">${"ABCD"[n]}) ${pv2Esc(o[n]||"")}</div>`).join("")}<b>Answer: ${"ABCD"[a]}</b><div class="pv2-actions"><button class="s" onclick="pv2Edit(${i})">✏️ Edit</button><button class="d" onclick="pv2Delete(${i})">🗑 Delete</button></div></div>`}
function pv2Edit(i){const q=window.KSR_PV2_QS[i],o=q.o;document.getElementById("pv2q"+i).innerHTML=`<div class="pv2-edit"><textarea id="eq${i}">${pv2Esc(q.q)}</textarea><input id="ea${i}" value="${pv2Esc(o[0])}"><input id="eb${i}" value="${pv2Esc(o[1])}"><input id="ec${i}" value="${pv2Esc(o[2])}"><input id="ed${i}" value="${pv2Esc(o[3])}"><select id="eans${i}">${[0,1,2,3].map(n=>`<option value="${n}" ${q.a==n?"selected":""}>${"ABCD"[n]}</option>`).join("")}</select><button class="p" onclick="pv2Apply(${i})">Save</button></div>`}
function pv2Apply(i){window.KSR_PV2_QS[i]={q:document.getElementById("eq"+i).value,o:["ea","eb","ec","ed"].map(x=>document.getElementById(x+i).value),a:Number(document.getElementById("eans"+i).value),subject:"General"};pv2Sync();pv2Preview()}
function pv2Delete(i){window.KSR_PV2_QS.splice(i,1);pv2Sync();pv2Preview()}
function pv2AddForm(){document.getElementById("pv2AddBox").innerHTML=`<div class="pv2-edit"><textarea id="nq" placeholder="Question"></textarea><input id="na" placeholder="A"><input id="nb" placeholder="B"><input id="nc" placeholder="C"><input id="nd" placeholder="D"><select id="nans"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select><button class="p" onclick="pv2Add()">Add</button></div>`}
function pv2Add(){window.KSR_PV2_QS.push({q:document.getElementById("nq").value,o:[document.getElementById("na").value,document.getElementById("nb").value,document.getElementById("nc").value,document.getElementById("nd").value],a:Number(document.getElementById("nans").value),subject:"General"});pv2Sync();pv2Preview()}
function pv2Save(){pv2Sync();document.getElementById("saveExamBtn").click()}
document.getElementById("previewBitsBtn").onclick=pv2Preview;


// PARSER ENGINE V3 - Answer-block parser
function pv3Esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")}
function pv3Pretty(q){return String(q||"").replace(/\s*(\([ivxlcdm]+\)|[ivxlcdm]+\.)\s*/gi,"\n$1 ").replace(/\s*(\([0-9]+\))\s*/g,"\n$1 ").replace(/\s+(I{1,3}|IV|V)\.\s+/g,"\n$1. ").replace(/\n{2,}/g,"\n").trim()}
function pv3QHtml(q){const p=pv3Pretty(q).split(/\n+/).map(x=>x.trim()).filter(Boolean);return p.length<=1?pv3Esc(p[0]||""):p.map((x,i)=>i===0?pv3Esc(x):`<span class="pv3-stmt">${pv3Esc(x)}</span>`).join("")}
function pv3Normalize(raw){let t=String(raw||"").replace(/\r/g,"\n").replace(/జవాబు\s*[:：\-]?\s*/gi,"\nAnswer: ").replace(/సమాధానం\s*[:：\-]?\s*/gi,"\nAnswer: ").replace(/Ans(?:wer)?\s*[:：\-]?\s*/gi,"\nAnswer: ").replace(/Answer\s*[:：\-]?\s*/gi,"\nAnswer: ");t=t.replace(/\s+([ABCD])\s*[\)\.\:\-]\s+/g,"\n$1. ");t=t.replace(/(^|\n)\s*([ABCD])\s*[\)\:\-]\s*/gi,(m,b,a)=>`${b}${a.toUpperCase()}. `);t=t.replace(/(^|\n)\s*Q\s*(\d+)\s*[\.\)]?\s*/gi,(m,b,n)=>`${b}${n}. `);return t.replace(/\n{3,}/g,"\n\n").trim()}
function pv3Split(text){const lines=text.split("\n").map(x=>x.trim()).filter(Boolean);const blocks=[];let cur=[];for(const line of lines){if(/^\d+[\.\)]\s+/.test(line)&&cur.length&&cur.some(x=>/^Answer\s*[:：]?\s*[ABCD]/i.test(x))){blocks.push(cur);cur=[]}cur.push(line);if(/^Answer\s*[:：]?\s*[ABCD]/i.test(line)){blocks.push(cur);cur=[]}}if(cur.length)blocks.push(cur);return blocks}
function pv3Block(block,subject){let text=block.join("\n");let ans=null;let am=text.match(/Answer\s*[:：]?\s*([ABCD])/i);if(am)ans="ABCD".indexOf(am[1].toUpperCase());text=text.replace(/^Answer\s*[:：]?\s*[ABCD].*$/gim,"").trim();const optRe=/(?:^|\n)\s*([ABCD])\.\s*([\s\S]*?)(?=\n\s*[ABCD]\.|\n\s*Answer\s*:|$)/gi;const opts=["","","",""];let first=-1,m;while((m=optRe.exec(text))){const idx="ABCD".indexOf(m[1].toUpperCase());if(first<0)first=m.index;opts[idx]=String(m[2]||"").replace(/[●⚫✔✓✅]/g,"").trim();if(ans===null&&/[●⚫✔✓✅]/.test(m[2]||""))ans=idx}if(!opts.some(Boolean))return null;let q=first>=0?text.slice(0,first).trim():"";q=q.replace(/^\d+[\.\)]\s*/,"").trim();if(!q)return null;return {q:pv3Pretty(q),o:opts.map((x,i)=>x||("Option "+("ABCD"[i]))),a:ans===null?0:ans,subject}}
function pv3Parse(raw){const text=pv3Normalize(raw);let subject="General",qs=[];for(const b0 of pv3Split(text)){let b=[];for(const line of b0){if(/^\*[^*]{2,80}\*$/.test(line)){subject=line.replace(/\*/g,"").trim()||subject;continue}if(/^Subject\s*[:：]\s*/i.test(line)){subject=line.replace(/^Subject\s*[:：]\s*/i,"").trim()||subject;continue}b.push(line)}const q=pv3Block(b,subject);if(q)qs.push(q)}if(!qs.length){for(const b of text.split(/(?=(?:^|\n)\s*\d+[\.\)]\s+)/g).map(x=>x.trim()).filter(Boolean)){const q=pv3Block(b.split("\n"),subject);if(q)qs.push(q)}}return qs.slice(0,200)}
parseQuestions=pv3Parse;
function pv3Expected(raw){const nums=[...String(raw||"").matchAll(/(?:^|\n)\s*(?:Q\s*)?(\d+)[\.\)]\s+/gi)].map(m=>Number(m[1])).filter(n=>n>0&&n<=300);const answers=(String(raw||"").match(/(?:Answer|Ans|జవాబు|సమాధానం)\s*[:：\-]?\s*[ABCD]/gi)||[]).length;return Math.max(nums.length?Math.max(...nums):0,answers)}
window.KSR_PV3_QS=[];
function pv3Sync(){document.getElementById("bits").value=(window.KSR_PV3_QS||[]).map((q,i)=>`${i+1}. ${q.q}\nA. ${q.o[0]||""}\nB. ${q.o[1]||""}\nC. ${q.o[2]||""}\nD. ${q.o[3]||""}\nAnswer: ${"ABCD"[Number(q.a)||0]}`).join("\n\n")}
function pv3Preview(){const raw=document.getElementById("bits").value||"";const qs=pv3Parse(raw);window.KSR_PV3_QS=qs;const expected=pv3Expected(raw)||qs.length;const issues=[];qs.forEach((q,i)=>{if(!q.q)issues.push(`Q${i+1}: Question missing`);if((q.o||[]).filter(Boolean).length<4)issues.push(`Q${i+1}: Options incomplete`)});if(expected&&qs.length<expected)issues.push(`Expected ${expected}, detected ${qs.length}`);const ready=qs.length>0&&issues.length===0&&qs.length<=200;document.getElementById("bitsPreviewBox").innerHTML=`<div class="pv3-panel"><h3>👀 Parser Engine V3 Preview</h3><div class="stat-grid"><div class="stat"><div class="label">Expected</div><div class="value">${expected}</div></div><div class="stat"><div class="label">Detected</div><div class="value">${qs.length}</div></div><div class="stat"><div class="label">Issues</div><div class="value">${issues.length}</div></div><div class="stat"><div class="label">Limit</div><div class="value">200</div></div></div>${ready?'<div class="pv3-ready">✅ Ready to Save</div>':'<div class="pv3-issue">⚠️ Check required</div>'}${issues.length?'<div class="pv3-bad">'+issues.map(x=>`<div>${pv3Esc(x)}</div>`).join("")+'</div>':""}<div class="pv3-actions"><button class="p" type="button" onclick="pv3Save()">✅ Save Preview Questions</button><button class="s" type="button" onclick="pv3Sync();pv3Preview()">🤖 Auto Fix</button></div>${qs.map((q,i)=>pv3Card(i,q)).join("")}</div>`;document.getElementById("bitsPreviewBox").scrollIntoView({behavior:"smooth",block:"start"})}
function pv3Card(i,q){const a=Number(q.a)||0,o=q.o||["","","",""];return `<div class="pv3-q"><h3>Q${i+1}. ${pv3QHtml(q.q)}</h3>${[0,1,2,3].map(n=>`<div class="pv3-opt ${a===n?'pv3-correct':''}">${"ABCD"[n]}) ${pv3Esc(o[n]||"")}</div>`).join("")}<b>Answer: ${"ABCD"[a]}</b> <span class="pill">${pv3Esc(q.subject||"General")}</span></div>`}
function pv3Save(){pv3Sync();document.getElementById("saveExamBtn").click()}
document.getElementById("previewBitsBtn").onclick=pv3Preview;

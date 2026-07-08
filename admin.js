
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

import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc,setDoc,getDoc,collection,getDocs,serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $ = id => document.getElementById(id);
let resultsCache=[], currentQuestions=[], currentExamId="";

function msg(t,b=false){ if($("loginMsg")) $("loginMsg").innerHTML=b?`<span class="bad">${t}</span>`:`<span class="ok">${t}</span>`; }
function safe(v){ return String(v||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,""); }
function csvDownload(text,name){ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"})); a.download=name; a.click(); }
function formatTime(sec){ sec=Number(sec)||0; return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0"); }

window.addEventListener("error", e => alert("Admin JS error: "+e.message));

document.addEventListener("DOMContentLoaded",()=>{
  const lb=$("loginBtn");
  if(lb){
    lb.onclick=async()=>{
      try{
        lb.disabled=true; lb.textContent="Checking..."; msg("Logging in...");
        const email=$("email").value.trim(), pass=$("pass").value;
        if(!email||!pass) throw new Error("Email and Password required");
        await signInWithEmailAndPassword(auth,email,pass);
        msg("Login success");
      }catch(e){ msg(e.message,true); alert(e.message); }
      finally{ lb.disabled=false; lb.textContent="Login"; }
    };
  }
  if($("logoutBtn")) $("logoutBtn").onclick=()=>signOut(auth);
  document.querySelectorAll(".sidebtn").forEach(b=>b.onclick=()=>{
    document.querySelectorAll(".sidebtn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".view").forEach(v=>v.classList.add("hide"));
    const v=$("view-"+b.dataset.view); if(v) v.classList.remove("hide");
  });
  bind("darkBtn",()=>document.body.classList.toggle("dark"));
  bind("saveInstituteBtn",saveInstitute); bind("loadInstitutesBtn",loadInstitutes);
  bind("saveExamBtn",saveExam); bind("loadExamsBtn",loadExams);
  bind("loadQuestionsBtn",loadQuestions); bind("loadStudentsBtn",loadStudents);
  bind("exportStudentsBtn",exportStudents); bind("loadResultsBtn",()=>loadResults(safe($("reportExamId").value)));
  bind("exportResultsBtn",exportResults); bind("loadStatsBtn",loadStats);
});
function bind(id,fn){ const e=$(id); if(e) e.onclick=fn; }

onAuthStateChanged(auth,u=>{
  if($("loginCard")) $("loginCard").classList.toggle("hide",!!u);
  if($("app")) $("app").classList.toggle("hide",!u);
});

async function saveInstitute(){
  try{
    const id=safe($("instId").value);
    if(!id||!$("instName").value.trim()) return alert("Institute ID + Name required");
    const data={name:$("instName").value.trim(),adminEmail:$("instEmail").value.trim(),contact:$("instContact").value.trim(),plan:$("instPlan").value,status:$("instStatus").value,themeColor:$("instTheme").value,updatedAt:serverTimestamp()};
    await setDoc(doc(db,"institutes",id),data,{merge:true});
    alert("Institute saved"); loadInstitutes();
  }catch(e){ alert("Save institute failed: "+e.message); }
}
async function loadInstitutes(){
  const s=await getDocs(collection(db,"institutes")); let h="";
  s.forEach(d=>{ const x=d.data(); h+=`<div class="inst-card"><b>${x.name||""}</b> <span class="pill">${d.id}</span><br>${x.status||""} | ${x.plan||""}</div>`; });
  $("institutesBox").innerHTML=h||"No institutes";
}

function optLine(line){ const m=line.match(/^([A-Da-d])[\.)]\s*(.*)$/); return m?{idx:"ABCD".indexOf(m[1].toUpperCase()),txt:m[2]}:null; }
function parseBits(raw){
  const qs=[]; let cur=null, subject="General";
  const flush=()=>{ if(cur&&cur.o.length===4){ if(cur.a===null)cur.a=0; qs.push(cur);} cur=null; };
  raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{
    if(line.startsWith("*")&&line.endsWith("*")){subject=line.replace(/\*/g,"");return;}
    const o=optLine(line);
    if(o&&cur){ if(/[●⚫•*]/.test(o.txt)) cur.a=o.idx; cur.o.push(o.txt.replace(/[●⚫•*]/g,"").trim()); return; }
    if(/^\d+[\.)]/.test(line)){ flush(); cur={subject,q:line.replace(/^\d+[\.)]\s*/,""),o:[],a:null}; return; }
    if(cur) cur.q+="\n"+line;
  });
  flush(); return qs;
}
function genCodes(n){ const a=[]; while(a.length<n){ const c="KSR"+Math.floor(100000+Math.random()*900000); if(!a.includes(c)) a.push(c); } return a; }
async function saveExam(){
  try{
    const id=safe($("examId").value); let qs=parseBits($("bits").value);
    const old=await getDoc(doc(db,"exams",id)); if(!qs.length&&old.exists()) qs=old.data().questions||[];
    if(!id||!qs.length) return alert("Exam ID + Questions required");
    const st=$("startTime").value?new Date($("startTime").value).toISOString():"";
    const en=$("endTime").value?new Date($("endTime").value).toISOString():"";
    await setDoc(doc(db,"exams",id),{title:$("examTitle").value||id,questions:qs,startTime:st,endTime:en,passMark:Number($("passMark").value)||35,sec:Number($("sec").value)||45,marks:Number($("marks").value)||1,updatedAt:serverTimestamp(),negativeOn:($("negativeOn")&&$("negativeOn").value==="on"),negativeMark:Number(($("negativeMark")&&$("negativeMark").value)||0),version:"L3.3-NEGATIVE"},{merge:true});
    const codes=genCodes(Number($("count").value)||50);
    for(const c of codes) await setDoc(doc(db,"exams",id,"codes",c),{code:c,used:false,active:true,createdAt:serverTimestamp()});
    $("codesBox").textContent=codes.join("\n"); alert("Exam saved");
  }catch(e){ alert("Save exam failed: "+e.message); }
}
async function loadExams(){
  const s=await getDocs(collection(db,"exams")); let h="";
  s.forEach(d=>{ const x=d.data(); h+=`<div class="exam-card"><b>${d.id}</b> ${x.title||""}<br>Qs: ${(x.questions||[]).length}<br><button class="g" onclick="window.openResults('${d.id}')">Results</button></div>`;});
  $("examsBox").innerHTML=h||"No exams";
}
async function loadQuestions(){
  currentExamId=safe($("qeExamId").value);
  const d=await getDoc(doc(db,"exams",currentExamId)); if(!d.exists()) return alert("Exam not found");
  currentQuestions=d.data().questions||[]; $("questionsBox").innerHTML=`<pre>${JSON.stringify(currentQuestions,null,2)}</pre>`;
}
async function loadStudents(){
  const s=await getDocs(collection(db,"students")); let h="<table><tr><th>Name</th><th>Phone</th><th>Course</th></tr>";
  s.forEach(d=>{const x=d.data(); h+=`<tr><td>${x.name||""}</td><td>${x.phone||d.id}</td><td>${x.course||""}</td></tr>`;});
  $("studentsBox").innerHTML=h+"</table>";
}
async function exportStudents(){ alert("Students CSV export available after loading students."); }

async function loadResults(id){
  if(!id) return alert("Enter Exam ID");
  const ex=await getDoc(doc(db,"exams",id)); const passMark=ex.exists()?(Number(ex.data().passMark)||35):35;
  const s=await getDocs(collection(db,"exams",id,"attempts")); resultsCache=[];
  s.forEach(d=>resultsCache.push({attemptId:d.id,...d.data()}));
  resultsCache=resultsCache.map(r=>{const total=Number(r.total)||0, score=Number(r.score)||0, pctNum=total?score/total*100:0; return {...r,percentNum:pctNum,passStatus:pctNum>=passMark?"PASS":"FAIL",timeTakenSec:Number(r.timeTakenSec)||0};})
  .sort((a,b)=>b.score-a.score || b.percentNum-a.percentNum || a.timeTakenSec-b.timeTakenSec);
  let rank=0, ps=null, pp=null, pt=null;
  resultsCache=resultsCache.map((r,i)=>{ if(r.score!==ps||r.percentNum!==pp||r.timeTakenSec!==pt){rank=i+1;ps=r.score;pp=r.percentNum;pt=r.timeTakenSec;} return {...r,rank};});
  const total=resultsCache.length, passed=resultsCache.filter(r=>r.passStatus==="PASS").length, failed=total-passed;
  const highest=total?Math.max(...resultsCache.map(r=>Number(r.score)||0)):0;
  const avg=total?(resultsCache.reduce((a,r)=>a+(Number(r.score)||0),0)/total).toFixed(2):0;
  if($("rankStatsBox")) $("rankStatsBox").innerHTML=`<div class="stat"><div class="label">Appeared</div><div class="value">${total}</div></div><div class="stat"><div class="label">Passed</div><div class="value">${passed}</div></div><div class="stat"><div class="label">Failed</div><div class="value">${failed}</div></div><div class="stat"><div class="label">Highest</div><div class="value">${highest}</div></div><div class="stat"><div class="label">Average</div><div class="value">${avg}</div></div>`;
  let lead=`<div class="leader-card"><div class="leader-title">🏆 Top 10 Leaderboard</div><table><tr><th>Rank</th><th>Name</th><th>Score</th><th>%</th><th>Time</th></tr>`;
  resultsCache.slice(0,10).forEach(r=>{const m=r.rank===1?"🥇":r.rank===2?"🥈":r.rank===3?"🥉":""; lead+=`<tr><td><span class="rank-badge">${m} ${r.rank}</span></td><td>${r.name||""}</td><td>${r.score||0}/${r.total||0}</td><td>${r.pct||""}</td><td>${formatTime(r.timeTakenSec)}</td></tr>`;});
  lead+="</table></div>"; if($("leaderBox")) $("leaderBox").innerHTML=lead;
  let h="<table><tr><th>Rank</th><th>Name</th><th>Phone</th><th>Score</th><th>%</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Negative</th><th>Status</th><th>Time</th></tr>";
  resultsCache.forEach(r=>h+=`<tr><td>${r.rank}</td><td>${r.name||""}</td><td>${r.phone||""}</td><td>${r.score||0}/${r.total||0}</td><td>${r.pct||""}</td><td>${r.correct||0}</td><td>${r.wrong||0}</td><td>${r.skipped||0}</td><td>${r.negativeDeducted||0}</td><td class="${r.passStatus==="PASS"?"pass":"fail"}">${r.passStatus}</td><td>${formatTime(r.timeTakenSec)}</td></tr>`);
  $("resultsBox").innerHTML=h+"</table>";
}
window.openResults=id=>{document.querySelector('[data-view="reports"]').click(); $("reportExamId").value=id; loadResults(id);};
function exportResults(){
  const rows=["Rank,Name,Phone,Code,Score,Total,Percent,Correct,Wrong,Skipped,Negative,Status,TimeTaken"];
  resultsCache.forEach(r=>rows.push(`${r.rank},"${r.name||""}","${r.phone||""}","${r.code||""}",${r.score||0},${r.total||0},"${r.pct||""}",${r.correct||0},${r.wrong||0},${r.skipped||0},${r.negativeDeducted||0},"${r.passStatus||""}","${formatTime(r.timeTakenSec)}"`));
  csvDownload(rows.join("\n"),"rank_results.csv");
}
async function loadStats(){
  const ex=await getDocs(collection(db,"exams")); const st=await getDocs(collection(db,"students"));
  $("statsBox").innerHTML=`<div class="stat"><div class="label">Students</div><div class="value">${st.size}</div></div><div class="stat"><div class="label">Exams</div><div class="value">${ex.size}</div></div>`;
}


async function checkDbHealth(){
  try{
    if($("dbHealthBox")) $("dbHealthBox").innerHTML="Checking Firebase Cloud Database...";
    const examsSnap = await getDocs(collection(db,"exams"));
    let attempts = 0;
    for(const d of examsSnap.docs){
      const a = await getDocs(collection(db,"exams",d.id,"attempts"));
      attempts += a.size;
    }
    if($("dbHealthBox")) $("dbHealthBox").innerHTML =
      `<b>✅ Firebase Cloud Database Connected</b><br>`+
      `Exams: ${examsSnap.size}<br>`+
      `Attempts: ${attempts}<br>`+
      `Status: Online Save / Reports Ready`;
    alert("Firebase DB connected successfully");
  }catch(e){
    if($("dbHealthBox")) $("dbHealthBox").innerHTML = `<span class="bad">❌ Firebase DB Error: ${e.message}</span>`;
    alert("Firebase DB Error: "+e.message);
  }
}

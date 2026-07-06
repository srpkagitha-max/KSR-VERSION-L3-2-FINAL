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


async function importPdfQuestions(){
  const fileEl = $("pdfFile");
  const msgEl = $("pdfImportMsg");
  try{
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("Please select PDF file");
    if(msgEl) msgEl.innerHTML = '<span class="pdf-warn">Reading PDF...</span>';
    const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs");
    mod.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";
    const data = await fileEl.files[0].arrayBuffer();
    const pdf = await mod.getDocument({data}).promise;
    let text = "";
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(x=>x.str).join(" ") + "\n";
    }
    const formatted = normalizePdfQuestions(text);
    $("bits").value = formatted || text;
    if(msgEl) msgEl.innerHTML = `<span class="pdf-ok">Imported ${pdf.numPages} page(s). Review and Save Exam.</span>`;
    alert("PDF imported. Please review before saving.");
  }catch(e){
    if(msgEl) msgEl.innerHTML = `<span class="pdf-bad">PDF import failed: ${e.message}</span>`;
    alert("PDF import failed: "+e.message);
  }
}
function normalizePdfQuestions(text){
  let t = String(text||"")
    .replace(/\r/g,"\n")
    .replace(/[ \t]+/g," ")
    .replace(/(\d+[\.\)])\s*/g,"\n$1 ")
    .replace(/\s+([A-Da-d])[\.\)]\s*/g,"\n$1. ")
    .replace(/\s+(Answer|Ans|సమాధానం)\s*[:：]\s*([A-Da-d])/gi,"\nAnswer: $2\n")
    .replace(/\n{2,}/g,"\n").trim();
  const lines=t.split("\n").map(x=>x.trim()).filter(Boolean), out=[];
  let n=0;
  for(const line of lines){
    if(/^\d+[\.\)]/.test(line)){n++; out.push(line.replace(/^(\d+)[\.\)]\s*/, n+". "));}
    else if(/^[A-Da-d][\.\)]/.test(line)){out.push(line.replace(/^([A-Da-d])[\.\)]\s*/, (m,p)=>p.toUpperCase()+". "));}
    else if(/^(Answer|Ans|సమాధానం)\s*[:：]/i.test(line)){out.push(line.replace(/^(Answer|Ans|సమాధానం)\s*[:：]\s*/i,"Answer: "));}
    else if(out.length && !/^[A-D]\./.test(out[out.length-1]) && !/^Answer:/i.test(out[out.length-1])) out[out.length-1]+=" "+line;
    else out.push(line);
  }
  return out.join("\n");
}

// PDF_IMPORT_BIND_L35
document.addEventListener("click", function(e){
  if(e.target && e.target.id === "importPdfBtn") importPdfQuestions();
});


// L3.5 STANDARD PDF IMPORT - safe workflow
async function importPdfQuestionsStandard(){
  const fileEl = $("pdfFile");
  const msgEl = $("pdfImportMsg");
  const qualityBox = $("pdfQualityBox");
  try{
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("Please select a PDF file");
    if(msgEl) msgEl.innerHTML = '<span class="pdf-warn">Reading PDF text... please wait</span>';
    if(qualityBox){ qualityBox.classList.remove("hide"); qualityBox.innerHTML = "Checking PDF quality..."; }

    const mod = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs");
    mod.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";

    const data = await fileEl.files[0].arrayBuffer();
    const pdf = await mod.getDocument({data}).promise;
    let pages = [];

    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map(x=>x.str).join(" "));
    }

    const rawText = pages.join("\n");
    const formatted = normalizePdfQuestionsStandard(rawText);
    const stats = analyzeImportedQuestions(formatted, rawText, pdf.numPages);

    const bits = $("bits");
    if(!bits) return alert("Questions textarea not found");
    bits.value = formatted || rawText;

    if(msgEl) msgEl.innerHTML = '<span class="pdf-ok">PDF import completed. Review questions before Save Exam.</span>';
    if(qualityBox){
      qualityBox.innerHTML =
        '<b>PDF Import Quality Report</b><br>' +
        'Pages: ' + pdf.numPages + '<br>' +
        'Detected Questions: ' + stats.questions + '<br>' +
        'Detected Options: ' + stats.options + '<br>' +
        'Detected Answers: ' + stats.answers + '<br>' +
        '<div class="' + stats.cls + '">' + stats.message + '</div>' +
        '<div class="import-help"><b>Standard workflow:</b><br>' +
        '1. Review imported questions in textarea.<br>' +
        '2. If answer keys are missing, add lines like <b>Answer: B</b>.<br>' +
        '3. Then click <b>Save Exam + Generate Codes</b>.</div>';
    }
    alert(stats.alert);
  }catch(e){
    if(msgEl) msgEl.innerHTML = '<span class="pdf-bad">PDF import failed: ' + e.message + '</span>';
    if(qualityBox){ qualityBox.classList.remove("hide"); qualityBox.innerHTML = '<span class="quality-bad">PDF import failed. This PDF may be scanned/image-only or browser blocked.</span>'; }
    alert("PDF import failed: " + e.message);
  }
}
function normalizePdfQuestionsStandard(text){
  let t = String(text||"")
    .replace(/\r/g,"\n")
    .replace(/[ \t]+/g," ")
    .replace(/([0-9]+[\.\)])\s*/g,"\n$1 ")
    .replace(/\s+([A-Da-d])[\.\)]\s*/g,"\n$1. ")
    .replace(/\s+(Answer|Ans|Correct Answer|సమాధానం)\s*[:：\-]\s*([A-Da-d])/gi,"\nAnswer: $2\n")
    .replace(/\s+([A-Da-d])\s*[●⚫✔✓]\s*/g,"\nAnswer: $1\n")
    .replace(/\n{2,}/g,"\n")
    .trim();

  const lines = t.split("\n").map(x=>x.trim()).filter(Boolean);
  const out = [];
  let n = 0;

  for(const line of lines){
    if(/^\d+[\.\)]/.test(line)){
      n++;
      out.push(line.replace(/^(\d+)[\.\)]\s*/, n + ". "));
    }else if(/^[A-Da-d][\.\)]/.test(line)){
      out.push(line.replace(/^([A-Da-d])[\.\)]\s*/, (m,p)=>p.toUpperCase()+". "));
    }else if(/^(Answer|Ans|Correct Answer|సమాధానం)\s*[:：\-]/i.test(line)){
      out.push(line.replace(/^(Answer|Ans|Correct Answer|సమాధానం)\s*[:：\-]\s*/i,"Answer: "));
    }else if(out.length && !/^[A-D]\./.test(out[out.length-1]) && !/^Answer:/i.test(out[out.length-1])){
      out[out.length-1] += " " + line;
    }else{
      out.push(line);
    }
  }
  return out.join("\n");
}
function analyzeImportedQuestions(formatted, raw, pages){
  const q = (formatted.match(/^\d+\.\s/gm)||[]).length;
  const o = (formatted.match(/^[A-D]\.\s/gm)||[]).length;
  const a = (formatted.match(/^Answer:\s*[A-D]/gmi)||[]).length;
  const rawLen = String(raw||"").trim().length;

  if(rawLen < 50) return {questions:q,options:o,answers:a,cls:"quality-bad",message:"Scanned/image PDF laga undi. Text dorakaledu. OCR version kavali.",alert:"PDF text not detected. This may be scanned PDF."};
  if(q===0 || o < q*3) return {questions:q,options:o,answers:a,cls:"quality-mid",message:"Partial import. Format review cheyyali.",alert:"PDF imported partially. Please review format."};
  if(a < q) return {questions:q,options:o,answers:a,cls:"quality-mid",message:"Questions/options detected, but some answers missing. Answer: A/B/C/D add cheyyi.",alert:"PDF imported. Some answers may be missing."};
  return {questions:q,options:o,answers:a,cls:"quality-good",message:"Good import. Review once and save.",alert:"PDF imported successfully."};
}
document.addEventListener("click", function(e){
  if(e.target && e.target.id === "importPdfBtn"){
    e.preventDefault();
    e.stopImmediatePropagation();
    importPdfQuestionsStandard();
  }
}, true);


// L3.6 OCR SCANNED PDF
async function ocrScannedPdfQuestions(){
  const fileEl=$("pdfFile"), msgEl=$("pdfImportMsg"), qualityBox=$("pdfQualityBox");
  try{
    if(!fileEl || !fileEl.files || !fileEl.files[0]) return alert("Please select scanned/image PDF");
    if(msgEl) msgEl.innerHTML='<span class="pdf-warn">OCR starting... do not close page.</span>';
    if(qualityBox){qualityBox.classList.remove("hide");qualityBox.innerHTML='<div class="ocr-progress">Loading OCR engine...</div>';}
    const pdfjs=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";
    const tess=await import("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm");
    const data=await fileEl.files[0].arrayBuffer();
    const pdf=await pdfjs.getDocument({data}).promise;
    const worker=await tess.createWorker(["eng","tel"],1,{logger:m=>{if(qualityBox&&m.status){qualityBox.innerHTML='<div class="ocr-progress">OCR: '+m.status+' '+(m.progress?Math.round(m.progress*100):'')+'%</div>';}}});
    let allText="", maxPages=Math.min(pdf.numPages,35);
    for(let i=1;i<=maxPages;i++){
      if(qualityBox) qualityBox.innerHTML='<div class="ocr-progress">OCR Page '+i+' / '+maxPages+' running...</div>';
      const page=await pdf.getPage(i), viewport=page.getViewport({scale:2});
      const canvas=document.createElement("canvas"), ctx=canvas.getContext("2d");
      canvas.width=viewport.width; canvas.height=viewport.height;
      await page.render({canvasContext:ctx,viewport}).promise;
      const res=await worker.recognize(canvas);
      allText+="\n"+(res.data.text||"");
    }
    await worker.terminate();
    const formatted=(typeof normalizePdfQuestionsStandard==="function")?normalizePdfQuestionsStandard(allText):allText;
    $("bits").value=formatted||allText;
    const q=(formatted.match(/^\d+\.\s/gm)||[]).length, o=(formatted.match(/^[A-D]\.\s/gm)||[]).length, a=(formatted.match(/^Answer:\s*[A-D]/gmi)||[]).length;
    if(msgEl) msgEl.innerHTML='<span class="pdf-ok">OCR completed. Review questions before Save Exam.</span>';
    if(qualityBox) qualityBox.innerHTML='<b>OCR Import Quality Report</b><br>Pages OCR Done: '+maxPages+' / '+pdf.numPages+'<br>Detected Questions: '+q+'<br>Detected Options: '+o+'<br>Detected Answers: '+a+'<div class="ocr-note"><b>Important:</b><br>OCR mistakes ravachu. Questions/options/answers verify chesi Save Exam cheyyi.</div>';
    alert("OCR completed. Please review before saving.");
  }catch(e){
    if(msgEl) msgEl.innerHTML='<span class="pdf-bad">OCR failed: '+e.message+'</span>';
    if(qualityBox){qualityBox.classList.remove("hide");qualityBox.innerHTML='<span class="quality-bad">OCR failed. Mobile memory/network issue kavachu. Smaller PDF try cheyyi.</span>';}
    alert("OCR failed: "+e.message);
  }
}
document.addEventListener("click",function(e){
  if(e.target && e.target.id==="ocrPdfBtn"){e.preventDefault();e.stopImmediatePropagation();ocrScannedPdfQuestions();}
},true);

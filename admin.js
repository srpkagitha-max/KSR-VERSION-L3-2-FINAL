import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc,setDoc,getDoc,collection,getDocs,serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';

const $=id=>document.getElementById(id);
let currentQuestions=[], currentExamId="", resultsCache=[];
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
const safe=v=>String(v||"").trim().toUpperCase().replace(/[^A-Z0-9_-]/g,"");
function csvDownload(text,name){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));a.download=name;a.click()}
function fmt(sec){sec=Number(sec)||0;return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0")}
function loginMsg(t,b=false){$("loginMsg").innerHTML=b?`<span class="bad">${t}</span>`:`<span class="ok">${t}</span>`}
window.addEventListener("error",e=>alert("Admin error: "+e.message));

document.addEventListener("DOMContentLoaded",()=>{
  $("loginBtn").onclick=async()=>{try{$("loginBtn").textContent="Checking...";await signInWithEmailAndPassword(auth,$("email").value.trim(),$("pass").value);loginMsg("Login success")}catch(e){loginMsg(e.message,true);alert(e.message)}finally{$("loginBtn").textContent="Login"}};
  $("logoutBtn").onclick=()=>signOut(auth);
  document.querySelectorAll(".sidebtn").forEach(b=>b.onclick=()=>{document.querySelectorAll(".sidebtn").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.add("hide"));$("view-"+b.dataset.view).classList.remove("hide")});
  $("darkBtn").onclick=()=>document.body.classList.toggle("dark");
  $("saveInstituteBtn").onclick=saveInstitute;$("loadInstitutesBtn").onclick=loadInstitutes;
  $("saveExamBtn").onclick=saveExam;$("loadExamsBtn").onclick=loadExams;$("loadQuestionsBtn").onclick=loadQuestions;
  $("loadStudentsBtn").onclick=loadStudents;$("exportStudentsBtn").onclick=exportStudents;
  $("loadResultsBtn").onclick=()=>loadResults(safe($("reportExamId").value));$("exportResultsBtn").onclick=exportResults;
  $("loadStatsBtn").onclick=loadStats;$("dbHealthBtn").onclick=checkDbHealth;
  $("importPdfBtn").onclick=importTextPdf;$("ocrPdfBtn").onclick=ocrPdf;
});
onAuthStateChanged(auth,u=>{$("loginCard").classList.toggle("hide",!!u);$("app").classList.toggle("hide",!u)});

async function saveInstitute(){try{const id=safe($("instId").value);if(!id||!$("instName").value.trim())return alert("Institute ID + Name required");await setDoc(doc(db,"institutes",id),{name:$("instName").value.trim(),adminEmail:$("instEmail").value.trim(),contact:$("instContact").value.trim(),plan:$("instPlan").value,status:$("instStatus").value,themeColor:$("instTheme").value,updatedAt:serverTimestamp()},{merge:true});alert("Institute saved");loadInstitutes()}catch(e){alert("Save institute failed: "+e.message)}}
async function loadInstitutes(){const s=await getDocs(collection(db,"institutes"));let h="";s.forEach(d=>{let x=d.data();h+=`<div class="inst-card"><b>${esc(x.name)}</b> <span class="pill">${d.id}</span><br>${esc(x.status)} | ${esc(x.plan)}</div>`});$("institutesBox").innerHTML=h||"No institutes"}

function parseBits(raw){const qs=[];let cur=null,subject="General";function flush(){if(cur&&cur.o.length===4){if(cur.a==null)cur.a=0;qs.push(cur)}cur=null}String(raw||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach(line=>{if(line.startsWith("*")&&line.endsWith("*")){subject=line.replace(/\*/g,"");return}let ans=line.match(/^answer\s*:\s*([A-D])/i);if(ans&&cur){cur.a="ABCD".indexOf(ans[1].toUpperCase());return}let o=line.match(/^([A-D])[\.)]\s*(.*)$/i);if(o&&cur){let txt=o[2];if(/[●⚫•*]/.test(txt))cur.a="ABCD".indexOf(o[1].toUpperCase());cur.o.push(txt.replace(/[●⚫•*]/g,"").trim());return}if(/^\d+[\.)]/.test(line)){flush();cur={subject,q:line.replace(/^\d+[\.)]\s*/,""),o:[],a:null};return}if(cur)cur.q+="\n"+line});flush();return qs}
function genCodes(n){const a=[];while(a.length<n){const c="KSR"+Math.floor(100000+Math.random()*900000);if(!a.includes(c))a.push(c)}return a}

async function saveExam(){try{const id=safe($("examId").value);let qs=parseBits($("bits").value);const old=await getDoc(doc(db,"exams",id));if(!qs.length&&old.exists())qs=old.data().questions||[];if(!id||!qs.length)return alert("Exam ID + questions required");let st=$("startTime").value?new Date($("startTime").value).toISOString():"",en=$("endTime").value?new Date($("endTime").value).toISOString():"";if(st&&en&&new Date(st)>=new Date(en))return alert("End Time must be after Start Time");await setDoc(doc(db,"exams",id),{title:$("examTitle").value||id,questions:qs,instituteId:safe($("examInstituteId").value),category:$("examCategory").value,startTime:st,endTime:en,passMark:Number($("passMark").value)||35,sec:Number($("sec").value)||45,marks:Number($("marks").value)||1,negativeOn:$("negativeOn").value==="on",negativeMark:Number($("negativeMark").value)||0,updatedAt:serverTimestamp(),version:"L4.0-FINAL"},{merge:true});const codes=genCodes(Number($("count").value)||50);for(const c of codes)await setDoc(doc(db,"exams",id,"codes",c),{code:c,used:false,active:true,createdAt:serverTimestamp()});$("codesBox").textContent=codes.join("\n");alert("Exam saved + codes generated")}catch(e){alert("Save exam failed: "+e.message)}}
async function loadExams(){const s=await getDocs(collection(db,"exams"));let h="";s.forEach(d=>{let x=d.data();h+=`<div class="exam-card"><b>${d.id}</b> ${esc(x.title)}<br>Questions: ${(x.questions||[]).length}<br>Negative: ${x.negativeOn?("ON (-"+x.negativeMark+")"):"OFF"}<br><button class="s" onclick="window.editQuestions('${d.id}')">Questions</button><button class="g" onclick="window.openResults('${d.id}')">Results</button></div>`});$("examsBox").innerHTML=h||"No exams"}

window.editQuestions=id=>{$("qeExamId").value=id;document.querySelector('[data-view="questions"]').click();loadQuestions()};
async function loadQuestions(){currentExamId=safe($("qeExamId").value);const d=await getDoc(doc(db,"exams",currentExamId));if(!d.exists())return alert("Exam not found");currentQuestions=JSON.parse(JSON.stringify(d.data().questions||[]));renderQuestions()}
function renderQuestions(){let h=`<button class="p" onclick="window.addQuestion()">Add Question</button><button class="g" onclick="window.saveQuestions()">Save All</button>`;currentQuestions.forEach((q,i)=>{let o=q.o||["","","",""];h+=`<div class="exam-card"><b>Q${i+1}</b><label>Question</label><textarea id="q_${i}">${esc(q.q)}</textarea><div class="grid"><input id="o_${i}_0" value="${esc(o[0])}"><input id="o_${i}_1" value="${esc(o[1])}"></div><div class="grid"><input id="o_${i}_2" value="${esc(o[2])}"><input id="o_${i}_3" value="${esc(o[3])}"></div><label>Correct Answer</label><select id="a_${i}"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select><button class="d" onclick="window.deleteQuestion(${i})">Delete</button></div>`});$("questionsBox").innerHTML=h||"No questions";currentQuestions.forEach((q,i)=>{$("a_"+i).value=q.a||0})}
function syncQuestions(){currentQuestions=currentQuestions.map((q,i)=>({subject:q.subject||"General",q:$("q_"+i).value,o:[$("o_"+i+"_0").value,$("o_"+i+"_1").value,$("o_"+i+"_2").value,$("o_"+i+"_3").value],a:Number($("a_"+i).value)}))}
window.addQuestion=()=>{try{syncQuestions()}catch(e){}currentQuestions.push({subject:"General",q:"New question?",o:["A","B","C","D"],a:0});renderQuestions()};
window.deleteQuestion=i=>{currentQuestions.splice(i,1);renderQuestions()};
window.saveQuestions=async()=>{syncQuestions();await setDoc(doc(db,"exams",currentExamId),{questions:currentQuestions,updatedAt:serverTimestamp()},{merge:true});alert("Questions saved")};

async function loadStudents(){const s=await getDocs(collection(db,"students"));let h="<table><tr><th>Name</th><th>Phone</th></tr>";s.forEach(d=>{let x=d.data();h+=`<tr><td>${esc(x.name)}</td><td>${esc(x.phone||d.id)}</td></tr>`});$("studentsBox").innerHTML=h+"</table>"}
async function exportStudents(){const s=await getDocs(collection(db,"students")),rows=["Name,Phone"];s.forEach(d=>{let x=d.data();rows.push(`"${x.name||""}","${x.phone||d.id}"`)});csvDownload(rows.join("\n"),"students.csv")}
async function loadResults(id){if(!id)return alert("Enter Exam ID");const ex=await getDoc(doc(db,"exams",id));let passMark=35;if(ex.exists())passMark=Number(ex.data().passMark)||35;const s=await getDocs(collection(db,"exams",id,"attempts"));resultsCache=[];s.forEach(d=>resultsCache.push({attemptId:d.id,...d.data()}));resultsCache=resultsCache.map(r=>{let total=Number(r.total)||0,score=Number(r.score)||0,pct=total?score/total*100:0;return{...r,percentNum:pct,passStatus:pct>=passMark?"PASS":"FAIL",timeTakenSec:Number(r.timeTakenSec)||0}}).sort((a,b)=>b.score-a.score||b.percentNum-a.percentNum||a.timeTakenSec-b.timeTakenSec);let rank=0,ps=null,pp=null,pt=null;resultsCache=resultsCache.map((r,i)=>{if(r.score!==ps||r.percentNum!==pp||r.timeTakenSec!==pt){rank=i+1;ps=r.score;pp=r.percentNum;pt=r.timeTakenSec}return{...r,rank}});let total=resultsCache.length,passed=resultsCache.filter(r=>r.passStatus==="PASS").length,failed=total-passed,highest=total?Math.max(...resultsCache.map(r=>Number(r.score)||0)):0,avg=total?(resultsCache.reduce((a,r)=>a+(Number(r.score)||0),0)/total).toFixed(2):0;$("rankStatsBox").innerHTML=`<div class="stat"><div class="label">Appeared</div><div class="value">${total}</div></div><div class="stat"><div class="label">Passed</div><div class="value">${passed}</div></div><div class="stat"><div class="label">Failed</div><div class="value">${failed}</div></div><div class="stat"><div class="label">Highest</div><div class="value">${highest}</div></div><div class="stat"><div class="label">Average</div><div class="value">${avg}</div></div>`;let lead=`<div class="leader-card"><h3>🏆 Top 10 Leaderboard</h3><table><tr><th>Rank</th><th>Name</th><th>Score</th><th>%</th><th>Time</th></tr>`;resultsCache.slice(0,10).forEach(r=>{let m=r.rank===1?"🥇":r.rank===2?"🥈":r.rank===3?"🥉":"";lead+=`<tr><td><span class="rank-badge">${m} ${r.rank}</span></td><td>${esc(r.name)}</td><td>${r.score||0}/${r.total||0}</td><td>${r.pct||""}</td><td>${fmt(r.timeTakenSec)}</td></tr>`});lead+="</table></div>";$("leaderBox").innerHTML=lead;let h="<table><tr><th>Rank</th><th>Name</th><th>Phone</th><th>Score</th><th>%</th><th>Correct</th><th>Wrong</th><th>Skipped</th><th>Negative</th><th>Status</th></tr>";resultsCache.forEach(r=>h+=`<tr><td>${r.rank}</td><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${r.score||0}/${r.total||0}</td><td>${r.pct||""}</td><td>${r.correct||0}</td><td>${r.wrong||0}</td><td>${r.skipped||0}</td><td>${r.negativeDeducted||0}</td><td class="${r.passStatus==="PASS"?"pass":"fail"}">${r.passStatus}</td></tr>`);$("resultsBox").innerHTML=h+"</table>"}
window.openResults=id=>{document.querySelector('[data-view="reports"]').click();$("reportExamId").value=id;loadResults(id)};
function exportResults(){const rows=["Rank,Name,Phone,Code,Score,Total,Percent,Correct,Wrong,Skipped,Negative,Status"];resultsCache.forEach(r=>rows.push(`${r.rank},"${r.name||""}","${r.phone||""}","${r.code||""}",${r.score||0},${r.total||0},"${r.pct||""}",${r.correct||0},${r.wrong||0},${r.skipped||0},${r.negativeDeducted||0},"${r.passStatus||""}"`));csvDownload(rows.join("\n"),"results_l4_final.csv")}
async function loadStats(){const ex=await getDocs(collection(db,"exams"));let attempts=0,qs=0;for(const d of ex.docs){qs+=(d.data().questions||[]).length;const a=await getDocs(collection(db,"exams",d.id,"attempts"));attempts+=a.size}$("statsBox").innerHTML=`<div class="stat"><div class="label">Exams</div><div class="value">${ex.size}</div></div><div class="stat"><div class="label">Questions</div><div class="value">${qs}</div></div><div class="stat"><div class="label">Attempts</div><div class="value">${attempts}</div></div>`}
async function checkDbHealth(){try{$("dbHealthBox").innerHTML="Checking...";const ex=await getDocs(collection(db,"exams"));$("dbHealthBox").innerHTML=`<b>✅ Firebase Connected</b><br>Exams: ${ex.size}`}catch(e){$("dbHealthBox").innerHTML=`<span class="bad">❌ ${e.message}</span>`}}

function normalizePdfQuestions(text){let t=String(text||"").replace(/\r/g,"\n").replace(/[ \t]+/g," ").replace(/([0-9]+[\.\)])\s*/g,"\n$1 ").replace(/\s+([A-Da-d])[\.\)]\s*/g,"\n$1. ").replace(/\s+(Answer|Ans|Correct Answer|సమాధానం)\s*[:：\-]\s*([A-Da-d])/gi,"\nAnswer: $2\n").replace(/\s+([A-Da-d])\s*[●⚫✔✓]\s*/g,"\nAnswer: $1\n").replace(/\n{2,}/g,"\n").trim();const lines=t.split("\n").map(x=>x.trim()).filter(Boolean),out=[];let n=0;for(const line of lines){if(/^\d+[\.\)]/.test(line)){n++;out.push(line.replace(/^(\d+)[\.\)]\s*/,n+". "))}else if(/^[A-Da-d][\.\)]/.test(line))out.push(line.replace(/^([A-Da-d])[\.\)]\s*/,(m,p)=>p.toUpperCase()+". "));else if(/^(Answer|Ans|Correct Answer|సమాధానం)\s*[:：\-]/i.test(line))out.push(line.replace(/^(Answer|Ans|Correct Answer|సమాధానం)\s*[:：\-]\s*/i,"Answer: "));else if(out.length&&!/^[A-D]\./.test(out[out.length-1])&&!/^Answer:/i.test(out[out.length-1]))out[out.length-1]+=" "+line;else out.push(line)}return out.join("\n")}
function qStats(formatted,raw){const q=(formatted.match(/^\d+\.\s/gm)||[]).length,o=(formatted.match(/^[A-D]\.\s/gm)||[]).length,a=(formatted.match(/^Answer:\s*[A-D]/gmi)||[]).length;if(String(raw||"").trim().length<50)return{q,o,a,cls:"quality-bad",msg:"Scanned/image PDF laga undi. OCR button use cheyyi."};if(q===0||o<q*3)return{q,o,a,cls:"quality-mid",msg:"Partial import. Review required."};if(a<q)return{q,o,a,cls:"quality-mid",msg:"Answers missing. Answer: A/B/C/D add cheyyi."};return{q,o,a,cls:"quality-good",msg:"Good import. Review once."}}
async function importTextPdf(){const fileEl=$("pdfFile"),msgEl=$("pdfImportMsg"),box=$("pdfQualityBox");try{if(!fileEl.files[0])return alert("Please select PDF");msgEl.innerHTML='<span class="pdf-warn">Reading text PDF...</span>';box.classList.remove("hide");box.innerHTML="Checking PDF...";const mod=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs");mod.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";const pdf=await mod.getDocument({data:await fileEl.files[0].arrayBuffer()}).promise;let text="";for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();text+=content.items.map(x=>x.str).join(" ")+"\n"}const formatted=normalizePdfQuestions(text),st=qStats(formatted,text);$("bits").value=formatted||text;msgEl.innerHTML='<span class="pdf-ok">PDF import completed. Review and Save Exam.</span>';box.innerHTML=`<b>PDF Quality Report</b><br>Pages: ${pdf.numPages}<br>Detected Questions: ${st.q}<br>Detected Options: ${st.o}<br>Detected Answers: ${st.a}<br><div class="${st.cls}">${st.msg}</div>`}catch(e){msgEl.innerHTML='<span class="pdf-bad">PDF import failed: '+e.message+'</span>';alert(e.message)}}
async function ocrPdf(){const fileEl=$("pdfFile"),msgEl=$("pdfImportMsg"),box=$("pdfQualityBox");try{if(!fileEl.files[0])return alert("Please select PDF");msgEl.innerHTML='<span class="pdf-warn">OCR starting... slow on mobile.</span>';box.classList.remove("hide");box.innerHTML='<div class="ocr-progress">Loading OCR...</div>';const pdfjs=await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.min.mjs");pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.6.82/pdf.worker.min.mjs";const tess=await import("https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/+esm");const pdf=await pdfjs.getDocument({data:await fileEl.files[0].arrayBuffer()}).promise;const worker=await tess.createWorker(["eng","tel"],1,{logger:m=>{if(m.status)box.innerHTML='<div class="ocr-progress">OCR: '+m.status+' '+(m.progress?Math.round(m.progress*100):'')+'%</div>'}});let text="",max=Math.min(pdf.numPages,35);for(let i=1;i<=max;i++){box.innerHTML='<div class="ocr-progress">OCR Page '+i+' / '+max+'</div>';const page=await pdf.getPage(i),vp=page.getViewport({scale:2}),canvas=document.createElement("canvas"),ctx=canvas.getContext("2d");canvas.width=vp.width;canvas.height=vp.height;await page.render({canvasContext:ctx,viewport:vp}).promise;const r=await worker.recognize(canvas);text+="\n"+(r.data.text||"")}await worker.terminate();const formatted=normalizePdfQuestions(text),st=qStats(formatted,text);$("bits").value=formatted||text;msgEl.innerHTML='<span class="pdf-ok">OCR completed. Review before Save Exam.</span>';box.innerHTML=`<b>OCR Quality Report</b><br>Pages OCR Done: ${max}/${pdf.numPages}<br>Detected Questions: ${st.q}<br>Detected Options: ${st.o}<br>Detected Answers: ${st.a}<div class="ocr-note">OCR mistakes ravachu. Save mundu verify cheyyi.</div>`}catch(e){msgEl.innerHTML='<span class="pdf-bad">OCR failed: '+e.message+'</span>';box.innerHTML='<span class="quality-bad">OCR failed. Smaller PDF or desktop try cheyyi.</span>';alert(e.message)}}


// L4.0 FINAL QUESTION EDITOR FIX - card editor override
async function loadQuestionsEditorFixed(){
  try{
    currentExamId = safe($("qeExamId").value);
    if(!currentExamId) return alert("Enter Exam ID");
    const d = await getDoc(doc(db,"exams",currentExamId));
    if(!d.exists()) return alert("Exam not found");
    currentQuestions = JSON.parse(JSON.stringify(d.data().questions || []));
    renderQuestionsEditorFixed();
  }catch(e){
    alert("Load Questions failed: " + e.message);
  }
}
function renderQuestionsEditorFixed(){
  const box = $("questionsBox");
  if(!box) return;
  let h = `
    <div class="exam-card">
      <button class="p" type="button" onclick="window.addQuestionFixed()">➕ Add Question</button>
      <button class="g" type="button" onclick="window.saveQuestionsFixed()">💾 Save All Questions</button>
      <button class="s" type="button" onclick="window.copyQuestionsToExamTextarea()">📋 Copy to Exam Textarea</button>
      <div class="small">Total Questions: ${currentQuestions.length}</div>
    </div>`;
  if(!currentQuestions.length){
    box.innerHTML = h + `<div class="notice">No questions found. Add new question.</div>`;
    return;
  }
  currentQuestions.forEach((q,i)=>{
    const o = q.o || ["","","",""];
    h += `<div class="exam-card qedit-card">
      <h3>Question ${i+1}</h3>
      <label>Subject</label>
      <input id="sub_${i}" value="${esc(q.subject || 'General')}">
      <label>Question</label>
      <textarea id="q_${i}" class="qedit-text">${esc(q.q || '')}</textarea>
      <div class="grid">
        <div><label>A</label><input id="o_${i}_0" value="${esc(o[0] || '')}"></div>
        <div><label>B</label><input id="o_${i}_1" value="${esc(o[1] || '')}"></div>
      </div>
      <div class="grid">
        <div><label>C</label><input id="o_${i}_2" value="${esc(o[2] || '')}"></div>
        <div><label>D</label><input id="o_${i}_3" value="${esc(o[3] || '')}"></div>
      </div>
      <div class="grid">
        <div><label>Correct Answer</label>
          <select id="a_${i}">
            <option value="0">A</option>
            <option value="1">B</option>
            <option value="2">C</option>
            <option value="3">D</option>
          </select>
        </div>
        <div><label>Action</label><button class="d" type="button" onclick="window.deleteQuestionFixed(${i})">Delete</button></div>
      </div>
    </div>`;
  });
  box.innerHTML = h;
  currentQuestions.forEach((q,i)=>{
    const a = $("a_"+i);
    if(a) a.value = String(Number(q.a)||0);
  });
}
function syncQuestionsFixed(){
  currentQuestions = currentQuestions.map((q,i)=>({
    subject: ($("sub_"+i)?.value || "General").trim(),
    q: ($("q_"+i)?.value || "").trim(),
    o: [
      ($("o_"+i+"_0")?.value || "").trim(),
      ($("o_"+i+"_1")?.value || "").trim(),
      ($("o_"+i+"_2")?.value || "").trim(),
      ($("o_"+i+"_3")?.value || "").trim()
    ],
    a: Number($("a_"+i)?.value || 0)
  })).filter(x => x.q && x.o.some(v=>v));
}
window.addQuestionFixed = function(){
  try{ syncQuestionsFixed(); }catch(e){}
  currentQuestions.push({subject:"General", q:"", o:["","","",""], a:0});
  renderQuestionsEditorFixed();
};
window.deleteQuestionFixed = function(i){
  if(!confirm("Delete this question?")) return;
  syncQuestionsFixed();
  currentQuestions.splice(i,1);
  renderQuestionsEditorFixed();
};
window.saveQuestionsFixed = async function(){
  try{
    if(!currentExamId) currentExamId = safe($("qeExamId").value);
    if(!currentExamId) return alert("Enter Exam ID");
    syncQuestionsFixed();
    if(!currentQuestions.length) return alert("No questions to save");
    await setDoc(doc(db,"exams",currentExamId), {questions: currentQuestions, updatedAt: serverTimestamp()}, {merge:true});
    alert("Questions saved successfully");
    renderQuestionsEditorFixed();
  }catch(e){
    alert("Save Questions failed: " + e.message);
  }
};
window.copyQuestionsToExamTextarea = function(){
  try{
    syncQuestionsFixed();
    const bits = $("bits");
    if(!bits) return alert("Exam textarea not found");
    bits.value = currentQuestions.map((q,i)=>`${i+1}. ${q.q}
A. ${q.o[0]||""}
B. ${q.o[1]||""}
C. ${q.o[2]||""}
D. ${q.o[3]||""}
Answer: ${"ABCD"[Number(q.a)||0]}`).join("\n\n");
    alert("Copied to Exam textarea");
  }catch(e){ alert(e.message); }
};
// override old load button behavior after page load
document.addEventListener("click", function(e){
  if(e.target && e.target.id === "loadQuestionsBtn"){
    e.preventDefault();
    e.stopImmediatePropagation();
    loadQuestionsEditorFixed();
  }
}, true);


// L4.1 CENTRAL QUESTION BANK PRO
let qbankCache = [];
function qbVal(id){ return (document.getElementById(id)?.value || "").trim(); }
function qbSet(id,v){ const e=document.getElementById(id); if(e) e.value = v ?? ""; }
function qbNorm(v){ return String(v||"").toLowerCase().replace(/\s+/g," ").trim(); }
function qbKey(subject, question){
  const raw = qbNorm(subject+"|"+question);
  let enc = btoa(unescape(encodeURIComponent(raw))).replace(/[^A-Za-z0-9]/g,"");
  return "QB_" + enc.slice(0,120);
}
function qbDataFromForm(){
  return {
    subject: qbVal("qbSubject") || "General",
    chapter: qbVal("qbChapter"),
    topic: qbVal("qbTopic"),
    difficulty: qbVal("qbDifficulty") || "Medium",
    tags: qbVal("qbTags").split(",").map(x=>x.trim()).filter(Boolean),
    language: qbVal("qbLanguage") || "Mixed",
    q: qbVal("qbQuestion"),
    o: [qbVal("qbA"), qbVal("qbB"), qbVal("qbC"), qbVal("qbD")],
    a: Number(qbVal("qbAnswer") || 0),
    marks: Number(qbVal("qbMarks") || 1),
    negative: Number(qbVal("qbNegative") || 0),
    explanation: qbVal("qbExplanation")
  };
}
async function saveQBankQuestion(){
  try{
    const data = qbDataFromForm();
    if(!data.subject || !data.q || data.o.some(x=>!x)) return alert("Subject, Question, A/B/C/D options required");
    const id = qbKey(data.subject, data.q);
    const old = await getDoc(doc(db,"questionBank",id));
    if(old.exists() && !confirm("Similar question already exists. Update it?")) return;
    await setDoc(doc(db,"questionBank",id), {...data, duplicateKey:id, usageCount:old.exists()?(old.data().usageCount||0):0, updatedAt:serverTimestamp()}, {merge:true});
    alert("Question saved to Question Bank");
    loadQBank();
  }catch(e){ alert("Question Bank save failed: " + e.message); }
}
async function loadQBank(){
  try{
    const snap = await getDocs(collection(db,"questionBank"));
    qbankCache = [];
    snap.forEach(d=>qbankCache.push({id:d.id,...d.data()}));
    const search = qbNorm(qbVal("qbSearch"));
    const fsub = qbNorm(qbVal("qbFilterSubject"));
    const fchap = qbNorm(qbVal("qbFilterChapter"));
    const ftopic = qbNorm(qbVal("qbFilterTopic"));
    const fdiff = qbVal("qbFilterDifficulty");
    const rows = qbankCache.filter(x=>{
      const hay = qbNorm([x.subject,x.chapter,x.topic,x.q,(x.o||[]).join(" "),(x.tags||[]).join(" "),x.explanation].join(" "));
      if(search && !hay.includes(search)) return false;
      if(fsub && qbNorm(x.subject) !== fsub) return false;
      if(fchap && !qbNorm(x.chapter).includes(fchap)) return false;
      if(ftopic && !qbNorm(x.topic).includes(ftopic)) return false;
      if(fdiff && x.difficulty !== fdiff) return false;
      return true;
    });
    renderQBank(rows);
  }catch(e){ alert("Question Bank load failed: " + e.message); }
}
function renderQBank(rows){
  const stats = $("qbankStats"), box = $("qbankBox");
  if(stats){
    const easy=rows.filter(x=>x.difficulty==="Easy").length, medium=rows.filter(x=>x.difficulty==="Medium").length, hard=rows.filter(x=>x.difficulty==="Hard").length;
    const subjects=[...new Set(rows.map(x=>x.subject||"General"))].length;
    stats.innerHTML = `<div class="stat"><div class="label">Questions</div><div class="value">${rows.length}</div></div><div class="stat"><div class="label">Subjects</div><div class="value">${subjects}</div></div><div class="stat"><div class="label">Easy</div><div class="value">${easy}</div></div><div class="stat"><div class="label">Medium</div><div class="value">${medium}</div></div><div class="stat"><div class="label">Hard</div><div class="value">${hard}</div></div>`;
  }
  if(!box) return;
  if(!rows.length){ box.innerHTML = `<div class="notice">No questions found.</div>`; return; }
  box.innerHTML = rows.map((x,i)=>{
    const o=x.o||["","","",""];
    return `<div class="qbank-card">
      <h3>QB ${i+1}</h3>
      <div class="qbank-meta">Subject: ${esc(x.subject||"General")} | Chapter: ${esc(x.chapter||"-")} | Topic: ${esc(x.topic||"-")} | Difficulty: ${esc(x.difficulty||"-")} | Used: ${x.usageCount||0}</div>
      <div class="qbank-mini"><b>Q:</b> ${esc(x.q||"")}</div>
      <div class="qbank-mini">A) ${esc(o[0]||"")}</div>
      <div class="qbank-mini">B) ${esc(o[1]||"")}</div>
      <div class="qbank-mini">C) ${esc(o[2]||"")}</div>
      <div class="qbank-mini">D) ${esc(o[3]||"")}</div>
      <div class="qbank-mini"><b>Answer:</b> ${"ABCD"[Number(x.a)||0]}</div>
      ${x.explanation ? `<div class="qbank-mini"><b>Explanation:</b> ${esc(x.explanation)}</div>` : ""}
      <div class="qbank-actions">
        <button class="s" type="button" onclick="window.editQBank('${x.id}')">Edit</button>
        <button class="g" type="button" onclick="window.addQBankToExam('${x.id}')">Add to Exam Textarea</button>
      </div>
    </div>`;
  }).join("");
}
window.editQBank = function(id){
  const x = qbankCache.find(q=>q.id===id);
  if(!x) return alert("Question not found");
  qbSet("qbSubject", x.subject); qbSet("qbChapter", x.chapter); qbSet("qbTopic", x.topic);
  qbSet("qbDifficulty", x.difficulty); qbSet("qbTags", (x.tags||[]).join(","));
  qbSet("qbLanguage", x.language || "Mixed"); qbSet("qbQuestion", x.q);
  qbSet("qbA", (x.o||[])[0]); qbSet("qbB", (x.o||[])[1]); qbSet("qbC", (x.o||[])[2]); qbSet("qbD", (x.o||[])[3]);
  qbSet("qbAnswer", String(Number(x.a)||0)); qbSet("qbMarks", String(x.marks||1)); qbSet("qbNegative", String(x.negative||0));
  qbSet("qbExplanation", x.explanation || "");
  window.scrollTo({top:0,behavior:"smooth"});
  alert("Loaded into form. Edit and Save.");
};
window.addQBankToExam = function(id){
  const x = qbankCache.find(q=>q.id===id);
  if(!x) return alert("Question not found");
  const bits = $("bits");
  if(!bits) return alert("Exam textarea not found. Go to Exams tab first.");
  const n = (bits.value.match(/^\d+\./gm)||[]).length + 1;
  const o = x.o || ["","","",""];
  bits.value += `\n${n}. ${x.q}\nA. ${o[0]||""}\nB. ${o[1]||""}\nC. ${o[2]||""}\nD. ${o[3]||""}\nAnswer: ${"ABCD"[Number(x.a)||0]}\n`;
  alert("Question added to Exam textarea");
};
function clearQBankForm(){
  ["qbSubject","qbChapter","qbTopic","qbTags","qbQuestion","qbA","qbB","qbC","qbD","qbExplanation"].forEach(id=>qbSet(id,""));
  qbSet("qbDifficulty","Easy"); qbSet("qbLanguage","Telugu"); qbSet("qbAnswer","0"); qbSet("qbMarks","1"); qbSet("qbNegative","0.25");
}
function exportQBankCsv(){
  const rows = ["Subject,Chapter,Topic,Difficulty,Question,A,B,C,D,Answer,Tags,Explanation"];
  qbankCache.forEach(x=>{
    const o=x.o||[];
    rows.push([x.subject,x.chapter,x.topic,x.difficulty,x.q,o[0],o[1],o[2],o[3],"ABCD"[Number(x.a)||0],(x.tags||[]).join("|"),x.explanation].map(v=>`"${String(v||"").replaceAll('"','""')}"`).join(","));
  });
  csvDownload(rows.join("\n"), "question_bank.csv");
}
document.addEventListener("click", function(e){
  if(!e.target) return;
  if(e.target.id==="saveQBankBtn"){ e.preventDefault(); saveQBankQuestion(); }
  if(e.target.id==="loadQBankBtn"){ e.preventDefault(); loadQBank(); }
  if(e.target.id==="clearQBankBtn"){ e.preventDefault(); clearQBankForm(); }
  if(e.target.id==="exportQBankCsvBtn"){ e.preventDefault(); exportQBankCsv(); }
}, true);


// L4.2 ENTERPRISE QBANK PRO PLUS
let qbankSelected = new Set();

function updateQBankSelectedCount(){
  const el = $("selectedQBankCount");
  if(el) el.textContent = "Selected: " + qbankSelected.size;
  document.querySelectorAll(".qbank-card").forEach(card=>{
    const id = card.getAttribute("data-qbid");
    card.classList.toggle("selected", qbankSelected.has(id));
  });
}
window.toggleQBankSelect = function(id, checked){
  if(checked) qbankSelected.add(id); else qbankSelected.delete(id);
  updateQBankSelectedCount();
};

async function deleteQBankQuestion(id){
  if(!confirm("Delete this Question Bank question?")) return;
  try{
    await setDoc(doc(db,"questionBank",id), {deleted:true, deletedAt:serverTimestamp()}, {merge:true});
    alert("Question deleted/archived");
    qbankSelected.delete(id);
    loadQBank();
  }catch(e){ alert("Delete failed: "+e.message); }
}
window.deleteQBankQuestion = deleteQBankQuestion;

function duplicateQBankQuestion(id){
  const x = qbankCache.find(q=>q.id===id);
  if(!x) return alert("Question not found");
  qbSet("qbSubject", x.subject); qbSet("qbChapter", x.chapter); qbSet("qbTopic", x.topic);
  qbSet("qbDifficulty", x.difficulty); qbSet("qbTags", (x.tags||[]).join(","));
  qbSet("qbLanguage", x.language || "Mixed"); qbSet("qbQuestion", (x.q||"") + " ");
  qbSet("qbA", (x.o||[])[0]); qbSet("qbB", (x.o||[])[1]); qbSet("qbC", (x.o||[])[2]); qbSet("qbD", (x.o||[])[3]);
  qbSet("qbAnswer", String(Number(x.a)||0)); qbSet("qbMarks", String(x.marks||1)); qbSet("qbNegative", String(x.negative||0));
  qbSet("qbExplanation", x.explanation || "");
  alert("Question duplicated into form. Edit and Save.");
}
window.duplicateQBankQuestion = duplicateQBankQuestion;

// Override renderQBank to add select/delete/duplicate buttons and hide deleted
const __oldRenderQBank = renderQBank;
renderQBank = function(rows){
  rows = (rows || []).filter(x=>!x.deleted);
  const stats = $("qbankStats"), box = $("qbankBox");
  if(stats){
    const easy=rows.filter(x=>x.difficulty==="Easy").length, medium=rows.filter(x=>x.difficulty==="Medium").length, hard=rows.filter(x=>x.difficulty==="Hard").length;
    const subjects=[...new Set(rows.map(x=>x.subject||"General"))].length;
    stats.innerHTML = `<div class="stat"><div class="label">Questions</div><div class="value">${rows.length}</div></div><div class="stat"><div class="label">Subjects</div><div class="value">${subjects}</div></div><div class="stat"><div class="label">Easy</div><div class="value">${easy}</div></div><div class="stat"><div class="label">Medium</div><div class="value">${medium}</div></div><div class="stat"><div class="label">Hard</div><div class="value">${hard}</div></div>`;
  }
  if(!box) return;
  if(!rows.length){ box.innerHTML = `<div class="notice">No questions found.</div>`; updateQBankSelectedCount(); return; }
  box.innerHTML = rows.map((x,i)=>{
    const o=x.o||["","","",""];
    const checked = qbankSelected.has(x.id) ? "checked" : "";
    return `<div class="qbank-card" data-qbid="${x.id}">
      <div class="qbank-head">
        <h3><input class="qbank-check" type="checkbox" ${checked} onchange="window.toggleQBankSelect('${x.id}',this.checked)"> QB ${i+1}</h3>
        <span class="pill">${esc(x.difficulty||"-")}</span>
      </div>
      <div class="qbank-meta">Subject: ${esc(x.subject||"General")} | Chapter: ${esc(x.chapter||"-")} | Topic: ${esc(x.topic||"-")} | Used: ${x.usageCount||0}</div>
      <div class="qbank-mini"><b>Q:</b> ${esc(x.q||"")}</div>
      <div class="qbank-mini">A) ${esc(o[0]||"")}</div>
      <div class="qbank-mini">B) ${esc(o[1]||"")}</div>
      <div class="qbank-mini">C) ${esc(o[2]||"")}</div>
      <div class="qbank-mini">D) ${esc(o[3]||"")}</div>
      <div class="qbank-mini"><b>Answer:</b> ${"ABCD"[Number(x.a)||0]}</div>
      ${x.explanation ? `<div class="qbank-mini"><b>Explanation:</b> ${esc(x.explanation)}</div>` : ""}
      <div class="qbank-actions">
        <button class="s" type="button" onclick="window.editQBank('${x.id}')">Edit</button>
        <button class="s" type="button" onclick="window.duplicateQBankQuestion('${x.id}')">Duplicate</button>
        <button class="g" type="button" onclick="window.addQBankToExam('${x.id}')">Add to Exam</button>
        <button class="d" type="button" onclick="window.deleteQBankQuestion('${x.id}')">Delete</button>
      </div>
    </div>`;
  }).join("");
  updateQBankSelectedCount();
};

async function loadAllQBankForBuilder(){
  const snap = await getDocs(collection(db,"questionBank"));
  const arr = [];
  snap.forEach(d=>arr.push({id:d.id,...d.data()}));
  qbankCache = arr.filter(x=>!x.deleted);
  return qbankCache;
}

function qbankToBits(rows){
  return rows.map((x,i)=>{
    const o=x.o||["","","",""];
    return `${i+1}. ${x.q||""}
A. ${o[0]||""}
B. ${o[1]||""}
C. ${o[2]||""}
D. ${o[3]||""}
Answer: ${"ABCD"[Number(x.a)||0]}`;
  }).join("\n\n");
}

async function addSelectedQBankToExam(){
  try{
    if(!qbankCache.length) await loadAllQBankForBuilder();
    const rows = qbankCache.filter(x=>qbankSelected.has(x.id) && !x.deleted);
    if(!rows.length) return alert("Select questions first");
    const bits = $("bits");
    if(!bits) return alert("Exam textarea not found");
    const start = (bits.value.match(/^\d+\./gm)||[]).length;
    const text = rows.map((x,i)=>{
      const o=x.o||["","","",""];
      return `${start+i+1}. ${x.q||""}
A. ${o[0]||""}
B. ${o[1]||""}
C. ${o[2]||""}
D. ${o[3]||""}
Answer: ${"ABCD"[Number(x.a)||0]}`;
    }).join("\n\n");
    bits.value += (bits.value.trim() ? "\n\n" : "") + text;
    alert(rows.length + " questions added to Exam textarea");
  }catch(e){ alert("Add selected failed: "+e.message); }
}

async function deleteSelectedQBank(){
  try{
    if(!qbankSelected.size) return alert("Select questions first");
    if(!confirm("Delete selected "+qbankSelected.size+" questions?")) return;
    for(const id of qbankSelected){
      await setDoc(doc(db,"questionBank",id), {deleted:true, deletedAt:serverTimestamp()}, {merge:true});
    }
    qbankSelected.clear();
    alert("Selected questions deleted/archived");
    loadQBank();
  }catch(e){ alert("Delete selected failed: "+e.message); }
}

async function generateExamFromQBank(){
  try{
    const all = await loadAllQBankForBuilder();
    const sub = qbNorm(qbVal("buildSubject"));
    const chap = qbNorm(qbVal("buildChapter"));
    const topic = qbNorm(qbVal("buildTopic"));
    const diff = qbVal("buildDifficulty");
    const count = Number(qbVal("buildCount")||20);
    let rows = all.filter(x=>{
      if(sub && qbNorm(x.subject)!==sub) return false;
      if(chap && !qbNorm(x.chapter).includes(chap)) return false;
      if(topic && !qbNorm(x.topic).includes(topic)) return false;
      if(diff && x.difficulty!==diff) return false;
      return true;
    });
    if(qbVal("buildShuffle")==="on"){
      for(let i=rows.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [rows[i],rows[j]]=[rows[j],rows[i]]; }
    }
    rows = rows.slice(0,count);
    if(!rows.length) return alert("No questions matched filters");
    const bits = $("bits");
    if(!bits) return alert("Exam textarea not found");
    bits.value = qbankToBits(rows);
    alert("Generated "+rows.length+" questions into Exam textarea. Go to Exams tab and Save Exam.");
  }catch(e){ alert("Generate failed: "+e.message); }
}

document.addEventListener("click", function(e){
  if(!e.target) return;
  if(e.target.id==="selectAllQBankBtn"){ e.preventDefault(); qbankCache.filter(x=>!x.deleted).forEach(x=>qbankSelected.add(x.id)); updateQBankSelectedCount(); renderQBank(qbankCache); }
  if(e.target.id==="clearSelectQBankBtn"){ e.preventDefault(); qbankSelected.clear(); updateQBankSelectedCount(); renderQBank(qbankCache); }
  if(e.target.id==="addSelectedQBankBtn"){ e.preventDefault(); addSelectedQBankToExam(); }
  if(e.target.id==="deleteSelectedQBankBtn"){ e.preventDefault(); deleteSelectedQBank(); }
  if(e.target.id==="generateFromQBankBtn"){ e.preventDefault(); generateExamFromQBank(); }
}, true);


// L4.3 ENTERPRISE PART-1 ADVANCED QBANK
async function toggleFavoriteQBank(id){
  try{
    const x=qbankCache.find(q=>q.id===id);
    const fav=!(x&&x.favorite);
    await setDoc(doc(db,"questionBank",id),{favorite:fav,updatedAt:serverTimestamp()},{merge:true});
    if(x)x.favorite=fav;
    renderQBank((qbankCache||[]).filter(x=>!x.deleted));
  }catch(e){alert("Favorite failed: "+e.message)}
}
window.toggleFavoriteQBank=toggleFavoriteQBank;

const __renderQBankL42Backup = renderQBank;
renderQBank = function(rows){
  rows=(rows||[]).filter(x=>!x.deleted);
  const stats=$("qbankStats"), box=$("qbankBox");
  if(stats){
    const easy=rows.filter(x=>x.difficulty==="Easy").length, med=rows.filter(x=>x.difficulty==="Medium").length, hard=rows.filter(x=>x.difficulty==="Hard").length, fav=rows.filter(x=>x.favorite).length;
    stats.innerHTML=`<div class="stat"><div class="label">Questions</div><div class="value">${rows.length}</div></div><div class="stat"><div class="label">Favorites</div><div class="value">${fav}</div></div><div class="stat"><div class="label">Easy</div><div class="value">${easy}</div></div><div class="stat"><div class="label">Medium</div><div class="value">${med}</div></div><div class="stat"><div class="label">Hard</div><div class="value">${hard}</div></div>`;
  }
  if(!box)return;
  if(!rows.length){box.innerHTML=`<div class="notice">No questions found.</div>`;updateQBankSelectedCount();return;}
  box.innerHTML=rows.map((x,i)=>{
    const o=x.o||["","","",""], checked=qbankSelected.has(x.id)?"checked":"", favCls=x.favorite?"fav-active":"fav-star";
    return `<div class="qbank-card" data-qbid="${x.id}">
      <div class="qbank-head"><h3><input class="qbank-check" type="checkbox" ${checked} onchange="window.toggleQBankSelect('${x.id}',this.checked)"> QB ${i+1}</h3><span><button class="${favCls}" type="button" onclick="window.toggleFavoriteQBank('${x.id}')">⭐</button> <span class="pill">${esc(x.difficulty||"-")}</span></span></div>
      <div class="qbank-meta">Subject: ${esc(x.subject||"General")} | Chapter: ${esc(x.chapter||"-")} | Topic: ${esc(x.topic||"-")} | Used: ${x.usageCount||0}</div>
      <div class="qbank-mini"><b>Q:</b> ${esc(x.q||"")}</div>
      <div class="qbank-mini">A) ${esc(o[0]||"")}</div><div class="qbank-mini">B) ${esc(o[1]||"")}</div><div class="qbank-mini">C) ${esc(o[2]||"")}</div><div class="qbank-mini">D) ${esc(o[3]||"")}</div>
      <div class="qbank-mini"><b>Answer:</b> ${"ABCD"[Number(x.a)||0]}</div>${x.explanation?`<div class="qbank-mini"><b>Explanation:</b> ${esc(x.explanation)}</div>`:""}
      <div class="qbank-actions"><button class="s" onclick="window.editQBank('${x.id}')">Edit</button><button class="s" onclick="window.duplicateQBankQuestion('${x.id}')">Duplicate</button><button class="g" onclick="window.addQBankToExam('${x.id}')">Add to Exam</button><button class="d" onclick="window.deleteQBankQuestion('${x.id}')">Delete</button></div>
    </div>`;
  }).join("");
  updateQBankSelectedCount();
};

function shuffleQ(rows){rows=[...rows];for(let i=rows.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[rows[i],rows[j]]=[rows[j],rows[i]]}return rows}
function filterBalanced(rows,sub,chap,topic,diff){
  return rows.filter(x=>!x.deleted && (!sub||qbNorm(x.subject)===sub) && (!chap||qbNorm(x.chapter).includes(chap)) && (!topic||qbNorm(x.topic).includes(topic)) && (!diff||x.difficulty===diff));
}
async function generateBalancedPaper(){
  try{
    const all=await loadAllQBankForBuilder(), sub=qbNorm(qbVal("balancedSubject")), chap=qbNorm(qbVal("balancedChapter")), topic=qbNorm(qbVal("balancedTopic"));
    const picked=[...shuffleQ(filterBalanced(all,sub,chap,topic,"Easy")).slice(0,Number(qbVal("easyCount")||0)),...shuffleQ(filterBalanced(all,sub,chap,topic,"Medium")).slice(0,Number(qbVal("mediumCount")||0)),...shuffleQ(filterBalanced(all,sub,chap,topic,"Hard")).slice(0,Number(qbVal("hardCount")||0))];
    if(!picked.length)return alert("No questions matched filters");
    $("bits").value=qbankToBits(shuffleQ(picked));
    alert("Balanced paper generated: "+picked.length+" questions. Go to Exams tab and Save Exam.");
  }catch(e){alert("Balanced generate failed: "+e.message)}
}
async function loadQBankAnalytics(){
  try{
    const rows=(await loadAllQBankForBuilder()).filter(x=>!x.deleted), subjects={}, chapters={};
    rows.forEach(x=>{subjects[x.subject||"General"]=(subjects[x.subject||"General"]||0)+1;chapters[x.chapter||"-"]=(chapters[x.chapter||"-"]||0)+1});
    $("qbankAnalyticsBox").innerHTML=`<div class="stat"><div class="label">Total QB</div><div class="value">${rows.length}</div></div><div class="stat"><div class="label">Favorites</div><div class="value">${rows.filter(x=>x.favorite).length}</div></div><div class="stat"><div class="label">Subjects</div><div class="value">${Object.keys(subjects).length}</div></div><div class="stat"><div class="label">Chapters</div><div class="value">${Object.keys(chapters).length}</div></div>`;
    $("qbankSubjectStats").innerHTML="<h3>Subject-wise Count</h3>"+Object.entries(subjects).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="subject-stat"><b>${esc(k)}</b>: ${v}</div>`).join("");
  }catch(e){alert("Analytics failed: "+e.message)}
}
function exportQBankJson(){
  const data=(qbankCache||[]).filter(x=>!x.deleted);
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));a.download="ksr_question_bank_backup.json";a.click();
}
async function importQBankJson(){
  try{
    const file=$("importQBankJsonFile")?.files?.[0];if(!file)return alert("Select JSON backup file");
    const data=JSON.parse(await file.text());if(!Array.isArray(data))return alert("Invalid JSON backup");
    let count=0;for(const x of data){if(!x.q||!x.o)continue;const id=x.id||qbKey(x.subject||"General",x.q);const clean={...x};delete clean.id;await setDoc(doc(db,"questionBank",id),{...clean,importedAt:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});count++}
    $("backupMsg").innerHTML=`<span class="ok">Imported ${count} questions.</span>`;alert("Imported "+count+" questions");loadQBank();
  }catch(e){$("backupMsg").innerHTML=`<span class="bad">${e.message}</span>`;alert("Import failed: "+e.message)}
}
document.addEventListener("click",function(e){
  if(!e.target)return;
  if(e.target.id==="balancedGenerateBtn"){e.preventDefault();generateBalancedPaper()}
  if(e.target.id==="loadQBankAnalyticsBtn"){e.preventDefault();loadQBankAnalytics()}
  if(e.target.id==="exportQBankJsonBtn"){e.preventDefault();exportQBankJson()}
  if(e.target.id==="importQBankJsonBtn"){e.preventDefault();importQBankJson()}
},true);


// L4.4 ENTERPRISE PART-2 PDF OMR TOOLS
function htmlEsc(v){ return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;"); }
function openPrintWindow(title, bodyHtml){
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${htmlEsc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
  body{font-family:Arial,'Noto Sans Telugu',sans-serif;background:#eee;margin:0;color:#111}
  .page{width:210mm;min-height:297mm;margin:10px auto;background:white;padding:14mm;box-sizing:border-box}
  .head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
  .brand{font-size:24px;font-weight:900}.sub{font-size:14px;margin-top:4px}
  .meta{display:flex;justify-content:space-between;gap:10px;border:1px solid #999;padding:8px;margin:10px 0;font-size:13px}
  .q{margin:12px 0;page-break-inside:avoid;font-size:14px;line-height:1.45}.q b{font-size:15px}
  .opts{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}
  .inst{border:1px solid #999;padding:10px;margin:12px 0;font-size:13px;line-height:1.5}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #111;padding:5px;font-size:12px;text-align:left}
  .omr-row{display:flex;align-items:center;gap:8px;margin:5px 0;font-size:12px}.bubble{display:inline-block;width:15px;height:15px;border:2px solid #111;border-radius:50%;margin:0 3px}.omr-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .sign{display:flex;justify-content:space-between;margin-top:30px}
  @media print{body{background:white}.page{margin:0;width:auto;min-height:auto;box-shadow:none}.noprint{display:none}}
  </style></head><body>${bodyHtml}<div class="noprint" style="text-align:center;margin:20px"><button onclick="print()" style="padding:12px 20px;font-weight:900">Print / Save PDF</button></div></body></html>`);
  w.document.close();
}
async function getExamForPrint(id){
  const d = await getDoc(doc(db,"exams",id));
  if(!d.exists()) throw new Error("Exam not found");
  return d.data();
}
async function generateQuestionPaper(){
  try{
    const id = safe($("printExamId").value);
    if(!id) return alert("Enter Exam ID");
    const ex = await getExamForPrint(id);
    const inst = $("printInstituteName").value || "KSR Online Exam Platform";
    const showKey = $("printShowKey").value === "yes";
    const showInst = $("printInstructions").value === "yes";
    const qs = ex.questions || [];
    let qhtml = qs.map((q,i)=>{
      const o=q.o||[];
      return `<div class="q"><b>${i+1}. ${htmlEsc(q.q)}</b>
      <div class="opts"><div>A) ${htmlEsc(o[0]||"")}</div><div>B) ${htmlEsc(o[1]||"")}</div><div>C) ${htmlEsc(o[2]||"")}</div><div>D) ${htmlEsc(o[3]||"")}</div></div>
      ${showKey?`<div><b>Answer:</b> ${"ABCD"[Number(q.a)||0]}</div>`:""}</div>`;
    }).join("");
    const instHtml = showInst ? `<div class="inst"><b>Instructions:</b><br>1. Read all questions carefully.<br>2. Each question has four options A, B, C, D.<br>3. Negative marking: ${ex.negativeOn?("Yes, -"+ex.negativeMark):"No"}.<br>4. Total Questions: ${qs.length}. Marks/Question: ${ex.marks||1}.</div>` : "";
    const body = `<div class="page"><div class="head"><div class="brand">${htmlEsc(inst)}</div><div class="sub">${htmlEsc(ex.title||id)} - ${htmlEsc($("printPaperType").value)}</div></div>
    <div class="meta"><div><b>Exam ID:</b> ${id}</div><div><b>Total Questions:</b> ${qs.length}</div><div><b>Date:</b> ${new Date().toLocaleDateString()}</div></div>
    ${instHtml}${qhtml}<div class="sign"><div>Student Signature</div><div>Invigilator Signature</div></div></div>`;
    openPrintWindow("Question Paper "+id, body);
  }catch(e){ alert("Question paper failed: "+e.message); }
}
async function generateAnswerKey(){
  try{
    const id = safe($("printExamId").value);
    if(!id) return alert("Enter Exam ID");
    const ex = await getExamForPrint(id);
    const qs = ex.questions || [];
    let rows = qs.map((q,i)=>`<tr><td>${i+1}</td><td>${"ABCD"[Number(q.a)||0]}</td><td>${htmlEsc(q.subject||"General")}</td></tr>`).join("");
    const body = `<div class="page"><div class="head"><div class="brand">Answer Key</div><div class="sub">${htmlEsc(ex.title||id)} (${id})</div></div><table><tr><th>Q.No</th><th>Answer</th><th>Subject</th></tr>${rows}</table></div>`;
    openPrintWindow("Answer Key "+id, body);
  }catch(e){ alert("Answer key failed: "+e.message); }
}
function generateOMR(){
  const count = Number($("omrCount").value)||100;
  const examId = safe($("omrExamId").value)||"-";
  const hall = $("omrHallTicket").value || "";
  let rows = "";
  for(let i=1;i<=count;i++){
    rows += `<div class="omr-row"><b>${String(i).padStart(3,"0")}</b> <span>A</span><span class="bubble"></span> <span>B</span><span class="bubble"></span> <span>C</span><span class="bubble"></span> <span>D</span><span class="bubble"></span></div>`;
  }
  const body = `<div class="page"><div class="head"><div class="brand">KSR OMR Answer Sheet</div><div class="sub">Exam ID: ${examId}</div></div>
  <div class="meta"><div><b>Hall Ticket:</b> ${htmlEsc(hall)}</div><div><b>Name:</b> __________________</div><div><b>Phone:</b> __________________</div></div>
  <div class="inst">Fill bubbles clearly with black/blue pen. Do not overwrite. Total Questions: ${count}</div>
  <div class="omr-grid">${rows}</div>
  <div class="sign"><div>Student Signature</div><div>Invigilator Signature</div></div></div>`;
  openPrintWindow("OMR Sheet "+examId, body);
}
async function generateAdminHallTicket(){
  const name = $("htName").value.trim() || "Student";
  const ph = $("htPhone").value.trim() || "-";
  const exId = safe($("htExamId").value) || "-";
  const exCode = safe($("htCode").value) || "-";
  const photo = $("htPhoto").value.trim();
  let title="-", st="-", en="-";
  try{
    const d=await getDoc(doc(db,"exams",exId));
    if(d.exists()){const e=d.data();title=e.title||exId;if(e.startTime)st=new Date(e.startTime).toLocaleString();if(e.endTime)en=new Date(e.endTime).toLocaleString();}
  }catch(e){}
  const vid="KSR-VFY-"+exId+"-"+(ph.replace(/\D/g,"").slice(-4)||"0000")+"-"+Date.now().toString().slice(-6);
  const hall="KSR-"+exId+"-"+(ph.replace(/\D/g,"").slice(-4)||"0000")+"-"+Date.now().toString().slice(-5);
  const qr="https://api.qrserver.com/v1/create-qr-code/?size=170x170&data="+encodeURIComponent(`KSR Hall Ticket\nName:${name}\nPhone:${ph}\nExam:${exId}\nCode:${exCode}\nVerify:${vid}`);
  const photoHtml=photo?`<img src="${htmlEsc(photo)}" style="width:110px;height:130px;object-fit:cover;border:2px solid #0b57d0;border-radius:10px">`:`<div style="width:110px;height:130px;border:2px dashed #999;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:900">PHOTO</div>`;
  const body = `<div class="page"><div class="head"><div class="brand">KSR Online Exam Platform</div><div class="sub">Hall Ticket</div></div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin:15px 0">${photoHtml}<div style="text-align:center"><img src="${qr}"><br><b>Scan to Verify</b></div></div>
  <table><tr><th>Hall Ticket No</th><td>${hall}</td></tr><tr><th>Verification ID</th><td>${vid}</td></tr><tr><th>Student Name</th><td>${htmlEsc(name)}</td></tr><tr><th>Phone</th><td>${htmlEsc(ph)}</td></tr><tr><th>Exam Title</th><td>${htmlEsc(title)}</td></tr><tr><th>Exam ID</th><td>${exId}</td></tr><tr><th>Exam Code</th><td>${exCode}</td></tr><tr><th>Start Time</th><td>${st}</td></tr><tr><th>End Time</th><td>${en}</td></tr></table>
  <div class="inst"><b>Instructions:</b><br>1. Carry this hall ticket.<br>2. Do not refresh/close browser during exam.<br>3. Submit before time ends.</div><div class="sign"><div>Student Signature</div><div>Invigilator Signature</div></div></div>`;
  openPrintWindow("Hall Ticket "+name, body);
}
document.addEventListener("click", function(e){
  if(!e.target) return;
  if(e.target.id==="generatePaperBtn"){ e.preventDefault(); generateQuestionPaper(); }
  if(e.target.id==="generateAnswerKeyBtn"){ e.preventDefault(); generateAnswerKey(); }
  if(e.target.id==="generateOmrBtn"){ e.preventDefault(); generateOMR(); }
  if(e.target.id==="generateHallTicketAdminBtn"){ e.preventDefault(); generateAdminHallTicket(); }
}, true);


// L4.5 PROFESSIONAL PRINT PACK OVERRIDES
function ksrPrintCss(){
  return `<style>
  body{font-family:Arial,'Noto Sans Telugu',sans-serif;background:#e5e7eb;margin:0;color:#111}
  .page{width:210mm;min-height:297mm;margin:10px auto;background:white;padding:12mm;box-sizing:border-box;position:relative;overflow:hidden}
  .wm{position:absolute;top:42%;left:12%;font-size:70px;font-weight:900;color:#000;opacity:.04;transform:rotate(-25deg);z-index:0;white-space:nowrap}
  .content{position:relative;z-index:1}
  .head{display:flex;align-items:center;gap:12px;border-bottom:3px solid #0b57d0;padding-bottom:10px;margin-bottom:12px}
  .logo{width:62px;height:62px;object-fit:contain;border:1px solid #ddd;border-radius:8px}
  .brand{font-size:24px;font-weight:900;color:#0b57d0}.sub{font-size:14px;font-weight:700;margin-top:3px}
  .meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;border:1px solid #cbd5e1;border-radius:10px;padding:8px;margin:10px 0;font-size:12px}
  .box{border:1px solid #cbd5e1;border-radius:10px;padding:8px}.lbl{font-size:10px;color:#555;font-weight:900;text-transform:uppercase}.val{font-size:13px;font-weight:800;margin-top:2px}
  .inst{border-left:5px solid #fbbc04;background:#fff8db;border-radius:10px;padding:10px;margin:12px 0;font-size:12px;line-height:1.5}
  .section{background:#eef4ff;border:1px solid #cfe0ff;border-radius:8px;padding:7px 10px;margin:14px 0 8px;font-weight:900;color:#0b57d0}
  .q{margin:10px 0;page-break-inside:avoid;font-size:13px;line-height:1.45}.q b{font-size:14px}.opts{display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;margin-top:6px}
  .footer{position:absolute;bottom:7mm;left:12mm;right:12mm;border-top:1px solid #999;padding-top:4px;font-size:10px;display:flex;justify-content:space-between}
  table{width:100%;border-collapse:collapse}td,th{border:1px solid #111;padding:5px;font-size:12px;text-align:left}th{background:#eef4ff}
  .omr-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px 10px}.omr-row{display:flex;align-items:center;gap:4px;font-size:11px;margin:3px 0}.bubble{display:inline-block;width:13px;height:13px;border:1.8px solid #111;border-radius:50%;margin:0 2px}
  .sign{display:flex;justify-content:space-between;margin-top:22px;font-size:12px}
  .noprint{text-align:center;margin:18px}.noprint button{padding:12px 22px;font-weight:900;border:0;border-radius:10px;background:#0b57d0;color:white}
  @media print{body{background:white}.page{margin:0;width:auto;min-height:297mm}.noprint{display:none}.page{page-break-after:always}}
  </style>`;
}
function ksrOpenPrintPro(title, bodyHtml){
  const w=window.open("","_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${htmlEsc(title)}</title><meta name="viewport" content="width=device-width,initial-scale=1">${ksrPrintCss()}</head><body>${bodyHtml}<div class="noprint"><button onclick="print()">Print / Save PDF</button></div></body></html>`);
  w.document.close();
}
function ksrLogoHtml(){
  const logo = $("printLogoUrl")?.value?.trim() || "";
  return logo ? `<img class="logo" src="${htmlEsc(logo)}">` : `<div class="logo" style="display:flex;align-items:center;justify-content:center;font-weight:900;color:#0b57d0">KSR</div>`;
}
async function generateQuestionPaperPro(){
  try{
    const id=safe($("printExamId").value); if(!id)return alert("Enter Exam ID");
    const ex=await getExamForPrint(id), inst=$("printInstituteName").value||"KSR Online Exam Platform", wm=$("printWatermark")?.value||"KSR";
    const showKey=$("printShowKey").value==="yes", showInst=$("printInstructions").value==="yes", qs=ex.questions||[];
    let currentSub="", qhtml="";
    qs.forEach((q,i)=>{
      const sub=q.subject||"General", o=q.o||[];
      if(sub!==currentSub){currentSub=sub;qhtml+=`<div class="section">${htmlEsc(sub)}</div>`}
      qhtml+=`<div class="q"><b>${i+1}. ${htmlEsc(q.q)}</b><div class="opts"><div>A) ${htmlEsc(o[0]||"")}</div><div>B) ${htmlEsc(o[1]||"")}</div><div>C) ${htmlEsc(o[2]||"")}</div><div>D) ${htmlEsc(o[3]||"")}</div></div>${showKey?`<div><b>Answer:</b> ${"ABCD"[Number(q.a)||0]}</div>`:""}</div>`;
    });
    const instHtml=showInst?`<div class="inst"><b>Instructions:</b><br>1. Read all questions carefully. 2. Each question has four options. 3. Negative marking: ${ex.negativeOn?("Yes, -"+ex.negativeMark):"No"}. 4. Total Questions: ${qs.length}. Marks/Question: ${ex.marks||1}.</div>`:"";
    const body=`<div class="page"><div class="wm">${htmlEsc(wm)}</div><div class="content"><div class="head">${ksrLogoHtml()}<div><div class="brand">${htmlEsc(inst)}</div><div class="sub">${htmlEsc(ex.title||id)} - ${htmlEsc($("printPaperType").value)}</div></div></div><div class="meta"><div class="box"><div class="lbl">Exam ID</div><div class="val">${id}</div></div><div class="box"><div class="lbl">Questions</div><div class="val">${qs.length}</div></div><div class="box"><div class="lbl">Date</div><div class="val">${new Date().toLocaleDateString()}</div></div></div>${instHtml}${qhtml}<div class="sign"><div>Student Signature _____________</div><div>Invigilator Signature _____________</div></div></div><div class="footer"><span>KSR Online Exam Platform</span><span>Generated: ${new Date().toLocaleString()}</span></div></div>`;
    ksrOpenPrintPro("Question Paper "+id,body);
  }catch(e){alert("Question paper failed: "+e.message)}
}
function generateOMRPro(){
  const count=Number($("omrCount").value)||100, examId=safe($("omrExamId").value)||"-", hall=$("omrHallTicket").value||"", inst=$("omrInstituteName")?.value||"KSR Online Exam Platform", name=$("omrCandidateName")?.value||"";
  let rows=""; for(let i=1;i<=count;i++){rows+=`<div class="omr-row"><b>${String(i).padStart(3,"0")}</b> A<span class="bubble"></span> B<span class="bubble"></span> C<span class="bubble"></span> D<span class="bubble"></span></div>`}
  const body=`<div class="page"><div class="content"><div class="head"><div class="logo" style="display:flex;align-items:center;justify-content:center;font-weight:900;color:#0b57d0">KSR</div><div><div class="brand">${htmlEsc(inst)}</div><div class="sub">OMR Answer Sheet</div></div></div><div class="meta"><div class="box"><div class="lbl">Exam ID</div><div class="val">${examId}</div></div><div class="box"><div class="lbl">Hall Ticket</div><div class="val">${htmlEsc(hall)}</div></div><div class="box"><div class="lbl">Candidate</div><div class="val">${htmlEsc(name)||"________________"}</div></div></div><div class="inst">Fill bubbles clearly with black/blue pen. Do not overwrite. Total Questions: ${count}</div><div class="omr-grid">${rows}</div><div class="sign"><div>Student Signature _____________</div><div>Invigilator Signature _____________</div></div></div><div class="footer"><span>KSR OMR Sheet</span><span>${new Date().toLocaleDateString()}</span></div></div>`;
  ksrOpenPrintPro("OMR Sheet "+examId,body);
}
document.addEventListener("click",function(e){
  if(!e.target)return;
  if(e.target.id==="generatePaperBtn"){e.preventDefault();e.stopImmediatePropagation();generateQuestionPaperPro();}
  if(e.target.id==="generateOmrBtn"){e.preventDefault();e.stopImmediatePropagation();generateOMRPro();}
},true);


// L5.0 SPRINT-1 ADMIN LIVE MONITOR
async function loadLiveMonitor(){
  try{
    const examId=safe($("liveExamId").value);if(!examId)return alert("Enter Exam ID");
    const snap=await getDocs(collection(db,"exams",examId,"sessions")), rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));
    const online=rows.filter(r=>r.status==="running").length, submitted=rows.filter(r=>String(r.status||"").includes("submitted")).length, avg=rows.length?Math.round(rows.reduce((a,r)=>a+(Number(r.progress)||0),0)/rows.length):0, viol=rows.reduce((a,r)=>a+(Number(r.violations)||0),0);
    $("liveStatsBox").innerHTML=`<div class="stat"><div class="label">Sessions</div><div class="value">${rows.length}</div></div><div class="stat"><div class="label">Online</div><div class="value">${online}</div></div><div class="stat"><div class="label">Submitted</div><div class="value">${submitted}</div></div><div class="stat"><div class="label">Avg Progress</div><div class="value">${avg}%</div></div><div class="stat"><div class="label">Violations</div><div class="value">${viol}</div></div>`;
    $("liveMonitorBox").innerHTML=rows.map(r=>`<div class="live-card"><b>${esc(r.name||"-")}</b> <span class="pill">${esc(r.code||r.id)}</span><br>Phone: ${esc(r.phone||"-")} | Status: <b>${esc(r.status||"-")}</b><br>Current Q: ${Number(r.currentQuestion||0)+1} / ${r.totalQuestions||"-"} | Progress: ${r.progress||0}% | Remaining: ${fmt(r.remainingTime||0)}<br>Violations: <span class="violation">${r.violations||0}</span> ${r.lastViolation?("| Last: "+esc(r.lastViolation)):""}<br>Last Saved: ${esc(r.updatedAt||"-")}</div>`).join("")||`<div class="notice">No live sessions found.</div>`;
  }catch(e){alert("Live monitor failed: "+e.message)}
}
document.addEventListener("click",function(e){if(e.target&&e.target.id==="loadLiveMonitorBtn"){e.preventDefault();loadLiveMonitor()}},true);


// L5.0 SAVE EXAM PARSER FIX - Telugu/English lenient parser
function normalizeBitsTextL50(txt){
  return String(txt||"")
    .replace(/\r/g,"\n")
    .replace(/[ＡA]\s*[\)\.]/g,"A.")
    .replace(/[ＢB]\s*[\)\.]/g,"B.")
    .replace(/[ＣC]\s*[\)\.]/g,"C.")
    .replace(/[ＤD]\s*[\)\.]/g,"D.")
    .replace(/జవాబు\s*[:：]/gi,"Answer:")
    .replace(/సమాధానం\s*[:：]/gi,"Answer:")
    .replace(/Ans\s*[:：]/gi,"Answer:")
    .replace(/Answer\s*[:：]/gi,"Answer:");
}
function parseBitsL50(txt){
  txt = normalizeBitsTextL50(txt);
  const lines = txt.split("\n").map(x=>x.trim()).filter(Boolean);
  const qs = [];
  let curQ = null, opts = ["","","",""], ans = null, subject = "General";

  function pushQ(){
    if(curQ && curQ.trim() && opts.some(x=>x.trim())){
      let ai = ans;
      if(ai===null || isNaN(ai) || ai<0) ai = 0;
      qs.push({q:curQ.trim(), o:opts.map(x=>x.trim()), a:ai, subject});
    }
    curQ=null; opts=["","","",""]; ans=null;
  }

  for(const line of lines){
    const qMatch = line.match(/^(\d+)[\.\)]\s*(.+)$/);
    const optMatch = line.match(/^([ABCD])[\.\)]\s*(.*)$/i);
    const ansMatch = line.match(/^Answer\s*[:：]\s*([ABCD])/i);
    const subMatch = line.match(/^Subject\s*[:：]\s*(.+)$/i);

    if(subMatch){ subject = subMatch[1].trim() || "General"; continue; }
    if(qMatch){ pushQ(); curQ = qMatch[2].trim(); continue; }
    if(optMatch){
      const idx = "ABCD".indexOf(optMatch[1].toUpperCase());
      opts[idx] = optMatch[2].trim();
      continue;
    }
    if(ansMatch){ ans = "ABCD".indexOf(ansMatch[1].toUpperCase()); continue; }

    if(curQ && !opts.some(Boolean)) curQ += " " + line;
    else if(curQ && opts.some(Boolean)){
      for(let i=3;i>=0;i--){ if(opts[i]){ opts[i] += " " + line; break; } }
    }
  }
  pushQ();
  return qs;
}
try{ parseBits = parseBitsL50; }catch(e){ window.parseBits = parseBitsL50; }

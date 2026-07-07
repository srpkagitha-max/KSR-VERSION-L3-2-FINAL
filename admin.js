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

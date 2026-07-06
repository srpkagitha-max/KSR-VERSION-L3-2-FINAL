import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import { doc, setDoc, getDocs, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
const $=id=>document.getElementById(id);let lastRows=[];
onAuthStateChanged(auth,user=>{if(user){$("loginCard").classList.add("hide");$("app").classList.remove("hide")}else{$("loginCard").classList.remove("hide");$("app").classList.add("hide")}});
$("loginBtn").onclick=async()=>{const email=$("email").value.trim(),pass=$("pass").value.trim();if(!email||!pass)return alert("Email and password required");try{await signInWithEmailAndPassword(auth,email,pass)}catch(e){$("loginMsg").textContent="Login failed: "+e.message}};
$("logoutBtn").onclick=()=>signOut(auth);
document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));btn.classList.add("active");document.querySelectorAll(".view").forEach(v=>v.classList.add("hide"));$("view-"+btn.dataset.view).classList.remove("hide")});
function parseQuestions(text){const blocks=text.split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean),questions=[];blocks.forEach(block=>{const lines=block.split("\n").map(x=>x.trim()).filter(Boolean);if(lines.length<6)return;let q=lines[0].replace(/^\d+[\).\s-]*/,"").trim(),opts=[],ansLetter="A";lines.slice(1).forEach(line=>{const m=line.match(/^([A-Da-d])[\).\s-]+(.+)/);if(m)opts.push(m[2].trim());const a=line.match(/answer\s*[:\-]\s*([A-Da-d])/i);if(a)ansLetter=a[1].toUpperCase()});if(opts.length>=4)questions.push({q,o:opts.slice(0,4),a:"ABCD".indexOf(ansLetter)})});return questions}
function makeCode(){const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let c="";for(let i=0;i<6;i++)c+=chars[Math.floor(Math.random()*chars.length)];return c}
function csvDownload(rows,name){if(!rows.length)return alert("No data");const headers=Object.keys(rows[0]);const csv=[headers.join(",")].concat(rows.map(r=>headers.map(h=>`"${String(r[h]??"").replace(/"/g,'""')}"`).join(","))).join("\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=name;a.click()}
$("saveExamBtn").onclick=async()=>{
 const examId=$("examId").value.trim().toUpperCase(),title=$("examTitle").value.trim();
 const startTime=$("startTime").value?new Date($("startTime").value).toISOString():"";
 const endTime=$("endTime").value?new Date($("endTime").value).toISOString():"";
 const sec=Number($("sec").value)||45,marks=Number($("marks").value)||1,count=Number($("count").value)||20,questions=parseQuestions($("bits").value);
 if(!examId||!title)return alert("Exam ID and title required");
 if(startTime&&endTime&&new Date(endTime)<=new Date(startTime))return alert("End Time must be after Start Time");
 if(!questions.length)return alert("Questions format wrong. Use Answer: A/B/C/D and blank line between questions.");
 try{
  await setDoc(doc(db,"exams",examId),{title,startTime,endTime,sec,marks,questions,updatedAt:serverTimestamp()});
  const codes=[];for(let i=0;i<count;i++){const code=makeCode();codes.push(code);await setDoc(doc(db,"exams",examId,"codes",code),{used:false,createdAt:serverTimestamp()})}
  $("codesBox").textContent="Exam Saved ✅\n\nStart: "+(startTime||"Any time")+"\nEnd: "+(endTime||"No end time")+"\n\nCodes:\n"+codes.join("\n")
 }catch(e){alert("Save failed: "+e.message)}
};
$("loadExamsBtn").onclick=async()=>{try{const snap=await getDocs(collection(db,"exams"));let rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));if(!rows.length){$("examsBox").innerHTML="<p>No exams found.</p>";return}let html='<table class="adminTable"><tr><th>Exam ID</th><th>Title</th><th>Start</th><th>End</th><th>Questions</th><th>Sec/Q</th><th>Marks</th></tr>';rows.forEach(r=>html+=`<tr><td>${r.id}</td><td>${r.title||""}</td><td>${r.startTime?new Date(r.startTime).toLocaleString():"-"}</td><td>${r.endTime?new Date(r.endTime).toLocaleString():"-"}</td><td>${(r.questions||[]).length}</td><td>${r.sec||""}</td><td>${r.marks||""}</td></tr>`);html+="</table>";$("examsBox").innerHTML=html}catch(e){alert("Load exams failed: "+e.message)}};
async function loadAttempts(examId,target){const snap=await getDocs(collection(db,"exams",examId,"attempts"));const rows=[];snap.forEach(d=>rows.push({id:d.id,...d.data()}));rows.sort((a,b)=>(b.score||0)-(a.score||0));lastRows=rows;if(!rows.length){$(target).innerHTML="<p>No results found.</p>";return rows}let html='<table class="adminTable"><tr><th>Rank</th><th>Name</th><th>Phone</th><th>Code</th><th>Score</th><th>%</th><th>Correct</th><th>Wrong</th><th>Attempted</th></tr>';rows.forEach((r,i)=>html+=`<tr><td>${i+1}</td><td>${r.name||""}</td><td>${r.phone||""}</td><td>${r.code||r.id}</td><td>${r.score||0}/${r.total||0}</td><td>${r.pct||""}</td><td>${r.correct||0}</td><td>${r.wrong||0}</td><td>${r.attempted||0}</td></tr>`);html+="</table>";$(target).innerHTML=html;return rows}
$("loadStudentsBtn").onclick=async()=>{const id=$("studentsExamId").value.trim().toUpperCase();if(!id)return alert("Enter Exam ID");try{await loadAttempts(id,"studentsBox")}catch(e){alert("Load students failed: "+e.message)}};
$("loadResultsBtn").onclick=async()=>{const id=$("reportExamId").value.trim().toUpperCase();if(!id)return alert("Enter Exam ID");try{const rows=await loadAttempts(id,"resultsBox");if(rows.length){const avg=Math.round(rows.reduce((s,r)=>s+(r.score||0),0)/rows.length*100)/100;$("rankStatsBox").innerHTML=`<div class="stat">Attempts<br>${rows.length}</div><div class="stat">Top Score<br>${rows[0].score||0}</div><div class="stat">Average<br>${avg}</div><div class="stat">Topper<br>${rows[0].name||"-"}</div>`}}catch(e){alert("Load results failed: "+e.message)}};
$("exportStudentsBtn").onclick=()=>csvDownload(lastRows,"students.csv");$("exportResultsBtn").onclick=()=>csvDownload(lastRows,"results.csv");


import { db } from './firebase-config.js';
import { doc,getDoc,setDoc,serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const $=id=>document.getElementById(id);let Q=[],cur=0,ans=[],rev=[],sec=0,timer=null,examId="",code="",student="",phone="",submitted=false;
$("startBtn").onclick=startExam;$("prevBtn").onclick=()=>{if(cur>0){cur--;showQ()}};$("nextBtn").onclick=()=>{if(cur<Q.length-1){cur++;showQ()}};$("markBtn").onclick=()=>{rev[cur]=!rev[cur];palette()};$("submitBtn").onclick=()=>submit(false);
async function startExam(){examId=$("examId").value.trim().toUpperCase();code=$("code").value.trim();student=$("name").value.trim();phone=$("phone").value.trim();const d=await getDoc(doc(db,"exams",examId));if(!d.exists()){ $("msg").textContent="No exam found"; return;}const e=d.data();Q=e.questions||[]; if(!Q.length){$("msg").textContent="No questions";return}sec=Q.length*(Number(e.sec)||45);ans=Array(Q.length).fill(null);rev=Array(Q.length).fill(false);$("loginCard").classList.add("hide");$("exam").classList.remove("hide");$("examTitle").textContent=e.title||examId;showQ();tick();timer=setInterval(tick,1000)}
function showQ(){const q=Q[cur],o=q.o||[];$("qBox").innerHTML=`<h2>Q${cur+1}. ${q.q}</h2>`+o.map((x,i)=>`<button class="${ans[cur]===i?'p':'s'}" onclick="window.choose(${i})">${"ABCD"[i]}) ${x}</button>`).join("<br>");palette()}
window.choose=i=>{ans[cur]=i;showQ();saveProgress()}
function palette(){$("palette").innerHTML=Q.map((_,i)=>`<button class="${ans[i]!==null?'g':rev[i]?'o':'s'}" onclick="window.gotoQ(${i})">${i+1}</button>`).join("")}
window.gotoQ=i=>{cur=i;showQ()}
function tick(){let m=Math.floor(sec/60),s=sec%60;$("timer").textContent=String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");if(sec--<=0)submit(true)}
async function saveProgress(){try{await setDoc(doc(db,"exams",examId,"sessions",code||phone||student),{student,phone,answers:ans,currentQuestion:cur,remainingTime:sec,updatedAt:serverTimestamp()},{merge:true})}catch(e){}}
async function submit(auto){if(submitted)return;submitted=true;clearInterval(timer);let score=0;Q.forEach((q,i)=>{if(ans[i]===Number(q.a))score+=Number(q.marks||1)});await setDoc(doc(db,"exams",examId,"attempts",(code||phone||student||Date.now()).toString()),{student,phone,code,answers:ans,score,total:Q.length,auto,submittedAt:serverTimestamp()});$("exam").classList.add("hide");$("result").classList.remove("hide");$("result").innerHTML=`<h2>Result</h2><h1>${score} / ${Q.length}</h1>`}
$("hallBtn").onclick=()=>alert("Hall Ticket: "+$("name").value+" | "+$("examId").value)

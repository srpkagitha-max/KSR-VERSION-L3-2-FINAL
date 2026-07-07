let parsed=[]; let activeExam=null;
function $(id){return document.getElementById(id)}
function esc(s){return (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
function parseNow(){
  const res=KSRParserL5.parseQuestions($('rawQuestions').value);
  parsed=res.questions; renderHealth(res); renderIssues(res.issues); renderPreview(parsed); return res;
}
function renderHealth(res){
  const ready=res.issues.filter(x=>x.type!=='auto_numbered').length===0 && res.questions.length>0;
  $('health').innerHTML=`<div>Total Questions: <b>${res.questions.length}</b></div><div>Valid: <b>${res.stats.valid}</b></div><div>Issues: <b>${res.issues.length}</b></div><div class="${ready?'ok':'bad'}">Status: ${ready?'Ready to Publish':'Needs Checking'}</div>`;
}
function renderIssues(list){
  if(!list.length){ $('issues').innerHTML='<div class="okbox">No issues found ✅</div>'; return; }
  $('issues').innerHTML=list.slice(0,80).map(x=>`<div class="issue">Q${x.q||'-'}: ${esc(x.message||x.type)}</div>`).join('');
}
function renderPreview(qs){
  if(!qs.length){ $('preview').innerHTML='<p>No questions parsed yet.</p>'; return; }
  $('preview').innerHTML=qs.map((q,i)=>`<div class="qcard"><b>Q${i+1}. ${esc(q.question)}</b><div class="opts">${['A','B','C','D'].map(k=>`<label class="opt ${q.answer===k?'correct':''}"><input type="radio" disabled> ${k}) ${esc(q.options[k])}</label>`).join('')}</div><div class="mini">Correct: ${q.answer||'Missing'}</div><button onclick="editQ(${i})" class="small">Edit</button><button onclick="delQ(${i})" class="small danger">Delete</button></div>`).join('');
}
function editQ(i){
  const q=parsed[i]; const text=prompt('Edit question text', q.question); if(text!==null) q.question=text.trim();
  ['A','B','C','D'].forEach(k=>{ const v=prompt('Option '+k, q.options[k]||''); if(v!==null) q.options[k]=v.trim(); });
  const a=prompt('Correct Answer A/B/C/D', q.answer||'A'); if(a) q.answer=a.trim().toUpperCase()[0];
  renderPreview(parsed); const res={questions:parsed,issues:KSRParserL5.validateQuestions(parsed).issues,stats:{valid:parsed.length}}; renderHealth(res); renderIssues(res.issues);
}
function delQ(i){ if(confirm('Delete Q'+(i+1)+'?')){ parsed.splice(i,1); parsed.forEach((q,j)=>q.number=j+1); renderPreview(parsed); }}
function saveExam(){
  if(!parsed.length) parseNow(); const val=KSRParserL5.validateQuestions(parsed);
  if(!val.ready && !confirm('Issues unnayi. Still save cheyyala?')) return;
  const exam={id:activeExam?.id,title:$('examTitle').value||'KSR L5 Exam',timeMinutes:parseInt($('examTime').value||'60',10),questions:parsed,createdAt:activeExam?.createdAt||new Date().toISOString()};
  activeExam=KSRStore.saveExam(exam); alert('Exam saved ✅'); renderSaved();
}
function renderSaved(){
  const exams=KSRStore.all(); $('savedList').innerHTML=exams.map(e=>`<div class="saved"><b>${esc(e.title)}</b><br>${e.questions?.length||0} Questions <button class="small" onclick="loadExam('${e.id}')">Load</button><a class="small link" href="index.html?exam=${e.id}">Open</a></div>`).join('')||'<p>No saved exams.</p>';
}
function loadExam(id){ activeExam=KSRStore.getExam(id); if(!activeExam)return; $('examTitle').value=activeExam.title; $('examTime').value=activeExam.timeMinutes; parsed=activeExam.questions||[]; renderPreview(parsed); const issues=KSRParserL5.validateQuestions(parsed).issues; renderHealth({questions:parsed,issues,stats:{valid:parsed.length}}); renderIssues(issues); }
function loadSample(){ $('rawQuestions').value=`*App Exam*\n*App GK*\n\n1. భారత విద్యా వ్యవస్థలో మార్పుల కోసం 1964-66 మధ్య పనిచేసిన కమిషన్ ఏది?\nA) రాధాకృష్ణన్\nB) ముదలియార్\nC) కోఠారి ●\nD) యశ్ పాల్\n\nకింది వాటిలో సరైనది ఏది?\nA) Option 1\nB) Option 2 ⚫\nC) Option 3\nD) Option 4`; parseNow(); }
document.addEventListener('DOMContentLoaded',renderSaved);

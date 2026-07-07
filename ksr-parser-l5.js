/* KSR L5 Enterprise - Smart Question Parser
   Supports: 1./Q1), missing numbers, A)/A./A-, correct marks ● ⚫ ✓ ✔ * ✅, 200+ questions.
*/
(function(){
  const MARKS = ['●','⚫','✓','✔','✅','☑','*'];
  const optRe = /^\s*([A-Da-d])\s*[\)\.\-:：]\s*(.*)$/;
  const qRe = /^\s*(?:Q\s*)?(\d{1,4})\s*[\)\.\-:：]\s*(.*)$/i;
  function clean(s){ return (s||'').replace(/\r/g,'').replace(/\u00a0/g,' ').trim(); }
  function hasMark(s){ return MARKS.some(m => (s||'').includes(m)); }
  function stripMarks(s){ let out=s||''; MARKS.forEach(m=>{ out=out.split(m).join(''); }); return out.trim(); }
  function isHeading(line){
    const t=line.trim();
    if(!t) return true;
    if(/^\*.*\*$/.test(t) && !qRe.test(t) && !optRe.test(t)) return true;
    if(/^(app exam|app gk|app telugu|app psychology|psychology|gk|telugu|english)$/i.test(t.replace(/\*/g,'').trim())) return true;
    return false;
  }
  function normalizeText(raw){
    return (raw||'')
      .replace(/\r/g,'')
      .replace(/[“”]/g,'"')
      .replace(/[‘’]/g,"'")
      .replace(/\u00a0/g,' ')
      .split('\n')
      .map(x=>x.replace(/\s+$/,''))
      .join('\n');
  }
  function startQuestion(line){
    const m=line.match(qRe);
    if(m) return {number:parseInt(m[1],10), text:m[2].trim(), explicit:true};
    return null;
  }
  function parseQuestions(raw){
    const lines = normalizeText(raw).split('\n');
    const questions=[]; const issues=[]; const duplicates=new Map();
    let current=null; let auto=1; let buffer=[];
    function finish(){
      if(!current) return;
      current.question = clean(current.questionParts.join('\n'));
      delete current.questionParts;
      ['A','B','C','D'].forEach(k=>{ if(current.options[k]) current.options[k]=stripMarks(clean(current.options[k])); });
      if(!current.question) issues.push({type:'missing_question_text', q: current.number, message:'Question text missing'});
      ['A','B','C','D'].forEach(k=>{ if(!current.options[k]) issues.push({type:'missing_option', q:current.number, option:k, message:`Option ${k} missing`}); });
      if(!current.answer) issues.push({type:'missing_answer', q:current.number, message:'Correct answer mark missing'});
      const key=current.question.toLowerCase().replace(/\s+/g,' ').slice(0,120);
      if(key){ if(duplicates.has(key)) issues.push({type:'duplicate', q:current.number, duplicateOf:duplicates.get(key), message:'Duplicate question possible'}); else duplicates.set(key,current.number); }
      questions.push(current); current=null;
    }
    function begin(q){
      finish();
      current={ id:'q_'+Date.now()+'_'+Math.random().toString(36).slice(2,8), number:q.number||auto, originalNumber:q.number||null, questionParts:[q.text||''], options:{A:'',B:'',C:'',D:''}, answer:'', marks:1 };
      if(!q.explicit) issues.push({type:'auto_numbered', q:current.number, message:'Question number missing - auto fixed'});
      auto=current.number+1;
    }
    for(const rawLine of lines){
      const line=rawLine.trim();
      if(!line) continue;
      const q=startQuestion(line);
      const opt=line.match(optRe);
      if(q){ begin(q); continue; }
      if(opt && current){
        const key=opt[1].toUpperCase(); let val=opt[2].trim();
        if(hasMark(val)) current.answer=key;
        current.options[key]=stripMarks(val);
        continue;
      }
      if(opt && !current){
        if(buffer.length){ begin({number:auto,text:buffer.join('\n'),explicit:false}); buffer=[]; }
        const key=opt[1].toUpperCase(); let val=opt[2].trim();
        if(hasMark(val)) current.answer=key;
        current.options[key]=stripMarks(val);
        continue;
      }
      if(isHeading(line) && !current) continue;
      if(!current){ buffer.push(line); continue; }
      current.questionParts.push(line);
    }
    if(buffer.length && !current) begin({number:auto,text:buffer.join('\n'),explicit:false});
    finish();
    questions.forEach((q,i)=>q.number=i+1);
    const stats={ total:questions.length, valid:questions.filter(q=>q.question && q.options.A && q.options.B && q.options.C && q.options.D && q.answer).length, issues:issues.length };
    return {questions, issues, stats};
  }
  function validateQuestions(questions){
    const issues=[];
    (questions||[]).forEach((q,i)=>{
      const n=i+1;
      if(!q.question) issues.push({type:'missing_question_text', q:n, message:'Question text missing'});
      ['A','B','C','D'].forEach(k=>{ if(!q.options || !q.options[k]) issues.push({type:'missing_option', q:n, option:k, message:`Option ${k} missing`}); });
      if(!q.answer || !['A','B','C','D'].includes(q.answer)) issues.push({type:'missing_answer', q:n, message:'Correct answer missing'});
    });
    return {issues, ready:issues.length===0, total:(questions||[]).length};
  }
  window.KSRParserL5={parseQuestions, validateQuestions};
})();

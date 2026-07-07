/* KSR L5 Storage - local first, Firebase-ready */
(function(){
  const KEY='KSR_L5_EXAMS';
  function all(){ try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch(e){return[]} }
  function saveAll(x){ localStorage.setItem(KEY, JSON.stringify(x)); }
  function saveExam(exam){
    const exams=all(); exam.id=exam.id||('exam_'+Date.now()); exam.updatedAt=new Date().toISOString();
    const idx=exams.findIndex(e=>e.id===exam.id); if(idx>=0) exams[idx]=exam; else exams.unshift(exam); saveAll(exams); return exam;
  }
  function getExam(id){ return all().find(e=>e.id===id) || all()[0] || null; }
  function deleteExam(id){ saveAll(all().filter(e=>e.id!==id)); }
  window.KSRStore={all, saveExam, getExam, deleteExam};
})();

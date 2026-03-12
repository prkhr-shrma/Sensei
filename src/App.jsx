import { useState, useRef, useEffect, useCallback } from "react";
import { XPV, REV_THRESHOLD, getConfidence, fluencyColor, fluencyLabel, buildPrompt, todayKey, dayType, dayName } from './utils.js';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { P } from './problems.js';

// ─── PROBLEM DESCRIPTION RENDERER ────────────────────────────
function ProbDesc({prob, onLoadExample}){
  return (
    <div>
      <p style={{margin:'0 0 16px',lineHeight:1.8,color:'var(--text2)',fontSize:12}}>{prob.desc}</p>
      {prob.examples?.map((ex,i)=>(
        <div key={i} style={{marginBottom:10,background:'var(--panel2)',borderRadius:4,padding:'10px 12px',border:'1px solid var(--border)'}}>
          <div style={{fontSize:9,fontWeight:700,color:'var(--text4)',marginBottom:6,letterSpacing:0.5}}>EXAMPLE {i+1}</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,lineHeight:1.7}}>
            <div><span style={{color:'var(--text4)'}}>Input: </span><span style={{color:'var(--text)'}}>{ex.input}</span></div>
            <div><span style={{color:'var(--text4)'}}>Output: </span><span style={{color:'var(--text)'}}>{ex.output}</span></div>
            {ex.explanation&&<div style={{marginTop:5,color:'var(--text3)',fontSize:10,lineHeight:1.5,fontFamily:'inherit'}}>{ex.explanation}</div>}
          </div>
          {ex.stdin&&<button onClick={()=>onLoadExample(ex.stdin)}
            style={{marginTop:7,padding:'3px 9px',background:'none',border:'1px solid var(--btn-border)',color:'var(--text3)',borderRadius:3,fontSize:9,cursor:'pointer',fontFamily:'inherit'}}>
            ▶ Load in Test
          </button>}
        </div>
      ))}
      {prob.constraints?.length>0&&(
        <div style={{marginTop:14}}>
          <div style={{fontSize:9,fontWeight:700,color:'var(--text4)',marginBottom:7,letterSpacing:0.5}}>CONSTRAINTS</div>
          <ul style={{margin:0,paddingLeft:14}}>
            {prob.constraints.map((c,i)=>(
              <li key={i} style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,color:'var(--text2)',marginBottom:3,lineHeight:1.6}}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const CATS=[...new Set(P.map(p=>p.cat))];
const DC={Easy:"#4ade80",Medium:"#fb923c",Hard:"#f87171"};
const REV_XP_MULT=2;

// ─── PROBLEM RECOMMENDATION (deterministic, pattern-based) ────
function getRecommendation(pid, solvedSet){
  const cur=P.find(p=>p.id===pid);
  if(!cur) return null;
  const unsolved=p=>p.id!==pid&&!solvedSet.has(p.id);
  const byPat=P.filter(p=>unsolved(p)&&p.pat===cur.pat);
  if(byPat.length){
    const r=byPat[0];
    return `Nice work! Try **${r.title}** next — same **${r.pat}** pattern. [${r.diff}]`;
  }
  const byCat=P.filter(p=>unsolved(p)&&p.cat===cur.cat);
  if(byCat.length){
    const r=byCat[0];
    return `Nice work! Try **${r.title}** next — also in **${r.cat}**. [${r.diff}]`;
  }
  const any=P.find(p=>unsolved(p));
  if(any) return `Nice work! Try **${any.title}** next. [${any.diff}]`;
  return `You've solved everything in this category! 🏆`;
}

// ─── STORAGE (SQLite via server — session auth, localStorage fallback) ───────
async function load(){
  try{const r=await fetch('/api/progress',{credentials:'include'});if(r.ok)return await r.json();}catch{}
  try{const raw=localStorage.getItem('s75v3');return raw?JSON.parse(raw):null;}catch{return null;}
}
async function save(s){
  try{await fetch('/api/progress',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(s)});return;}catch{}
  try{localStorage.setItem('s75v3',JSON.stringify(s));}catch{}
}

// ─── MSG RENDERER ─────────────────────────────────────────────
function Msg({text}){
  const parts=text.split(/(```[\s\S]*?```|\*\*[^*]+\*\*|`[^`]+`)/g);
  return <span>{parts.map((p,i)=>{
    if(p.startsWith("```")&&p.endsWith("```")){
      const c=p.slice(3,-3).replace(/^python\n/,'').replace(/^\n/,'');
      return <pre key={i} style={{background:"var(--code)",border:"1px solid var(--code-border)",borderRadius:5,padding:"7px 10px",fontSize:11,overflowX:"auto",margin:"5px 0",lineHeight:1.5}}><code style={{color:"var(--codetext)"}}>{c}</code></pre>;
    }
    if(p.startsWith("**")&&p.endsWith("**")) return <strong key={i} style={{color:"var(--accent)"}}>{p.slice(2,-2)}</strong>;
    if(p.startsWith("`")&&p.endsWith("`")) return <code key={i} style={{background:"var(--inline-code-bg)",color:"var(--inline-code-color)",padding:"1px 4px",borderRadius:3,fontSize:11}}>{p.slice(1,-1)}</code>;
    return <span key={i}>{p}</span>;
  })}</span>;
}

// ─── ACTIVITY HEATMAP (last 52 weeks, GitHub-style) ──────────
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function heatColor(n){
  if(n===0)return'var(--border)';
  if(n===1)return'#166534';
  if(n===2)return'#15803d';
  if(n===3)return'#16a34a';
  return'#4ade80';
}
function Heatmap({history}){
  // date→count from firstSolved timestamps
  const counts={};
  Object.values(history).forEach(({firstSolved})=>{
    if(!firstSolved)return;
    const d=new Date(firstSolved);
    const k=`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    counts[k]=(counts[k]||0)+1;
  });
  // build 53 week columns ending today
  const today=new Date();today.setHours(0,0,0,0);
  const dow=today.getDay(); // 0=Sun
  const start=new Date(today);
  start.setDate(today.getDate()-(52*7+dow));
  const weeks=[];
  const cur=new Date(start);
  while(cur<=today){
    const week=[];
    for(let d=0;d<7;d++){
      const k=`${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
      week.push({date:new Date(cur),count:counts[k]||0});
      cur.setDate(cur.getDate()+1);
      if(cur>today&&d<6){for(let r=d+1;r<7;r++)week.push({date:null,count:-1});break;}
    }
    weeks.push(week);
  }
  const totalSolves=Object.values(counts).reduce((a,b)=>a+b,0);
  return(
    <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,width:'100%',boxSizing:'border-box'}}>
      <div style={{fontSize:10,color:"var(--text3)",marginBottom:8,display:'flex',justifyContent:'space-between'}}>
        <span>ACTIVITY — last 52 weeks</span>
        <span style={{color:'var(--text4)'}}>{totalSolves} solve{totalSolves!==1?'s':''}</span>
      </div>
      <div style={{overflowX:'auto',paddingBottom:4}}>
        <div style={{display:'flex',gap:2,alignItems:'flex-start',minWidth:'fit-content'}}>
          {/* Day labels col */}
          <div style={{display:'flex',flexDirection:'column',gap:1,marginRight:3,marginTop:16}}>
            {['','Mon','','Wed','','Fri',''].map((label,i)=>(
              <div key={i} style={{height:10,fontSize:7,color:'var(--text4)',lineHeight:'10px',userSelect:'none'}}>{label}</div>
            ))}
          </div>
          {/* Grid */}
          <div style={{display:'flex',flexDirection:'column'}}>
            {/* Month labels */}
            <div style={{display:'flex',gap:2,marginBottom:3,height:13}}>
              {weeks.map((week,wi)=>{
                const d=week.find(c=>c.date)?.date;
                const show=d&&d.getDate()<=7;
                return <div key={wi} style={{width:10,fontSize:7,color:'var(--text4)',overflow:'visible',whiteSpace:'nowrap'}}>{show?MONTHS[d.getMonth()]:''}</div>;
              })}
            </div>
            {/* Week columns */}
            <div style={{display:'flex',gap:2}}>
              {weeks.map((week,wi)=>(
                <div key={wi} style={{display:'flex',flexDirection:'column',gap:1}}>
                  {week.map((cell,di)=>(
                    <div key={di}
                      title={cell.date?`${cell.date.toLocaleDateString()}: ${cell.count} solved`:''}
                      style={{width:10,height:10,borderRadius:2,
                        background:cell.count<0?'transparent':heatColor(cell.count),
                        cursor:cell.count>0?'default':'default',
                        transition:'opacity 0.1s'}}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:3,marginTop:6,justifyContent:'flex-end'}}>
        <span style={{fontSize:8,color:'var(--text4)'}}>Less</span>
        {[0,1,2,3,4].map(n=><div key={n} style={{width:10,height:10,borderRadius:2,background:heatColor(n)}}/>)}
        <span style={{fontSize:8,color:'var(--text4)'}}>More</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function App(){
  const [user,setUser]=useState(undefined); // undefined=loading, null=not authed, obj=authed
  const [boot,setBoot]=useState(true);
  const [prob,setProb]=useState(P[0]);
  const [code,setCode]=useState("# Write your solution here\n\ndef solution():\n    pass\n");
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Pick a problem. Start with brute force."}]);
  const [inp,setInp]=useState("");
  const [aiLoad,setAiLoad]=useState(false);

  // Progress
  const [solved,setSolved]=useState(new Set());
  const [attempted,setAttempted]=useState(new Set());
  const [streak,setStreak]=useState(0);
  const [xp,setXp]=useState(0);
  const [lastDay,setLastDay]=useState(null);
  const [todayDone,setTodayDone]=useState(new Set());
  const [notes,setNotes]=useState({});

  // Revision system
  const [history,setHistory]=useState({}); // {pid: {firstSolved, lastRevised, revCount}}
  const [revMode,setRevMode]=useState(false);
  const [revSecs,setRevSecs]=useState(0);
  const [revRunning,setRevRunning]=useState(false);

  // UI
  const [tab,setTab]=useState("desc");
  const [showSol,setShowSol]=useState(false);
  const [cats,setCats]=useState(new Set(["Array"]));
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [view,setView]=useState("practice");
  const [peekOn,setPeekOn]=useState(true);
  const [peeking,setPeeking]=useState(false);
  const [pendingReview,setPendingReview]=useState(false);
  const [reviewRejected,setReviewRejected]=useState(false);
  const [dk,setDk]=useState(()=>localStorage.getItem('dk')!=='light');
  const [editorFocus,setEditorFocus]=useState(0);
  const [peekTrigger,setPeekTrigger]=useState(0);
  const [testOpen,setTestOpen]=useState(false);
  const [customIn,setCustomIn]=useState("");
  const [testOut,setTestOut]=useState(null);
  const [testLoad,setTestLoad]=useState(false);
  const [leftW,setLeftW]=useState(420);
  const [rightW,setRightW]=useState(300);
  const [testH,setTestH]=useState(180);
  const [timerSecs,setTimerSecs]=useState(0);
  const [timerRunning,setTimerRunning]=useState(false);
  const [timerSolved,setTimerSolved]=useState(false);

  const chatRef=useRef(null);
  const chatInputRef=useRef(null);
  const peekTimer=useRef(null);
  const lastPeeked=useRef({code:"",pid:null});
  const revInterval=useRef(null);
  const shutoffTimer=useRef(null);
  const codeRef=useRef(code);
  const lastPeekAt=useRef(0);
  const peekCount=useRef({pid:null,n:0});
  const nudgeTimerRef=useRef(null);
  const lastChatAt=useRef(0);
  const dragRef=useRef(null);
  const codeSaveTimer=useRef(null);
  const timerRef=useRef(null);
  const hasTyped=useRef(false);
  const TMPL="# Write your solution here\n\ndef solution():\n    pass\n";

  // ── LOAD (check auth first, then load progress) ──
  const applyProgress=useCallback(s=>{
    if(!s) return;
    setSolved(new Set(s.solved||[]));
    setAttempted(new Set(s.attempted||[]));
    setStreak(s.streak||0);
    setXp(s.xp||0);
    setNotes(s.notes||{});
    setHistory(s.history||{});
    const today=todayKey();
    if(s.lastDay===today) setTodayDone(new Set(s.todayDone||[]));
    else{
      const yd=new Date(); yd.setDate(yd.getDate()-1);
      const yk=`${yd.getFullYear()}-${yd.getMonth()}-${yd.getDate()}`;
      if(s.lastDay!==yk&&(s.streak||0)>0) setStreak(0);
      setTodayDone(new Set());
    }
    setLastDay(s.lastDay||null);
  },[]);

  useEffect(()=>{
    fetch('/api/me',{credentials:'include'})
      .then(r=>r.json())
      .then(({user:u})=>{
        setUser(u||null);
        if(u) return load().then(applyProgress);
      })
      .catch(()=>setUser(null))
      .finally(()=>setBoot(false));
  },[]);

  // ── SAVE ──
  useEffect(()=>{
    if(!boot) save({solved:[...solved],attempted:[...attempted],streak,xp,notes,history,todayDone:[...todayDone],lastDay});
  },[solved,attempted,streak,xp,notes,history,todayDone,lastDay,boot]);

  // ── SCROLL ──
  useEffect(()=>{chatRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  // ── REVISION TIMER ──
  useEffect(()=>{
    if(revRunning && revSecs>0){
      revInterval.current=setInterval(()=>{
        setRevSecs(t=>{
          if(t<=1){clearInterval(revInterval.current);setRevRunning(false);return 0;}
          return t-1;
        });
      },1000);
    }
    return()=>clearInterval(revInterval.current);
  },[revRunning]);

  // ── LIVE PEEK ──
  useEffect(()=>{ codeRef.current=code; },[code]);

  useEffect(()=>{
    if(!peekOn||aiLoad||revMode) return;
    const stripped=code.trim();
    if(stripped===TMPL.trim()||stripped.length<30) return;
    if(stripped===lastPeeked.current.code&&prob.id===lastPeeked.current.pid) return;
    // Shorter cooldown if last msg was an unanswered peek
    const lastMsg=msgs[msgs.length-1];
    const hasUnansweredPeek=lastMsg?.peek&&lastMsg?.role==='assistant';
    const cooldown=hasUnansweredPeek?10000:60000;
    if(Date.now()-lastPeekAt.current<cooldown) return;
    // Max 3 peeks per problem
    if(peekCount.current.pid===prob.id&&peekCount.current.n>=3) return;
    clearTimeout(peekTimer.current);
    clearTimeout(shutoffTimer.current);
    setPeeking(true);
    peekTimer.current=setTimeout(async()=>{
      if(aiLoad) return;
      lastPeeked.current={code:stripped,pid:prob.id};
      lastPeekAt.current=Date.now();
      peekCount.current=peekCount.current.pid===prob.id
        ?{pid:prob.id,n:peekCount.current.n+1}
        :{pid:prob.id,n:1};
      setPeeking(false);
      // Include recent chat history so peek is coherent with prior conversation
      const recentChat=msgs.slice(-6).map(m=>({role:m.role,content:m.content}));
      const peekMsgs=[...recentChat,{role:"user",content:`[continuing to edit code]\nMy code so far:\n\`\`\`python\n${stripped}\n\`\`\``}];
      setAiLoad(true);
      try{
        const res=await fetch("/api/messages",{
          method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:40,
            system:buildPrompt(prob,false)+"\n\nLIVE PEEK: student paused. If stuck or barely started, give one tiny nudge or question. If on track, reply exactly: [skip]. Max 1 sentence.",
            messages:peekMsgs})
        });
        const d=await res.json();
        const reply=d.content?.[0]?.text||"";
        if(reply&&reply.trim()!=="[skip]"){
          setMsgs(p=>[...p,{role:"assistant",content:reply,peek:true}]);
          requestAnimationFrame(()=>chatInputRef.current?.focus());
          // Schedule a follow-up nudge after 10s if the student doesn't respond
          clearTimeout(nudgeTimerRef.current);
          nudgeTimerRef.current=setTimeout(()=>setPeekTrigger(n=>n+1),10000);
          const codeAtNudge=stripped;
          shutoffTimer.current=setTimeout(()=>{
            // Stay alive if user has been chatting in the last 5 min
            if(codeRef.current.trim()===codeAtNudge&&Date.now()-lastChatAt.current>5*60*1000){
              clearTimeout(nudgeTimerRef.current);
              setPeekOn(false);
              setMsgs(p=>[...p,{role:"assistant",content:"Looks like you're away or thinking — take your time. Tap 👁 to turn me back on."}]);
            }
          },5*60*1000);
        }
      }catch{}
      finally{setAiLoad(false);}
    },5000);
    return()=>{clearTimeout(peekTimer.current);setPeeking(false);};
  },[code,editorFocus,peekTrigger]);

  useEffect(()=>{
    lastPeeked.current={code:"",pid:prob.id};
    lastPeekAt.current=0;
    peekCount.current={pid:prob.id,n:0};
    clearTimeout(peekTimer.current);clearTimeout(nudgeTimerRef.current);setPeeking(false);
  },[prob.id]);

  useEffect(()=>{
    const onMove=e=>{
      if(!dragRef.current) return;
      const {type,startPos,startSize}=dragRef.current;
      if(type==='left') setLeftW(Math.max(160,startSize+(e.clientX-startPos)));
      else if(type==='right') setRightW(Math.max(200,startSize-(e.clientX-startPos)));
      else if(type==='test') setTestH(Math.max(80,Math.min(400,startSize-(e.clientY-startPos))));
    };
    const onUp=()=>{dragRef.current=null;document.body.style.cursor='';document.body.style.userSelect='';};
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);};
  },[]);

  useEffect(()=>{
    if(timerRunning){
      timerRef.current=setInterval(()=>setTimerSecs(s=>s+1),1000);
    }
    return()=>clearInterval(timerRef.current);
  },[timerRunning]);

  // ── AI CALL ──
  const call=async(text,withCode=false,system=null,maxTok=150)=>{
    if(!text.trim()&&!withCode) return;
    lastChatAt.current=Date.now();
    clearTimeout(shutoffTimer.current);
    clearTimeout(nudgeTimerRef.current);
    const full=withCode?`${text}\n\nMy code:\n\`\`\`python\n${code}\n\`\`\``:text;
    const newMsgs=[...msgs,{role:"user",content:full}];
    setMsgs(newMsgs);setInp("");
    if(chatInputRef.current){chatInputRef.current.style.height="auto";}
    setAiLoad(true);
    try{
      const res=await fetch("/api/messages",{
        method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:maxTok,
          system:system||buildPrompt(prob,revMode),
          messages:newMsgs.map(m=>({role:m.role,content:m.content}))})
      });
      const d=await res.json();
      const reply=d.content?.[0]?.text||(d.error?.message?`[${d.error.type}] ${d.error.message}`:d.error||"No response.");
      setMsgs(p=>[...p,{role:"assistant",content:reply}]);
      if(pendingReview){
        setPendingReview(false);
        if(reply.includes('✓')){
          confirmSolved(prob.id);
          // reset peek so it works on next problem
          peekCount.current={pid:prob.id,n:0};
        } else {
          setReviewRejected(true);
          setTimeout(()=>setReviewRejected(false),2000);
        }
      }
      requestAnimationFrame(()=>chatInputRef.current?.focus());
    }catch(e){
      setMsgs(p=>[...p,{role:"assistant",content:`Network error: ${e.message}`}]);
      setPendingReview(false);
    }
    finally{setAiLoad(false);}
  };

  // ── SELECT PROBLEM ──
  const selectProb=(p)=>{
    if(revMode){setRevMode(false);setRevRunning(false);clearInterval(revInterval.current);}
    clearTimeout(nudgeTimerRef.current);
    const saved=localStorage.getItem(`code_${p.id}`);
    setProb(p);setCode(saved||TMPL);setShowSol(false);setTab("desc");setPendingReview(false);setReviewRejected(false);setTestOut(null);setCustomIn("");
    setAttempted(prev=>new Set([...prev,p.id]));
    setMsgs([{role:"assistant",content:`**${p.title}**. What's your brute force?`}]);
    clearInterval(timerRef.current);setTimerSecs(0);setTimerRunning(false);setTimerSolved(false);hasTyped.current=false;
  };

  // ── START REVISION ──
  const startRevision=(p)=>{
    clearTimeout(nudgeTimerRef.current);
    setProb(p);setRevMode(true);setRevSecs(20*60);setRevRunning(true);
    setCode("# REVISION — no hints. Solve from memory.\n\ndef solution():\n    pass\n");
    setShowSol(false);setTab("desc");setView("practice");
    setMsgs([{role:"assistant",content:`⏱ **Revision.** 20 min. No hints. Go.`}]);
    lastPeeked.current={code:"",pid:p.id};
  };

  // ── MARK SOLVED (practice) — only called after AI confirms with ✓ ──
  const confirmSolved=(pid)=>{
    const today=todayKey();
    setSolved(p=>new Set([...p,pid]));
    setTodayDone(p=>new Set([...p,pid]));
    setXp(p=>p+XPV[prob.diff]);
    if(lastDay!==today){setStreak(p=>p+1);setLastDay(today);}
    setHistory(h=>({...h,[pid]:{firstSolved:Date.now(),lastRevised:Date.now(),revCount:0}}));
    clearInterval(timerRef.current);setTimerRunning(false);setTimerSolved(true);
    // Append recommendation (first solve only — not revision)
    const rec=getRecommendation(pid,solved);
    if(rec) setMsgs(m=>[...m,{role:'assistant',content:rec}]);
  };

  const submitForReview=()=>{
    if(solved.has(prob.id)||pendingReview) return;
    setPendingReview(true);
    call("Please verify my solution.",true,null,300);
  };

  const logout=async()=>{
    await fetch('/api/logout',{method:'POST',credentials:'include'});
    setUser(null);
  };

  const runCode=async(stdin="")=>{
    if(!code.trim()||testLoad) return;
    setTestLoad(true);setTestOut(null);
    try{
      const r=await fetch('/api/run',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,stdin})});
      const d=await r.json();
      setTestOut(d);
    }catch(e){setTestOut({stdout:'',stderr:e.message,exitCode:-1});}
    finally{setTestLoad(false);}
  };

  // ── MARK REVISION SOLVED ──
  const markRevSolved=()=>{
    const pid=prob.id;
    const today=todayKey();
    const elapsed=20*60-revSecs;
    const cold=elapsed<15*60; // solved in under 15 min = clean cold solve
    const bonus=cold?REV_XP_MULT:1;
    setXp(p=>p+XPV[prob.diff]*bonus);
    setTodayDone(p=>new Set([...p,pid]));
    if(lastDay!==today){setStreak(p=>p+1);setLastDay(today);}
    setHistory(h=>({...h,[pid]:{...(h[pid]||{}),lastRevised:Date.now(),revCount:(h[pid]?.revCount||0)+1}}));
    setRevMode(false);setRevRunning(false);clearInterval(revInterval.current);
    const msg=cold?`✓ Cold solve in ${Math.floor(elapsed/60)}m — **${XPV[prob.diff]*bonus}xp** (${bonus}x). What's the time complexity?`:`✓ Solved. **${XPV[prob.diff]}xp**. Took a while — revisit sooner next time.`;
    setMsgs(p=>[...p,{role:"assistant",content:msg}]);
  };

  // ── DERIVED ──
  const conf=pid=>getConfidence(history,pid);
  const dueProblems=P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)<REV_THRESHOLD);
  const freshProblems=P.filter(p=>solved.has(p.id)&&(conf(p.id)||100)>=REV_THRESHOLD);
  const revQueue=[...dueProblems,...freshProblems.slice(0,Math.max(0,5-dueProblems.length))];
  const dailyGoal=3;
  const dt=dayType(), dn=dayName();
  const lvl=Math.floor(xp/100)+1, lxp=xp%100;
  const sc=solved.size;
  const fmtTime=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  const timerWarn=revSecs>0&&revSecs<300; // last 5 min

  if(boot||user===undefined) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#070b12",color:"#fbbf24",fontFamily:"monospace",fontSize:13}}>loading...</div>;

  if(user===null) return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",background:"#0d1526",fontFamily:"'JetBrains Mono','Fira Mono',monospace",gap:24}}>
      <div style={{textAlign:"center"}}>
        <img src="/logo.svg" alt="Sensei" style={{width:72,height:72,marginBottom:12}}/>
        <div style={{fontSize:28,fontWeight:700,background:"linear-gradient(90deg,#fde68a,#fbbf24,#f97316)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>Sensei</div>
        <div style={{fontSize:12,color:"#4a6080",marginTop:4}}>(A)live DSA Coach</div>
      </div>
      <div style={{fontSize:11,color:"#4a6080",textAlign:"center",maxWidth:280,lineHeight:1.7}}>
        AI-powered coaching for Blind 75.<br/>Live hints · Spaced repetition · AI-verified solutions.
      </div>
      <a href="/auth/github" style={{
        display:"flex",alignItems:"center",gap:10,
        padding:"11px 24px",borderRadius:6,
        background:"#ffffff",color:"#0d1117",
        fontSize:13,fontWeight:700,textDecoration:"none",
        fontFamily:"inherit",transition:"opacity 0.15s"
      }}
        onMouseEnter={e=>e.currentTarget.style.opacity=".85"}
        onMouseLeave={e=>e.currentTarget.style.opacity="1"}
      >
        <svg height="20" viewBox="0 0 24 24" fill="#0d1117"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
        Continue with GitHub
      </a>
      <div style={{fontSize:9,color:"#3a5070",textAlign:"center"}}>Only your GitHub username and avatar are stored.</div>
    </div>
  );

  return(
    <div style={{
      "--bg":dk?"#070b12":"#f8f9fb","--panel":dk?"#0a1020":"#ffffff","--sidebar":dk?"#080e1a":"#f0f4f8",
      "--code":dk?"#040912":"#f5f5f8","--panel2":dk?"#0b1525":"#f4f7fb","--chat":dk?"#060c16":"#f8f9fb",
      "--deep":dk?"#0a0f1a":"#e8edf4","--border":dk?"#1a2a40":"#d0dae8","--border2":dk?"#0f1a2a":"#e4eaf4",
      "--border3":dk?"#1a2535":"#dce5f0","--text":dk?"#dde4ef":"#1a2035","--text2":dk?"#5a7090":"#3d5168",
      "--text3":dk?"#2a4060":"#6277a0","--text4":dk?"#1e3050":"#8095b2","--chatmsg":dk?"#0a1525":"#eef2f9",
      "--chatuser":dk?"#0f1e35":"#e0eaf8","--codetext":dk?"#c9d4e8":"#2d3748",
      "--code-border":dk?"#1a3a5f":"#c0d0e8","--inline-code-bg":dk?"#1e2a3a":"#e0eaf5",
      "--inline-code-color":dk?"#7dd3fc":"#1a6080","--accent":"#fbbf24",
      "--btn-border":dk?"#1e3050":"#b0c0d8","--chat-peek-bg":dk?"#0a1a10":"#e8f4ec",
      "--chat-peek-color":dk?"#6ab88a":"#1a6a3a","--chat-peek-border":dk?"#1a3020":"#b0d8c0",
      "--chat-user-color":dk?"#5a8ab0":"#1a4a6a","--chat-msg-color":dk?"#8aa0b8":"#2a4060",
      display:"flex",flexDirection:"column",height:"100vh",background:"var(--bg)",color:"var(--text)",fontFamily:"'JetBrains Mono','Fira Mono',monospace",overflow:"hidden",position:"relative"}}>
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes warn{0%,100%{opacity:1}50%{opacity:0.5}}
        .fire-text{background:linear-gradient(90deg,#fde68a,#fbbf24,#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
      `}</style>

      {/* ── DRAWER BACKDROP ── */}
      {drawerOpen&&<div style={{position:"fixed",inset:0,zIndex:190,background:"rgba(0,0,0,0.4)"}} onClick={()=>setDrawerOpen(false)}/>}

      {/* ── DRAWER PANEL ── */}
      <div style={{position:"fixed",top:0,left:0,height:"100%",width:280,zIndex:200,transform:drawerOpen?"translateX(0)":"translateX(-100%)",transition:"transform 0.25s ease",background:"var(--panel)",borderRight:"1px solid var(--border)",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"12px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:"1px solid var(--border)",flexShrink:0}}>
          <span style={{fontSize:11,fontWeight:700,color:"var(--text)"}}>Problems</span>
          <button onClick={()=>setDrawerOpen(false)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:14}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:"auto",paddingBottom:16}}>
          {CATS.map(cat=>{
            const cPs=P.filter(p=>p.cat===cat);
            const cS=cPs.filter(p=>solved.has(p.id)).length;
            const open=cats.has(cat);
            return <div key={cat}>
              <div onClick={()=>setCats(prev=>{const n=new Set(prev);n.has(cat)?n.delete(cat):n.add(cat);return n;})}
                style={{padding:"7px 12px",fontSize:"9px",fontWeight:700,letterSpacing:"0.8px",color:"var(--text4)",cursor:"pointer",display:"flex",justifyContent:"space-between",userSelect:"none",borderTop:"1px solid var(--border2)"}}>
                <span>{cat.toUpperCase()}</span>
                <span style={{color:cS===cPs.length&&cPs.length>0?"#4ade80":"var(--border)"}}>{cS}/{cPs.length} {open?"▾":"▸"}</span>
              </div>
              {open&&cPs.map(p=>{
                const isSel=prob.id===p.id,isSolv=solved.has(p.id),isAtt=attempted.has(p.id);
                const c=conf(p.id);
                const fc=fluencyColor(c);
                return <div key={p.id} onClick={()=>{selectProb(p);setDrawerOpen(false);}}
                  style={{padding:"4px 10px 4px 13px",fontSize:10,cursor:"pointer",display:"flex",alignItems:"center",gap:5,background:isSel?"rgba(251,191,36,0.06)":"transparent",borderLeft:isSel?"2px solid #fbbf24":"2px solid transparent",color:isSel?"#fbbf24":isSolv?"#4ade80":isAtt?"var(--text2)":"var(--text4)"}}>
                  <span style={{fontSize:9,flexShrink:0,color:isSolv?"#4ade80":isAtt?"#fb923c":"var(--border)"}}>{isSolv?"✓":isAtt?"◐":"○"}</span>
                  <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,fontSize:9.5}}>{p.title}</span>
                  {isSolv&&fc&&<div style={{width:5,height:5,borderRadius:"50%",background:fc,flexShrink:0,boxShadow:`0 0 3px ${fc}`}}/>}
                  <span style={{fontSize:8,color:DC[p.diff],flexShrink:0}}>{p.diff[0]}</span>
                </div>;
              })}
            </div>;
          })}
        </div>
      </div>

      {/* ── HEADER ── */}
      <div style={{background:"var(--panel)",borderBottom:"1px solid var(--border)",height:44,display:"flex",alignItems:"center",padding:"0 14px",gap:12,flexShrink:0,zIndex:10}}>
        <button onClick={()=>setDrawerOpen(true)} style={{background:"none",border:"none",color:"var(--text3)",cursor:"pointer",fontSize:13}}>☰</button>
        <span className="fire-text" style={{fontSize:18,fontWeight:700,letterSpacing:-0.5}}>⚔ Sensei</span>
        {view==='practice'&&<span style={{fontSize:10,color:"var(--text3)",marginLeft:4}}>{prob.title}</span>}

        {revMode?(
          <div style={{display:"flex",alignItems:"center",gap:8,background:"#1a0a0a",border:"1px solid #5a1010",borderRadius:4,padding:"3px 10px"}}>
            <span style={{fontSize:9,color:"#f87171",fontWeight:700}}>⏱ REVISION</span>
            <span style={{fontSize:12,fontWeight:700,color:timerWarn?"#f87171":"#fbbf24",animation:timerWarn?"warn 0.8s infinite":"none"}}>{fmtTime(revSecs)}</span>
            <button onClick={()=>{setRevMode(false);setRevRunning(false);clearInterval(revInterval.current);setCode(TMPL);setMsgs([{role:"assistant",content:"Back to practice."}]);}} style={{background:"none",border:"none",color:"#3a1010",cursor:"pointer",fontSize:10,fontFamily:"inherit"}}>✕ exit</button>
          </div>
        ):(
          <div style={{background:dt==='revision'?(dk?"#1a2040":"#eeeeff"):(dk?"#0f1a10":"#e8f8ee"),border:`1px solid ${dt==='revision'?(dk?"#2a3a80":"#a0a8e0"):(dk?"#1a3020":"#90d0a0")}`,borderRadius:3,padding:"2px 8px",fontSize:9,color:dt==='revision'?"#818cf8":"#22a060"}}>
            {dn} · {dt==='revision'?"📖 Revision Day":"🔥 Practice Day"}
          </div>
        )}

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:10,color:streak>0?"#fb923c":"var(--text3)"}}>🔥{streak}d</span>
          <span style={{fontSize:10,color:"#7c6fc0"}}>Lv{lvl} <span style={{color:"#3a3060"}}>{lxp}/100</span></span>
          <div style={{display:"flex",alignItems:"center",gap:6,fontSize:10}}>
            <span style={{color:sc>0?"#4ade80":"var(--text3)"}}>{sc}<span style={{color:"var(--text4)"}}>/75</span></span>
            <div style={{width:60,height:3,background:"var(--border)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${(sc/75)*100}%`,background:"linear-gradient(90deg,#f59e0b,#4ade80)",transition:"width 0.5s"}}/></div>
          </div>
          {dueProblems.length>0&&<span style={{fontSize:9,color:"#f87171",background:"#1a0a0a",border:"1px solid #3a1010",padding:"1px 7px",borderRadius:3}}>⚠ {dueProblems.length} due</span>}
          <button onClick={()=>{const n=!dk;setDk(n);localStorage.setItem('dk',n?'dark':'light');}} title={dk?"Switch to light mode":"Switch to dark mode"} style={{padding:"5px 8px",background:"var(--border2)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:3,cursor:"pointer",lineHeight:0,display:"flex",alignItems:"center"}}>
            {dk
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            }
          </button>
          <button onClick={()=>setView(v=>v==='practice'?'dashboard':'practice')} title={view==='practice'?"Dashboard":"Back to practice"} style={{padding:"5px 8px",background:"var(--border2)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:3,cursor:"pointer",lineHeight:0,display:"flex",alignItems:"center"}}>
            {view==='practice'
              ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            }
          </button>
          <div style={{display:"flex",alignItems:"center",gap:7,borderLeft:"1px solid var(--border)",paddingLeft:12}}>
            {user.avatarUrl&&<img src={user.avatarUrl} alt={user.username} style={{width:22,height:22,borderRadius:"50%",border:"1px solid var(--border)"}}/>}
            <span style={{fontSize:9,color:"var(--text3)"}}>{user.username}</span>
            <button onClick={logout} title="Sign out" style={{padding:"3px 8px",background:"none",border:"1px solid var(--border)",color:"var(--text4)",borderRadius:3,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>Sign out</button>
          </div>
        </div>
      </div>

      {/* ── DASHBOARD ── */}
      {view==='dashboard'?(
        <div style={{flex:1,overflowY:"auto",padding:20,display:"flex",flexWrap:"wrap",gap:14,alignContent:"start"}}>

          {/* Daily goal */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:200}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:6}}>TODAY</div>
            <div style={{fontSize:26,fontWeight:700,color:todayDone.size>=dailyGoal?"#4ade80":"#fbbf24"}}>{todayDone.size}<span style={{fontSize:13,color:"var(--text3)"}}>/{dailyGoal}</span></div>
            <div style={{marginTop:8,height:4,background:"var(--border)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(todayDone.size/dailyGoal,1)*100}%`,background:todayDone.size>=dailyGoal?"#4ade80":"#fbbf24",transition:"width 0.4s"}}/></div>
            {todayDone.size>=dailyGoal&&<div style={{marginTop:6,fontSize:9,color:"#4ade80"}}>✓ Goal hit!</div>}
          </div>

          {/* Week calendar */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:260}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>WEEK SCHEDULE</div>
            <div style={{display:"flex",gap:5}}>
              {['M','T','W','T','F','S','S'].map((d,i)=>{
                const isPrac=i<5,isToday=i===([0,6,1,2,3,4,5][new Date().getDay()]);
                return <div key={i} style={{flex:1,textAlign:"center"}}>
                  <div style={{fontSize:8,color:isToday?"#fbbf24":"var(--text4)",marginBottom:3}}>{d}</div>
                  <div style={{height:26,borderRadius:3,background:isToday?(isPrac?"#0f2010":"#0f0f30"):isPrac?"#0a150a":"#0a0a1a",border:`1px solid ${isToday?(isPrac?"#4ade80":"#818cf8"):"var(--border)"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
                    {isPrac?"💻":"📖"}
                  </div>
                </div>;
              })}
            </div>
            <div style={{marginTop:8,fontSize:9,color:"var(--text4)"}}>Mon–Fri: 3 problems · Sat–Sun: revision</div>
          </div>

          {/* Revision queue */}
          <div style={{background:"var(--deep)",border:`1px solid ${dueProblems.length>0?"#3a1010":"var(--border)"}`,borderRadius:8,padding:14,minWidth:240}}>
            <div style={{fontSize:10,color:dueProblems.length>0?"#f87171":"var(--text3)",marginBottom:8,display:"flex",justifyContent:"space-between"}}>
              <span>📖 REVISION QUEUE</span>
              {dueProblems.length>0&&<span style={{color:"#f87171"}}>{dueProblems.length} overdue</span>}
            </div>
            {revQueue.length===0&&<div style={{fontSize:10,color:"var(--text4)"}}>Solve some problems first.</div>}
            {revQueue.slice(0,8).map(p=>{
              const c=conf(p.id);const fc=fluencyColor(c);const fl=fluencyLabel(c);
              return <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid var(--border2)",cursor:"pointer"}} onClick={()=>startRevision(p)}>
                <div style={{width:7,height:7,borderRadius:"50%",background:fc,flexShrink:0,boxShadow:fl==='due'?`0 0 5px ${fc}`:"none"}}/>
                <span style={{flex:1,fontSize:10,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.title}</span>
                <span style={{fontSize:9,color:"var(--text3)"}}>{c}%</span>
                <span style={{fontSize:8,color:DC[p.diff]}}>{p.diff[0]}</span>
                <span style={{fontSize:9,color:"var(--text3)",background:"#0f1520",padding:"1px 6px",borderRadius:3}}>▶ revise</span>
              </div>;
            })}
          </div>

          {/* Category progress */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:220}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>BY CATEGORY</div>
            {CATS.map(cat=>{
              const total=P.filter(p=>p.cat===cat).length;
              const done=P.filter(p=>p.cat===cat&&solved.has(p.id)).length;
              return <div key={cat} style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                  <span style={{color:"#3a5070"}}>{cat}</span>
                  <span style={{color:done===total&&done>0?"#4ade80":"var(--text4)"}}>{done}/{total}</span>
                </div>
                <div style={{height:3,background:"var(--border)",borderRadius:2}}><div style={{height:"100%",width:`${(done/total)*100}%`,background:done===total?"#4ade80":"#fbbf24",borderRadius:2,transition:"width 0.5s"}}/></div>
              </div>;
            })}
          </div>

          {/* XP */}
          <div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:180}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>XP & LEVELS</div>
            {['Easy','Medium','Hard'].map(d=>{
              const n=P.filter(p=>p.diff===d&&solved.has(p.id)).length;
              return <div key={d} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:10}}>
                <span style={{color:DC[d]}}>{d}</span>
                <span style={{color:"#5a40a0"}}>{n}×{XPV[d]}={n*XPV[d]}</span>
              </div>;
            })}
            <div style={{borderTop:"1px solid var(--border)",marginTop:8,paddingTop:6,fontSize:10,color:"#a78bfa"}}>Total: {xp}xp · Lv{lvl}</div>
            <div style={{marginTop:4,fontSize:9,color:"#3a3060"}}>Revision solve = {REV_XP_MULT}× XP (if cold)</div>
          </div>

          {/* Fluency breakdown */}
          {sc>0&&<div style={{background:"var(--panel2)",border:"1px solid var(--border)",borderRadius:8,padding:14,minWidth:200}}>
            <div style={{fontSize:10,color:"var(--text3)",marginBottom:8}}>FLUENCY STATUS</div>
            {[["🟢 Fresh (≥80%)",P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)>=80).length,"#4ade80"],
              ["🟡 Stale (50-79%)",P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)>=50&&(conf(p.id)||0)<80).length,"#fbbf24"],
              ["🔴 Due (<50%)",P.filter(p=>solved.has(p.id)&&(conf(p.id)||0)<50).length,"#f87171"]
            ].map(([label,count,color])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:10}}>
                <span style={{color:"#3a5070"}}>{label}</span>
                <span style={{color}}>{count}</span>
              </div>
            ))}
          </div>}

          {/* Activity heatmap — full width row */}
          <div style={{width:'100%',flexBasis:'100%'}}>
            <Heatmap history={history}/>
          </div>
        </div>
      ):(
      /* ── PRACTICE VIEW — 3-PANEL ── */
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* ── LEFT PANEL: Problem Description ── */}
        <div style={{width:leftW,flexShrink:0,display:"flex",flexDirection:"column",borderRight:"1px solid var(--border)",overflow:"hidden",background:"var(--panel)"}}>
          {/* Problem header */}
          <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
              <span style={{fontSize:13,fontWeight:700,color:revMode?"#f87171":"var(--text)"}}>{prob.title}</span>
              <span style={{fontSize:9,color:DC[prob.diff],border:`1px solid ${DC[prob.diff]}`,padding:"1px 6px",borderRadius:8}}>{prob.diff}</span>
              <span style={{fontSize:9,color:"var(--text4)",background:"var(--border2)",padding:"1px 6px",borderRadius:8}}>{prob.pat}</span>
              {solved.has(prob.id)&&!revMode&&<span style={{fontSize:9,color:"#4ade80"}}>✓ Solved</span>}
              {revMode&&<span style={{fontSize:9,color:"#818cf8",background:"#1a1a30",padding:"1px 8px",borderRadius:8}}>cold solve · no hints</span>}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {solved.has(prob.id)&&conf(prob.id)!==null&&(
                <span style={{fontSize:9,color:fluencyColor(conf(prob.id)),background:"var(--deep)",border:`1px solid ${fluencyColor(conf(prob.id))}30`,padding:"1px 7px",borderRadius:8}}>
                  {conf(prob.id)}% {fluencyLabel(conf(prob.id))}
                </span>
              )}
              <a href={`https://leetcode.com/problems/${prob.title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}/`} target="_blank" rel="noopener noreferrer" style={{fontSize:9,color:"var(--text4)",textDecoration:"none",marginLeft:"auto"}}>LC#{prob.lc}↗</a>
            </div>
          </div>
          {/* Tabs */}
          <div style={{display:"flex",background:"var(--sidebar)",borderBottom:"1px solid var(--border)",flexShrink:0}}>
            {[["desc","Description"],["solution","Solution"+((!solved.has(prob.id)&&!showSol)?" 🔒":"")],["notes","Notes"]].map(([k,label])=>(
              <button key={k} onClick={()=>setTab(k)} style={{padding:"6px 14px",fontSize:10,background:"none",border:"none",borderBottom:tab===k?"2px solid #fbbf24":"2px solid transparent",color:tab===k?"#fbbf24":"var(--text3)",cursor:"pointer",fontFamily:"inherit"}}>{label}</button>
            ))}
          </div>
          {/* Content */}
          <div style={{flex:1,overflowY:"auto",padding:16,fontSize:12,lineHeight:1.9,color:"var(--text2)"}}>
            {tab==="desc"&&<ProbDesc prob={prob} onLoadExample={s=>{setCustomIn(s);setTestOpen(true);}}/>}
            {tab==="solution"&&(
              !solved.has(prob.id)&&!showSol?(
                <div style={{textAlign:"center",paddingTop:36}}>
                  <div style={{color:"var(--text3)",fontSize:12,marginBottom:14}}>Solve it first — or peek:</div>
                  <button onClick={()=>setShowSol(true)} style={{padding:"7px 18px",background:dk?"#1a1a30":"#eeeef8",border:`1px solid ${dk?"#3a3a60":"#a0a0d0"}`,color:"#818cf8",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontSize:10}}>Show anyway</button>
                </div>
              ):(
                <div>
                  <div style={{marginBottom:10,padding:"8px 10px",background:"var(--panel2)",borderRadius:5,border:"1px solid var(--btn-border)"}}>
                    <div style={{fontSize:9,color:"#f59e0b",marginBottom:3,fontWeight:700}}>KEY INSIGHT</div>
                    <div style={{fontSize:11,color:dk?"#7a9ab8":"#2a5070"}}>{prob.note}</div>
                  </div>
                  <pre style={{background:"var(--code)",border:"1px solid var(--code-border)",borderRadius:5,padding:"10px 12px",fontSize:11.5,overflowX:"auto",lineHeight:1.6,margin:0}}><code style={{color:"var(--codetext)"}}>{prob.sol}</code></pre>
                </div>
              )
            )}
            {tab==="notes"&&(
              <textarea value={notes[prob.id]||""} onChange={e=>setNotes(p=>({...p,[prob.id]:e.target.value}))}
                placeholder={`# ${prob.title}\nKey insight:\nTime: O(?)\nSpace: O(?)`}
                style={{width:"100%",height:"100%",background:"transparent",border:"none",outline:"none",resize:"none",fontFamily:"inherit",fontSize:12,color:"var(--text2)",lineHeight:1.75}}/>
            )}
          </div>
        </div>

        {/* ── DRAG HANDLE: left ↔ center ── */}
        <div onMouseDown={e=>{dragRef.current={type:'left',startPos:e.clientX,startSize:leftW};document.body.style.cursor='col-resize';document.body.style.userSelect='none';}}
          style={{width:5,flexShrink:0,cursor:'col-resize',background:'transparent',transition:'background 0.15s',zIndex:1}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--border)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}/>

        {/* ── CENTER PANEL: Code Editor ── */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          {/* Editor top bar */}
          <div style={{padding:"6px 12px",background:"var(--panel)",borderBottom:`1px solid ${revMode?"#3a1010":"var(--border)"}`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
            <span style={{fontSize:9,color:"var(--text4)"}}>solution.py</span>
            <span style={{fontSize:9,color:"var(--border)"}}>|</span>
            <span style={{fontSize:9,color:revMode?"#f87171":peeking?"#fbbf24":"var(--text4)",transition:"color 0.3s"}}>
              {revMode?`⏱ ${fmtTime(revSecs)}`:peeking?"👁 watching...":"Python 3"}
            </span>
            {!revMode&&timerSecs>0&&(
              <span style={{fontSize:9,color:timerSolved?"#4ade80":timerSecs>1800?"#f87171":"var(--text3)",transition:"color 0.3s",marginLeft:2}}>
                {timerSolved?"✓ ":timerSecs>1800?"⚠ ":""}{fmtTime(timerSecs)}
              </span>
            )}
            <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center"}}>
              {revMode?(
                <>
                  <button onClick={markRevSolved} style={{padding:"4px 12px",background:"#fbbf24",border:"none",color:"#000",borderRadius:3,fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>✓ Submit Revision</button>
                  <span style={{fontSize:9,color:"var(--text3)"}}>Cold &lt;15m = {REV_XP_MULT}×XP</span>
                </>
              ):(
                <>
                  <button onClick={submitForReview} disabled={solved.has(prob.id)||pendingReview||reviewRejected}
                    style={{padding:"4px 10px",
                      background:solved.has(prob.id)?"var(--border)":reviewRejected?"#2a0a0a":pendingReview?"#1a2a10":"#fbbf24",
                      border:reviewRejected?"1px solid #f87171":pendingReview?"1px solid #4ade80":"none",
                      color:solved.has(prob.id)?"var(--text3)":reviewRejected?"#f87171":pendingReview?"#4ade80":"#000",
                      borderRadius:3,fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit"}}>
                    {solved.has(prob.id)?"✓ Solved":reviewRejected?"❌ Not yet":pendingReview?"⏳ Verifying...":"Submit"}
                  </button>
                  <button onClick={()=>call("Review my code.",true,null,300)} style={{padding:"4px 10px",background:"none",border:"1px solid var(--btn-border)",color:"var(--text3)",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Review</button>
                  <button onClick={()=>call("Hint please.",false,null,120)} style={{padding:"4px 10px",background:"none",border:"1px solid var(--btn-border)",color:"var(--text3)",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Hint</button>
                  <button onClick={()=>setTestOpen(p=>!p)} style={{padding:"4px 10px",background:testOpen?"var(--border2)":"none",border:"1px solid var(--btn-border)",color:"var(--text3)",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>▶ Test</button>
                  {solved.has(prob.id)&&<button onClick={()=>startRevision(prob)} style={{padding:"4px 10px",background:"none",border:`1px solid ${dk?"#2a3a80":"#8090c8"}`,color:"#818cf8",borderRadius:3,fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>📖 Revise</button>}
                  <div style={{display:"flex",gap:3,marginLeft:4}}>
                    {Array.from({length:dailyGoal}).map((_,i)=>(
                      <div key={i} style={{width:7,height:7,borderRadius:"50%",background:i<todayDone.size?"#4ade80":"var(--border)"}}/>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          {/* CodeMirror editor */}
          <div style={{flex:1,overflow:"hidden",background:revMode?"#08080e":"var(--code)"}}>
            <CodeMirror
              value={code}
              onChange={val=>{
                setCode(val);
                clearTimeout(codeSaveTimer.current);
                codeSaveTimer.current=setTimeout(()=>localStorage.setItem(`code_${prob.id}`,val),500);
                if(!hasTyped.current&&!revMode){hasTyped.current=true;setTimerRunning(true);}
              }}
              extensions={[python()]}
              theme={dk?githubDark:githubLight}
              height="100%"
              style={{height:"100%",fontSize:13}}
              onFocus={()=>setEditorFocus(n=>n+1)}
              basicSetup={{
                lineNumbers:true,
                foldGutter:false,
                dropCursor:false,
                allowMultipleSelections:false,
                indentOnInput:true,
                highlightActiveLine:true,
                highlightSelectionMatches:false,
              }}
            />
          </div>
          {/* Test panel */}
          {testOpen&&!revMode&&(
            <div onMouseDown={e=>{dragRef.current={type:'test',startPos:e.clientY,startSize:testH};document.body.style.cursor='row-resize';document.body.style.userSelect='none';}}
              style={{height:5,flexShrink:0,cursor:'row-resize',background:'transparent',transition:'background 0.15s'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--border)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}/>
          )}
          {testOpen&&!revMode&&(
            <div style={{borderTop:"1px solid var(--border)",background:"var(--panel2)",padding:"8px 12px",flexShrink:0,height:testH,overflowY:"auto"}}>
              <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:6}}>
                <span style={{fontSize:9,color:"var(--text3)",fontWeight:700}}>CUSTOM INPUT</span>
                <span style={{fontSize:8,color:"var(--text4)"}}>(stdin — your code reads via input())</span>
                <button onClick={()=>setTestOpen(false)} style={{marginLeft:"auto",background:"none",border:"none",color:"var(--text4)",cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>
              </div>
              <div style={{display:"flex",gap:6,marginBottom:6}}>
                <textarea value={customIn} onChange={e=>setCustomIn(e.target.value)} rows={2}
                  placeholder="e.g. [2,7,11,15]\n9"
                  style={{flex:1,background:"var(--code)",border:"1px solid var(--border)",color:"var(--codetext)",fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,padding:"5px 7px",borderRadius:3,resize:"vertical",outline:"none"}}/>
                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                  <button onClick={()=>runCode(customIn)} disabled={testLoad}
                    style={{padding:"5px 10px",background:"#fbbf24",border:"none",color:"#000",borderRadius:3,fontSize:10,cursor:"pointer",fontWeight:700,fontFamily:"inherit",whiteSpace:"nowrap"}}>
                    {testLoad?"...":"▶ Run"}
                  </button>
                  <button onClick={()=>runCode("")} disabled={testLoad}
                    style={{padding:"5px 10px",background:"none",border:"1px solid var(--btn-border)",color:"var(--text3)",borderRadius:3,fontSize:9,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                    No input
                  </button>
                </div>
              </div>
              {testOut&&(
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10.5,lineHeight:1.5}}>
                  {testOut.stdout&&<pre style={{background:"var(--code)",border:"1px solid var(--code-border)",borderRadius:3,padding:"5px 8px",margin:"0 0 4px",color:dk?"#4ade80":"#1a6a3a",whiteSpace:"pre-wrap"}}>{testOut.stdout}</pre>}
                  {testOut.stderr&&<pre style={{background:dk?"#0a0808":"#fdf0f0",border:"1px solid #f87171",borderRadius:3,padding:"5px 8px",margin:0,color:"#f87171",whiteSpace:"pre-wrap"}}>{testOut.stderr}</pre>}
                  {!testOut.stdout&&!testOut.stderr&&<span style={{fontSize:9,color:"var(--text4)"}}>No output.</span>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── DRAG HANDLE: center ↔ right ── */}
        <div onMouseDown={e=>{dragRef.current={type:'right',startPos:e.clientX,startSize:rightW};document.body.style.cursor='col-resize';document.body.style.userSelect='none';}}
          style={{width:5,flexShrink:0,cursor:'col-resize',background:'transparent',transition:'background 0.15s',zIndex:1}}
          onMouseEnter={e=>e.currentTarget.style.background='var(--border)'}
          onMouseLeave={e=>e.currentTarget.style.background='transparent'}/>

        {/* ── RIGHT PANEL: Sensei Chat ── */}
        <div style={{width:rightW,flexShrink:0,display:"flex",flexDirection:"column",borderLeft:`1px solid ${revMode?"#3a1010":"var(--border)"}`,background:revMode?"#070408":"var(--chat)"}}>
          {/* Chat header */}
          <div style={{padding:"7px 12px",background:"var(--panel)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <span style={{width:5,height:5,borderRadius:"50%",background:revMode?"#818cf8":peeking?"#fbbf24":"#4ade80",display:"inline-block",boxShadow:peeking?"0 0 6px #fbbf24":"none",transition:"all 0.3s"}}/>
            <span style={{fontSize:11,fontWeight:600,color:revMode?"#818cf8":"var(--text)"}}>{revMode?"Sensei (silent)":"Sensei"}</span>
            {peeking&&<span style={{fontSize:8.5,color:"#fbbf24",animation:"blink 1s infinite"}}>watching</span>}
            {!revMode&&<button onClick={()=>setPeekOn(p=>!p)} style={{marginLeft:"auto",padding:"4px 11px",background:peekOn?(dk?"#0f1a10":"#e8f8ee"):(dk?"#1a1010":"#fdecea"),border:`1px solid ${peekOn?(dk?"#1a3020":"#90d0a0"):(dk?"#3a1010":"#f0a0a0")}`,color:peekOn?"#4ade80":"#f87171",borderRadius:3,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
              {peekOn?"👁 on":"👁 off"}
            </button>}
          </div>
          {revMode&&<div style={{padding:"8px 12px",background:"#0a0820",borderBottom:"1px solid #1a1030",fontSize:10,color:"#3a3060",lineHeight:1.5}}>
            Sensei is quiet. You're on your own. Prove you know it cold.<br/>
            <span style={{color:"#1a1040"}}>Ask a question → "You're on your own."</span>
          </div>}
          <div style={{flex:1,overflowY:"auto",padding:"8px 7px",display:"flex",flexDirection:"column",gap:7}}>
            {msgs.map((m,i)=>(
              <div key={i} style={{padding:"6px 8px",borderRadius:5,fontSize:11.5,lineHeight:1.6,maxWidth:"96%",
                background:m.role==="user"?"var(--chatuser)":m.peek?"var(--chat-peek-bg)":"var(--chatmsg)",
                color:m.role==="user"?"var(--chat-user-color)":m.peek?"var(--chat-peek-color)":"var(--chat-msg-color)",
                border:m.role==="user"?"1px solid var(--btn-border)":m.peek?"1px solid var(--chat-peek-border)":"1px solid var(--border3)",
                alignSelf:m.role==="user"?"flex-end":"flex-start"}}>
                {m.peek&&<span style={{fontSize:8,color:"#3a6040",marginRight:5}}>👁</span>}
                <Msg text={m.content}/>
              </div>
            ))}
            {aiLoad&&<div style={{padding:"6px 8px",borderRadius:5,fontSize:11,background:"var(--chatmsg)",border:"1px solid var(--border3)",alignSelf:"flex-start",color:"var(--text3)",animation:"blink 1.2s infinite"}}>...</div>}
            <div ref={chatRef}/>
          </div>
          {!revMode&&<div style={{padding:"4px 7px",borderTop:"1px solid var(--border)",display:"flex",flexWrap:"wrap",gap:3}}>
            {[["Hint","Hint please.",120],["Complexity?","Target complexity?",100],["Edge cases?","What edge cases?",100],["Pattern?","What's the pattern?",100]].map(([l,m,t])=>(
              <button key={l} onClick={()=>call(m,false,null,t)} disabled={aiLoad}
                style={{padding:"3px 7px",background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text3)",borderRadius:3,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
            ))}
          </div>}
          <div style={{padding:"7px",borderTop:"1px solid var(--border)",display:"flex",gap:5,flexShrink:0,alignItems:"flex-end"}}>
            <textarea ref={chatInputRef} value={inp}
              onChange={e=>{
                setInp(e.target.value);
                e.target.style.height="auto";
                e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
              }}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();call(inp);}}}
              placeholder={revMode?"You're on your own...":"Ask Sensei..."}
              disabled={aiLoad} rows={1}
              style={{flex:1,background:"var(--panel2)",border:"1px solid var(--border)",color:"var(--text)",padding:"6px 8px",borderRadius:3,fontSize:11,fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.5,overflow:"auto",minHeight:34,maxHeight:120,boxSizing:"border-box"}}/>
            <button onClick={()=>call(inp)} disabled={aiLoad||!inp.trim()}
              style={{padding:"6px 10px",background:inp.trim()&&!aiLoad?"#fbbf24":"var(--border)",border:"none",color:inp.trim()&&!aiLoad?"#000":"var(--text4)",borderRadius:3,fontSize:11,cursor:"pointer",fontWeight:700,transition:"background 0.15s",flexShrink:0,height:30}}>→</button>
          </div>
        </div>

      </div>
      )}

    </div>
  );
}

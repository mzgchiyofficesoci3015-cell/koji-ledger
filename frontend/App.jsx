import { useState, useEffect, useCallback } from "react";

const T = {
  ja: {
    appName:"工事台帳", logout:"ログアウト", username:"ユーザー名", password:"パスワード",
    loginBtn:"ログイン", registerBtn:"登録して始める",
    switchToRegister:"アカウントをお持ちでない方", switchToLogin:"すでにアカウントをお持ちの方",
    step1Title:"工事を選択 / 新規登録", step2Title:"入力方法を選択",
    existingProject:"既存の工事から選択", selectPlaceholder:"-- 工事を選択してください --",
    orNewProject:"または新規工事を登録",
    projectNameRequired:"工事名（必須）", startDate:"工事開始日（必須）",
    person:"記載者（任意）", projectNum:"工事番号（任意）",
    next:"次へ", back:"戻る",
    inputMethodPhoto:"📷 写真で入力", inputMethodManual:"✏️ 手打ちで入力",
    inputMethodPhotoDesc:"レシート・領収書をAIで読み取り", inputMethodManualDesc:"直接キーボードで入力",
    tapToUpload:"タップして写真を選択", supportedFormats:"レシート・領収書（JPG・PNG）",
    readBtn:"AIで読み取る", reading:"AIで読み取り中...",
    readResult:"読み取り結果", confidence:"読み取り精度",
    date:"日付", amount:"合計金額", supplier:"仕入先・外注先",
    itemName:"品名・作業内容", qty:"数量", unit:"単位", unitPrice:"単価",
    manualInput:"読み取れなかった場合は手動で入力", amountPlaceholder:"例：15000",
    saveToTemp:"一時保管に保存", saving:"保存中...", saved:"✅ 一時保管に保存しました",
    retry:"やり直す", addMore:"続けて追加する",
    high:"高", mid:"中", low:"低",
    confirmComplete:"完了にしますか？完了後は選択肢から非表示になります。",
    noProjects:"登録された工事はありません",
    newProject:"新規工事登録", complete:"完了にする", active:"進行中", done:"完了",
    register_project:"工事を登録",
    nav:{ add:"追加", list:"一覧", temp:"一時保管" },
    requiredError:"工事名と開始日は必須です",
    selectCategory:"費用項目を選択してください",
    uploadFirst:"写真を選択してください",
    manualRequiredError:"日付と金額は必須です",
    addItem:"+ 明細を追加", removeItem:"削除",
    cats:{ 材料費:"材料費", 人件費:"人件費", 外注費:"外注費", 経費:"経費" },
    catDesc:{ 材料費:"セメント・木材・金物など", 人件費:"作業員・職人の賃金", 外注費:"下請け・専門業者", 経費:"交通費・消耗品など" },
    tempTitle:"一時保管", noTempData:"一時保管データはありません",
    selectProject:"工事を選択", allProjects:"すべての工事",
    viewList:"リスト", viewGrid:"グリッド",
    exportBtn:"Excelにエクスポート", exportDone:"エクスポート済み",
    dropHere:"ここにドロップ",
    moveToFolder:"フォルダに移動",
    unsorted:"未仕分け",
    confirmExport:"選択中のフォルダのデータをExcelにエクスポートします。よろしいですか？",
    exportSuccess:"✅ エクスポートしました。PCエージェントが次回起動時にExcelを作成します。",
    itemCount:"件",
    editRecord:"編集", deleteRecord:"削除",
    editTitle:"明細を編集", saveEdit:"保存", cancelEdit:"キャンセル",
    confirmDelete:"このデータを削除しますか？",
  },
};

const API = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:8000";
const CATS = ["材料費","人件費","外注費","経費"];
const CAT_COLORS = { 材料費:"#1565C0", 人件費:"#2E7D32", 外注費:"#6A1B9A", 経費:"#E65100" };
const CAT_BG    = { 材料費:"#E3F2FD", 人件費:"#E8F5E9", 外注費:"#F3E5F5", 経費:"#FFF3E0" };

async function apiFetch(path, opts={}, token=null){
  const h={"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})};
  const r=await fetch(`${API}${path}`,{...opts,headers:{...h,...(opts.headers||{})}});
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||"エラー");}
  return r.json();
}
function fileToBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});}

const C={bg:"#F4F3EF",card:"#FFF",ink:"#1A1A1A",sub:"#888",border:"#E8E8E8",green:"#2E7D32",greenBg:"#E8F5E9",orange:"#E65100",orangeBg:"#FFF3E0",red:"#C62828",redBg:"#FFEBEE"};
const css={
  app:{minHeight:"100vh",background:C.bg,fontFamily:"'Noto Sans JP',sans-serif",paddingBottom:72},
  header:{background:C.ink,color:"#fff",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100},
  page:{maxWidth:560,margin:"0 auto",padding:"16px"},
  card:{background:C.card,borderRadius:16,padding:"20px 16px",marginBottom:12,boxShadow:"0 1px 6px rgba(0,0,0,0.06)"},
  label:{fontSize:12,color:C.sub,marginBottom:5,display:"block",fontWeight:500},
  input:{width:"100%",padding:"11px 13px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#FAFAFA",color:C.ink},
  select:{width:"100%",padding:"11px 13px",borderRadius:10,border:`1.5px solid ${C.border}`,fontSize:15,outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#FAFAFA",color:C.ink,appearance:"none",backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center"},
  btnPrimary:{width:"100%",padding:"14px",borderRadius:12,background:C.ink,color:"#fff",border:"none",fontSize:15,fontWeight:700,cursor:"pointer",fontFamily:"inherit"},
  btnOutline:{padding:"11px 20px",borderRadius:10,background:"#fff",color:C.ink,border:`1.5px solid ${C.border}`,fontSize:14,cursor:"pointer",fontFamily:"inherit",fontWeight:500},
  btnDanger:{padding:"8px 14px",borderRadius:8,background:"#fff",color:C.red,border:`1.5px solid ${C.red}`,fontSize:13,cursor:"pointer",fontFamily:"inherit"},
  btnSmall:{padding:"6px 12px",borderRadius:8,background:"#fff",color:C.ink,border:`1.5px solid ${C.border}`,fontSize:12,cursor:"pointer",fontFamily:"inherit"},
  divider:{display:"flex",alignItems:"center",gap:10,margin:"16px 0",color:C.sub,fontSize:12},
  divLine:{flex:1,height:1,background:C.border},
  methodGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,margin:"12px 0"},
  methodBtn:s=>({padding:"20px 12px",borderRadius:14,border:`2px solid ${s?C.ink:C.border}`,background:s?C.ink:"#fff",color:s?C.sub:C.ink,cursor:"pointer",textAlign:"center",fontFamily:"inherit"}),
  uploadZone:{border:`2px dashed ${C.border}`,borderRadius:14,padding:"32px 20px",textAlign:"center",cursor:"pointer",background:"#FAFAFA"},
  previewImg:{width:"100%",maxHeight:220,objectFit:"contain",borderRadius:12,marginTop:14,border:`1px solid ${C.border}`},
  resultBox:{background:"#F8F8F6",borderRadius:12,padding:"14px 16px",marginTop:14},
  resultRow:{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:14},
  resultLbl:{color:C.sub,fontSize:13},
  badge:t=>({display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,background:t==="green"?C.greenBg:t==="orange"?C.orangeBg:t==="red"?C.redBg:"#F0F0F0",color:t==="green"?C.green:t==="orange"?C.orange:t==="red"?C.red:C.sub}),
  errorBox:{background:C.redBg,color:C.red,padding:"10px 14px",borderRadius:10,fontSize:13,marginTop:10,whiteSpace:"pre-wrap"},
  successBox:{background:C.greenBg,color:C.green,padding:"10px 14px",borderRadius:10,fontSize:13,marginTop:10},
  spinner:{display:"inline-block",width:18,height:18,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",verticalAlign:"middle",marginRight:8},
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:`1px solid ${C.border}`,display:"flex",zIndex:100},
  navBtn:a=>({flex:1,padding:"10px 0 13px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontSize:11,color:a?C.ink:"#aaa",fontWeight:a?700:400,fontFamily:"inherit"}),
  itemBox:{background:"#F8F8F6",borderRadius:12,padding:"12px",marginBottom:10},
};

function StepBar({step,total=2}){
  return <div style={{display:"flex",gap:6,marginBottom:20}}>{Array.from({length:total},(_,i)=>(
    <div key={i} style={{flex:1,textAlign:"center"}}>
      <div style={{height:3,borderRadius:2,background:step>i+1?C.ink:step===i+1?"#888":C.border,marginBottom:5}}/>
      <span style={{fontSize:10,color:step>=i+1?C.ink:"#bbb",fontWeight:step===i+1?700:400}}>STEP {i+1}</span>
    </div>
  ))}</div>;
}

export default function App(){
  const [lang] = useState("ja");
  const t = T[lang];
  const [token,setToken]=useState(()=>localStorage.getItem("koji_token")||"");
  const [uname,setUname]=useState(()=>localStorage.getItem("koji_user")||"");
  const [page,setPage]=useState("add");
  const [projects,setProjects]=useState([]);
  const [tempData,setTempData]=useState(()=>{try{return JSON.parse(localStorage.getItem("koji_temp")||"[]");}catch{return [];}});

  const logout=()=>{setToken("");setUname("");localStorage.removeItem("koji_token");localStorage.removeItem("koji_user");};
  const fetchProjects=useCallback(async()=>{
    if(!token)return;
    try{const d=await apiFetch("/api/projects",{},token);setProjects(d.projects);}catch{}
  },[token]);
  useEffect(()=>{fetchProjects();},[fetchProjects]);

  const saveTemp=(record)=>{
    const next=[...tempData,{...record,id:`T${Date.now()}`,savedAt:new Date().toISOString(),folder:null,exported:false}];
    setTempData(next);localStorage.setItem("koji_temp",JSON.stringify(next));
  };
  const updateTemp=(updated)=>{setTempData(updated);localStorage.setItem("koji_temp",JSON.stringify(updated));};

  if(!token)return <AuthPage t={t} onLogin={(tok,user)=>{setToken(tok);setUname(user);localStorage.setItem("koji_token",tok);localStorage.setItem("koji_user",user);}}/>;

  return(
    <div style={css.app}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap'); input:focus,select:focus{border-color:#555!important;background:#fff!important;}`}</style>
      <header style={css.header}>
        <span style={{fontSize:17,fontWeight:700}}>🏗 {t.appName}</span>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:12,color:"#aaa"}}>{uname}</span>
          <button onClick={logout} style={{background:"rgba(255,80,80,.2)",border:"none",color:"#fff",padding:"4px 10px",borderRadius:6,fontSize:12,cursor:"pointer"}}>{t.logout}</button>
        </div>
      </header>
      {page==="add"  && <AddPage  t={t} projects={projects} token={token} onRefresh={fetchProjects} onSaveTemp={saveTemp}/>}
      {page==="list" && <ProjectList t={t} projects={projects} token={token} onRefresh={fetchProjects}/>}
      {page==="temp" && <TempPage t={t} projects={projects} tempData={tempData} onUpdate={updateTemp} token={token}/>}
      <nav style={css.bottomNav}>
        {[["add","➕",t.nav.add],["list","📋",t.nav.list],["temp","📁",t.nav.temp]].map(([key,icon,label])=>(
          <button key={key} style={css.navBtn(page===key)} onClick={()=>setPage(key)}>
            <span style={{fontSize:24}}>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function AddPage({t,projects,token,onRefresh,onSaveTemp}){
  const active=projects.filter(p=>!p.done);
  const [step,setStep]=useState(1);
  const [selId,setSelId]=useState("");
  const [newName,setNewName]=useState(""); const [newStart,setNewStart]=useState("");
  const [newPerson,setNewPerson]=useState(""); const [newNum,setNewNum]=useState("");
  const [inputMethod,setMethod]=useState("");
  const [file,setFile]=useState(null); const [preview,setPreview]=useState("");
  const [aiResult,setAiResult]=useState(null);
  const [manualDate,setMDate]=useState(""); const [manualAmount,setMAmount]=useState("");
  const [loading,setLoading]=useState(false);
  const [mDate,setMD]=useState(""); const [mSupplier,setMSupplier]=useState("");
  const [mItems,setMItems]=useState([{name:"",qty:"",unit:"",unitPrice:"",amount:""}]);
  const [mTotal,setMTotal]=useState(""); const [mMemo,setMMemo]=useState("");
  const [error,setError]=useState(""); const [saveStatus,setSave]=useState("");

  const projName=selId?active.find(p=>p.id===selId)?.name:newName;

  const reset=()=>{
    setStep(1);setSelId("");setNewName("");setNewStart("");setNewPerson("");setNewNum("");
    setMethod("");setFile(null);setPreview("");setAiResult(null);setMDate("");setMAmount("");
    setMD("");setMSupplier("");setMItems([{name:"",qty:"",unit:"",unitPrice:"",amount:""}]);setMTotal("");setMMemo("");
    setError("");setSave("");
  };

  const goStep2=()=>{
    if(!selId&&(!newName||!newStart)){setError(t.requiredError);return;}
    setError("");setStep(2);
  };

  const onFile=e=>{
    const f=e.target.files[0];if(!f)return;
    setFile(f);setAiResult(null);setError("");
    const r=new FileReader();r.onload=ev=>setPreview(ev.target.result);r.readAsDataURL(f);
  };

  const ensureProject=async()=>{
    if(selId)return selId;
    const d=await apiFetch("/api/projects",{method:"POST",body:JSON.stringify({name:newName,num:newNum,start:newStart,person:newPerson})},token);
    await onRefresh();return d.project.id;
  };

  const readImage=async()=>{
    if(!file){setError(t.uploadFirst);return;}
    setLoading(true);setError("");setAiResult(null);
    try{
      const b64=await fileToBase64(file);
      // 新規工事の場合はproject_idなしで工事情報を送信、サーバー側で自動登録
      const payload=selId
        ?{project_id:selId,image_b64:b64}
        :{project_name:newName,project_num:newNum,project_start:newStart,project_person:newPerson,image_b64:b64};
      const d=await apiFetch("/api/records/temp",{method:"POST",body:JSON.stringify(payload)},token);
      // サーバーから返ってきたproject_idをセット（新規登録された場合も含む）
      if(!selId&&d.project_id){setSelId(d.project_id);await onRefresh();}
      setAiResult({...d.ai_result,_projId:d.project_id||selId});
    }catch(e){setError(e.message);}
    setLoading(false);
  };

  const savePhoto=async()=>{
    setSave("saving");
    const proj=projects.find(p=>p.id===aiResult._projId)||{id:aiResult._projId,name:projName,num:""};
    onSaveTemp({project_id:proj.id,project_name:proj.name,ai_result:aiResult,input_method:"photo",image_preview:preview});
    setSave("saved");
  };

  const saveManual=async()=>{
    if(!mDate||!mTotal){setError(t.manualRequiredError);return;}
    setSave("saving");setError("");
    try{
      const projId=await ensureProject();
      const proj=projects.find(p=>p.id===projId)||{id:projId,name:projName,num:""};
      const r={日付:mDate,明細:mItems.filter(i=>i.name||i.amount).map(i=>({品名_作業内容:i.name,数量:i.qty?Number(i.qty):null,単位:i.unit||null,単価:i.unitPrice?Number(i.unitPrice):null,金額:i.amount?Number(i.amount):null})),合計金額:Number(mTotal),仕入先_外注先:mSupplier||null,読み取り信頼度:"高",備考:mMemo||null};
      onSaveTemp({project_id:projId,project_name:proj.name,ai_result:r,input_method:"manual"});
      setSave("saved");
    }catch(e){setError(e.message);setSave("");}
  };

  const addItem=()=>setMItems(i=>[...i,{name:"",qty:"",unit:"",unitPrice:"",amount:""}]);
  const removeItem=i=>setMItems(items=>items.filter((_,idx)=>idx!==i));
  const updateItem=(i,k,v)=>setMItems(items=>items.map((item,idx)=>idx===i?{...item,[k]:v}:item));
  const confBadge={高:"green",中:"orange",低:"red"};

  return(
    <div style={css.page}>
      <StepBar step={step} total={2}/>
      {step===1&&(
        <div style={css.card}>
          <p style={{fontSize:15,fontWeight:700,margin:"0 0 16px"}}>STEP 1 ─ {t.step1Title}</p>
          {active.length>0&&(<>
            <label style={css.label}>{t.existingProject}</label>
            <select style={css.select} value={selId} onChange={e=>{setSelId(e.target.value);if(e.target.value){setNewName("");setNewStart("");}}}>
              <option value="">{t.selectPlaceholder}</option>
              {active.map(p=><option key={p.id} value={p.id}>{p.name}{p.num?`（${p.num}）`:""}</option>)}
            </select>
            <div style={css.divider}><div style={css.divLine}/><span>{t.orNewProject}</span><div style={css.divLine}/></div>
          </>)}
          <div style={{opacity:selId?.3:1,pointerEvents:selId?"none":"auto"}}>
            <div style={{marginBottom:12}}><label style={css.label}>{t.projectNameRequired}</label><input style={css.input} value={newName} placeholder="例：田中邸 外壁塗装" onChange={e=>{setNewName(e.target.value);setSelId("");}}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div><label style={css.label}>{t.startDate}</label><input style={css.input} type="date" value={newStart} onChange={e=>{setNewStart(e.target.value);setSelId("");}}/></div>
              <div><label style={css.label}>{t.projectNum}</label><input style={css.input} value={newNum} placeholder="例：2024-001" onChange={e=>setNewNum(e.target.value)}/></div>
            </div>
            <div><label style={css.label}>{t.person}</label><input style={css.input} value={newPerson} placeholder="例：山田" onChange={e=>setNewPerson(e.target.value)}/></div>
          </div>
          {error&&<div style={css.errorBox}>{error}</div>}
          <button style={{...css.btnPrimary,marginTop:18}} onClick={goStep2}>{t.next} →</button>
        </div>
      )}
      {step===2&&(
        <div style={css.card}>
          <p style={{fontSize:15,fontWeight:700,margin:"0 0 4px"}}>STEP 2 ─ {t.step2Title}</p>
          <p style={{fontSize:12,color:C.sub,margin:"0 0 16px"}}>🏗 {projName}</p>
          {!inputMethod&&(
            <>
              <div style={css.methodGrid}>
                <button style={css.methodBtn(false)} onClick={()=>setMethod("photo")}><div style={{fontSize:32,marginBottom:8}}>📷</div><div style={{fontSize:14,fontWeight:700}}>{t.inputMethodPhoto}</div><div style={{fontSize:11,color:C.sub,marginTop:4}}>{t.inputMethodPhotoDesc}</div></button>
                <button style={css.methodBtn(false)} onClick={()=>setMethod("manual")}><div style={{fontSize:32,marginBottom:8}}>✏️</div><div style={{fontSize:14,fontWeight:700}}>{t.inputMethodManual}</div><div style={{fontSize:11,color:C.sub,marginTop:4}}>{t.inputMethodManualDesc}</div></button>
              </div>
              <button style={{...css.btnOutline,width:"100%",boxSizing:"border-box"}} onClick={()=>{setStep(1);setError("");}}>← {t.back}</button>
            </>
          )}
          {inputMethod==="photo"&&(<>
            <div style={css.uploadZone} onClick={()=>document.getElementById("koji-file").click()}>
              {preview?<img src={preview} style={css.previewImg} alt="preview"/>:<><div style={{fontSize:44,marginBottom:10}}>📷</div><p style={{fontSize:14,color:"#666",margin:0}}>{t.tapToUpload}</p><p style={{fontSize:12,color:"#aaa",margin:"4px 0 0"}}>{t.supportedFormats}</p></>}
            </div>
            <input id="koji-file" type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={onFile}/>
            {!file&&(
              <div style={{marginTop:12,background:"#FFF8E1",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#E65100"}}>
                <div style={{fontWeight:700,marginBottom:6}}>📸 きれいに撮るコツ</div>
                <div>・明るい場所で撮影する</div>
                <div>・書類を真上から撮る（斜めにしない）</div>
                <div>・影が書類にかからないようにする</div>
                <div>・文字全体が枠内に収まるようにする</div>
                <div>・手ブレに注意してゆっくり撮る</div>
              </div>
            )}
            {file&&!aiResult&&<button style={{...css.btnPrimary,marginTop:12}} onClick={readImage} disabled={loading}>{loading?<><span style={css.spinner}/>{t.reading}</>:`🤖 ${t.readBtn}`}</button>}
            {error&&<div style={css.errorBox}>{error}</div>}
            {aiResult&&(<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:18,marginBottom:8}}>
                <span style={{fontSize:13,fontWeight:700}}>{t.readResult}</span>
                <span style={css.badge(confBadge[aiResult.読み取り信頼度]||"gray")}>{t.confidence}：{{高:t.high,中:t.mid,低:t.low}[aiResult.読み取り信頼度]||"—"}</span>
              </div>
              <div style={css.resultBox}>
                {[[t.date,aiResult.日付||"—"],[t.supplier,aiResult.仕入先_外注先||"—"],...(aiResult.明細||[]).map(d=>[`${d.品名_作業内容}${d.数量?` ${d.数量}${d.単位||""}`:""}`,d.金額?`¥${Number(d.金額).toLocaleString()}`:"—"])].map(([label,val],i)=>(
                  <div key={i} style={css.resultRow}><span style={css.resultLbl}>{label}</span><span>{val}</span></div>
                ))}
                <div style={{...css.resultRow,borderBottom:"none",paddingTop:10}}><span style={{fontWeight:700}}>{t.amount}</span><span style={{fontWeight:700,fontSize:17}}>{aiResult.合計金額?`¥${Number(aiResult.合計金額).toLocaleString()}`:"—"}</span></div>
              </div>
              <details style={{marginTop:14}}><summary style={{fontSize:13,color:C.sub,cursor:"pointer",padding:"4px 0"}}>✏️ {t.manualInput}</summary>
                <div style={{paddingTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div><label style={css.label}>{t.date}</label><input style={css.input} type="date" value={manualDate} onChange={e=>setMDate(e.target.value)}/></div>
                  <div><label style={css.label}>{t.amount}（円）</label><input style={css.input} value={manualAmount} placeholder={t.amountPlaceholder} onChange={e=>setMAmount(e.target.value)}/></div>
                </div>
              </details>
              {saveStatus===""&&<div style={{display:"flex",gap:10,marginTop:16}}><button style={css.btnOutline} onClick={()=>{setAiResult(null);setFile(null);setPreview("");}}>{t.retry}</button><button style={{...css.btnPrimary,flex:1,marginTop:0}} onClick={savePhoto}>📁 {t.saveToTemp}</button></div>}
              {saveStatus==="saving"&&<button style={{...css.btnPrimary,marginTop:16,opacity:.6}} disabled><span style={css.spinner}/>{t.saving}</button>}
              {saveStatus==="saved"&&<><div style={css.successBox}>{t.saved}</div><button style={{...css.btnPrimary,marginTop:12}} onClick={reset}>{t.addMore}</button></>}
            </>)}
            {!aiResult&&<button style={{...css.btnOutline,width:"100%",marginTop:12,boxSizing:"border-box"}} onClick={()=>{setMethod("");setError("");}}>← {t.back}</button>}
          </>)}
          {inputMethod==="manual"&&(<>
            <div style={{marginBottom:12}}><label style={css.label}>{t.date}（必須）</label><input style={css.input} type="date" value={mDate} onChange={e=>setMD(e.target.value)}/></div>
            <div style={{marginBottom:12}}><label style={css.label}>{t.supplier}</label><input style={css.input} value={mSupplier} placeholder="例：○○建材店" onChange={e=>setMSupplier(e.target.value)}/></div>
            <label style={{...css.label,marginBottom:8}}>明細</label>
            {mItems.map((item,i)=>(
              <div key={i} style={css.itemBox}>
                <div style={{marginBottom:8}}><label style={css.label}>{t.itemName}</label><input style={css.input} value={item.name} placeholder="例：セメント" onChange={e=>updateItem(i,"name",e.target.value)}/></div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
                  <div><label style={css.label}>{t.qty}</label><input style={css.input} value={item.qty} placeholder="10" onChange={e=>updateItem(i,"qty",e.target.value)}/></div>
                  <div><label style={css.label}>{t.unit}</label><input style={css.input} value={item.unit} placeholder="袋" onChange={e=>updateItem(i,"unit",e.target.value)}/></div>
                  <div><label style={css.label}>{t.unitPrice}</label><input style={css.input} value={item.unitPrice} placeholder="1500" onChange={e=>updateItem(i,"unitPrice",e.target.value)}/></div>
                </div>
                <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
                  <div style={{flex:1}}><label style={css.label}>{t.amount}（円）</label><input style={css.input} value={item.amount} placeholder="15000" onChange={e=>updateItem(i,"amount",e.target.value)}/></div>
                  {mItems.length>1&&<button style={{...css.btnSmall,color:C.red,borderColor:C.red,marginBottom:2}} onClick={()=>removeItem(i)}>{t.removeItem}</button>}
                </div>
              </div>
            ))}
            <button style={{...css.btnOutline,width:"100%",marginBottom:12,boxSizing:"border-box"}} onClick={addItem}>{t.addItem}</button>
            <div style={{marginBottom:12}}><label style={css.label}>{t.amount} 合計（円）（必須）</label><input style={css.input} value={mTotal} placeholder="例：15000" onChange={e=>setMTotal(e.target.value)}/></div>
            <div style={{marginBottom:12}}><label style={css.label}>備考</label><input style={css.input} value={mMemo} placeholder="任意メモ" onChange={e=>setMMemo(e.target.value)}/></div>
            {error&&<div style={css.errorBox}>{error}</div>}
            {saveStatus===""&&<div style={{display:"flex",gap:10,marginTop:4}}><button style={css.btnOutline} onClick={()=>{setMethod("");setError("");setSave("");}}>← {t.back}</button><button style={{...css.btnPrimary,flex:1,marginTop:0}} onClick={saveManual}>📁 {t.saveToTemp}</button></div>}
            {saveStatus==="saving"&&<button style={{...css.btnPrimary,marginTop:16,opacity:.6}} disabled><span style={css.spinner}/>{t.saving}</button>}
            {saveStatus==="saved"&&<><div style={css.successBox}>{t.saved}</div><button style={{...css.btnPrimary,marginTop:12}} onClick={reset}>{t.addMore}</button></>}
          </>)}
        </div>
      )}
    </div>
  );
}

function TempPage({t,projects,tempData,onUpdate,token}){
  const [selProj,setSelProj]=useState("all");
  const [viewMode,setViewMode]=useState("list");
  const [dragId,setDragId]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const [exportMsg,setExportMsg]=useState("");

  const filtered=selProj==="all"?tempData:tempData.filter(d=>d.project_id===selProj);
  const projList=[...new Map(tempData.map(d=>[d.project_id,{id:d.project_id,name:d.project_name}])).values()];

  const moveToFolder=(ids,folder)=>{
    const updated=tempData.map(d=>ids.includes(d.id)?{...d,folder}:d);
    onUpdate(updated);
  };

  const handleDrop=(e,folder)=>{
    e.preventDefault();setDragOver(null);
    if(dragId)moveToFolder([dragId],folder);
    setDragId(null);
  };

  const exportFolder=async(projId,folder)=>{
    const items=tempData.filter(d=>d.project_id===projId&&d.folder===folder&&!d.exported);
    if(items.length===0){alert("エクスポートするデータがありません");return;}
    if(!window.confirm(t.confirmExport))return;
    try{
      await apiFetch("/api/records/export",{method:"POST",body:JSON.stringify({project_id:projId,category:folder,records:items.map(d=>d.ai_result)})},token);
      const updated=tempData.map(d=>items.find(i=>i.id===d.id)?{...d,exported:true}:d);
      onUpdate(updated);setExportMsg(t.exportSuccess);setTimeout(()=>setExportMsg(""),3000);
    }catch(e){alert("エクスポートに失敗しました："+e.message);}
  };

  const unsorted=filtered.filter(d=>!d.folder);
  const byFolder=Object.fromEntries(CATS.map(c=>[c,filtered.filter(d=>d.folder===c)]));

  return(
    <div style={{display:"flex",height:"calc(100vh - 130px)",overflow:"hidden"}}>
      {/* サイドメニュー */}
      <div style={{width:140,background:"#fff",borderRight:`1px solid ${C.border}`,overflowY:"auto",flexShrink:0}}>
        <div style={{padding:"12px 10px 6px",fontSize:11,color:C.sub,fontWeight:600}}>工事</div>
        <button style={{width:"100%",textAlign:"left",padding:"8px 12px",border:"none",background:selProj==="all"?"#F0F0F0":"transparent",cursor:"pointer",fontSize:13,fontFamily:"inherit",color:C.ink}} onClick={()=>setSelProj("all")}>{t.allProjects}</button>
        {projList.map(p=>(
          <button key={p.id} style={{width:"100%",textAlign:"left",padding:"8px 12px",border:"none",background:selProj===p.id?"#F0F0F0":"transparent",cursor:"pointer",fontSize:12,fontFamily:"inherit",color:C.ink,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} onClick={()=>setSelProj(p.id)}>{p.name}</button>
        ))}
        <div style={{padding:"12px 10px 6px",fontSize:11,color:C.sub,fontWeight:600,borderTop:`1px solid ${C.border}`,marginTop:8}}>フォルダ</div>
        {CATS.map(cat=>(
          <div key={cat} style={{padding:"6px 12px",fontSize:12,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:10,height:10,borderRadius:2,background:CAT_COLORS[cat],flexShrink:0,display:"inline-block"}}/>
            <span style={{color:C.ink}}>{cat}</span>
            <span style={{marginLeft:"auto",fontSize:10,color:C.sub}}>{byFolder[cat]?.length||0}</span>
          </div>
        ))}
      </div>

      {/* メインエリア */}
      <div style={{flex:1,overflowY:"auto",padding:"12px"}}>
        {exportMsg&&<div style={css.successBox}>{exportMsg}</div>}

        {/* ツールバー */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <span style={{fontSize:13,fontWeight:600,color:C.ink}}>{t.tempTitle}</span>
          <span style={{fontSize:12,color:C.sub}}>{filtered.length}{t.itemCount}</span>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button style={{...css.btnSmall,background:viewMode==="list"?C.ink:"#fff",color:viewMode==="list"?"#fff":C.ink}} onClick={()=>setViewMode("list")}>☰ {t.viewList}</button>
            <button style={{...css.btnSmall,background:viewMode==="grid"?C.ink:"#fff",color:viewMode==="grid"?"#fff":C.ink}} onClick={()=>setViewMode("grid")}>⊞ {t.viewGrid}</button>
          </div>
        </div>

        {filtered.length===0&&<p style={{color:"#bbb",fontSize:14,textAlign:"center",padding:"40px 0"}}>{t.noTempData}</p>}

        {/* 未仕分けエリア */}
        {unsorted.length>0&&(
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.sub,fontWeight:600,marginBottom:8}}>📥 {t.unsorted}（{unsorted.length}件）</div>
            <div style={{display:viewMode==="grid"?"grid":"flex",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",flexDirection:"column",gap:8}}>
              {unsorted.map(d=>(
                <TempCard key={d.id} d={d} t={t} viewMode={viewMode} onDragStart={()=>setDragId(d.id)} cats={CATS} catColors={CAT_COLORS} catBg={CAT_BG} onMove={folder=>moveToFolder([d.id],folder)} onDelete={()=>onUpdate(tempData.filter(x=>x.id!==d.id))} onEdit={updated=>onUpdate(tempData.map(x=>x.id===d.id?{...x,ai_result:updated}:x))}/>
              ))}
            </div>
            {/* ドロップゾーン */}
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}>
              {CATS.map(cat=>(
                <div key={cat} onDragOver={e=>{e.preventDefault();setDragOver(cat);}} onDragLeave={()=>setDragOver(null)} onDrop={e=>handleDrop(e,cat)}
                  style={{flex:1,minWidth:80,padding:"10px 6px",borderRadius:10,border:`2px dashed ${dragOver===cat?CAT_COLORS[cat]:C.border}`,background:dragOver===cat?CAT_BG[cat]:"transparent",textAlign:"center",fontSize:12,color:dragOver===cat?CAT_COLORS[cat]:C.sub,transition:"all .15s"}}>
                  {t.dropHere}<br/><strong>{cat}</strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 費目フォルダ別 */}
        {CATS.map(cat=>{
          const items=byFolder[cat]||[];
          if(items.length===0)return null;
          const projsInFolder=[...new Set(items.map(d=>d.project_id))];
          return(
            <div key={cat} style={{marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{width:12,height:12,borderRadius:3,background:CAT_COLORS[cat],display:"inline-block"}}/>
                <span style={{fontSize:13,fontWeight:700,color:CAT_COLORS[cat]}}>{cat}</span>
                <span style={{fontSize:11,color:C.sub}}>（{items.length}件）</span>
                <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                  {projsInFolder.map(pid=>{
                    const pname=items.find(d=>d.project_id===pid)?.project_name||pid;
                    return <button key={pid} style={{...css.btnSmall,fontSize:11,color:CAT_COLORS[cat],borderColor:CAT_COLORS[cat]}} onClick={()=>exportFolder(pid,cat)}>⬇ {pname} エクスポート</button>;
                  })}
                </div>
              </div>
              <div style={{display:viewMode==="grid"?"grid":"flex",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",flexDirection:"column",gap:8}}>
                {items.map(d=>(
                  <TempCard key={d.id} d={d} t={t} viewMode={viewMode} onDragStart={()=>setDragId(d.id)} cats={CATS} catColors={CAT_COLORS} catBg={CAT_BG} onMove={folder=>moveToFolder([d.id],folder)} currentFolder={cat} onDelete={()=>onUpdate(tempData.filter(x=>x.id!==d.id))} onEdit={updated=>onUpdate(tempData.map(x=>x.id===d.id?{...x,ai_result:updated}:x))}/>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TempCard({d,t,viewMode,onDragStart,cats,catColors,catBg,onMove,currentFolder,onDelete,onEdit}){
  const [editing,setEditing]=useState(false);
  const ai=d.ai_result||{};
  const color=currentFolder?catColors[currentFolder]:C.sub;
  const bg=currentFolder?catBg[currentFolder]:"#F8F8F6";
  const total=ai.合計金額;

  // 編集用ステート
  const [eDate,setEDate]=useState(ai.日付||"");
  const [eSupplier,setESupplier]=useState(ai.仕入先_外注先||"");
  const [eTotal,setETotal]=useState(String(ai.合計金額||""));
  const [eItems,setEItems]=useState(ai.明細?.length>0?ai.明細.map(i=>({name:i.品名_作業内容||"",qty:String(i.数量||""),unit:i.単位||"",unitPrice:String(i.単価||""),amount:String(i.金額||"")})):[{name:"",qty:"",unit:"",unitPrice:"",amount:""}]);
  const [eMemo,setEMemo]=useState(ai.備考||"");

  const saveEdit=()=>{
    const updated={...ai,日付:eDate,仕入先_外注先:eSupplier,合計金額:Number(eTotal),備考:eMemo||null,
      明細:eItems.filter(i=>i.name||i.amount).map(i=>({品名_作業内容:i.name,数量:i.qty?Number(i.qty):null,単位:i.unit||null,単価:i.unitPrice?Number(i.unitPrice):null,金額:i.amount?Number(i.amount):null}))};
    onEdit(updated);setEditing(false);
  };
  const addEItem=()=>setEItems(items=>[...items,{name:"",qty:"",unit:"",unitPrice:"",amount:""}]);
  const removeEItem=i=>setEItems(items=>items.filter((_,idx)=>idx!==i));
  const updateEItem=(i,k,v)=>setEItems(items=>items.map((item,idx)=>idx===i?{...item,[k]:v}:item));

  if(editing){
    return(
      <div style={{background:bg,borderRadius:10,padding:"14px",border:`2px solid ${color||C.border}`}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:C.ink}}>{t.editTitle} — {d.project_name}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div><label style={css.label}>{t.date}</label><input style={css.input} type="date" value={eDate} onChange={e=>setEDate(e.target.value)}/></div>
          <div><label style={css.label}>{t.supplier}</label><input style={css.input} value={eSupplier} onChange={e=>setESupplier(e.target.value)}/></div>
        </div>
        {eItems.map((item,i)=>(
          <div key={i} style={{background:"#fff",borderRadius:8,padding:"10px",marginBottom:8,border:`1px solid ${C.border}`}}>
            <div style={{marginBottom:6}}><label style={css.label}>{t.itemName}</label><input style={css.input} value={item.name} onChange={e=>updateEItem(i,"name",e.target.value)}/></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:6}}>
              <div><label style={css.label}>{t.qty}</label><input style={css.input} value={item.qty} onChange={e=>updateEItem(i,"qty",e.target.value)}/></div>
              <div><label style={css.label}>{t.unit}</label><input style={css.input} value={item.unit} onChange={e=>updateEItem(i,"unit",e.target.value)}/></div>
              <div><label style={css.label}>{t.unitPrice}</label><input style={css.input} value={item.unitPrice} onChange={e=>updateEItem(i,"unitPrice",e.target.value)}/></div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
              <div style={{flex:1}}><label style={css.label}>{t.amount}（円）</label><input style={css.input} value={item.amount} onChange={e=>updateEItem(i,"amount",e.target.value)}/></div>
              {eItems.length>1&&<button style={{...css.btnSmall,color:C.red,borderColor:C.red,marginBottom:2}} onClick={()=>removeEItem(i)}>{t.removeItem}</button>}
            </div>
          </div>
        ))}
        <button style={{...css.btnOutline,width:"100%",marginBottom:10,boxSizing:"border-box",fontSize:12}} onClick={addEItem}>{t.addItem}</button>
        <div style={{marginBottom:10}}><label style={css.label}>{t.amount} 合計（円）</label><input style={css.input} value={eTotal} onChange={e=>setETotal(e.target.value)}/></div>
        <div style={{marginBottom:10}}><label style={css.label}>備考</label><input style={css.input} value={eMemo} onChange={e=>setEMemo(e.target.value)}/></div>
        <div style={{display:"flex",gap:8}}>
          <button style={{...css.btnOutline,flex:1}} onClick={()=>setEditing(false)}>{t.cancelEdit}</button>
          <button style={{...css.btnPrimary,flex:2,marginTop:0}} onClick={saveEdit}>{t.saveEdit}</button>
        </div>
      </div>
    );
  }

  return(
    <div draggable onDragStart={onDragStart} style={{background:d.exported?"#F0F0F0":bg,borderRadius:10,padding:viewMode==="grid"?"12px":"10px 14px",border:`1.5px solid ${d.exported?"#ddd":color||C.border}`,cursor:"grab",opacity:d.exported?.7:1,display:viewMode==="list"?"flex":"block",alignItems:"center",gap:10,position:"relative"}}>
      {d.exported&&<span style={{position:"absolute",top:6,right:8,fontSize:10,color:"#999",background:"#E0E0E0",padding:"2px 6px",borderRadius:10}}>✓ {t.exportDone}</span>}
      {currentFolder&&<span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:color,marginRight:6}}/>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontWeight:600,fontSize:13,color:C.ink,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{d.project_name}</div>
        <div style={{fontSize:11,color:C.sub,marginTop:2}}>{ai.日付||"日付不明"}{ai.仕入先_外注先?` ／ ${ai.仕入先_外注先}`:""}</div>
        {viewMode==="list"&&total&&<div style={{fontSize:12,fontWeight:600,color:color||C.ink,marginTop:2}}>¥{Number(total).toLocaleString()}</div>}
        {/* 明細一覧（展開表示） */}
        {ai.明細?.length>0&&(
          <div style={{marginTop:6}}>
            {ai.明細.map((m,i)=>(
              <div key={i} style={{fontSize:11,color:C.sub,display:"flex",justifyContent:"space-between"}}>
                <span>{m.品名_作業内容}{m.数量?` ${m.数量}${m.単位||""}`:""}</span>
                <span>{m.金額?`¥${Number(m.金額).toLocaleString()}`:""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {viewMode==="grid"&&d.image_preview&&(
        <div style={{width:"100%",marginTop:8,borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`}}>
          <img src={d.image_preview} alt="receipt" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
        </div>
      )}
      {viewMode==="grid"&&total&&<div style={{fontSize:14,fontWeight:700,color:color||C.ink,marginTop:6}}>¥{Number(total).toLocaleString()}</div>}
      {/* 操作ボタン */}
      {!d.exported&&(
        <div style={{display:"flex",gap:6,flexShrink:0,flexDirection:viewMode==="grid"?"row":"column",marginTop:viewMode==="grid"?"8px":0}}>
          <button style={{...css.btnSmall,fontSize:11}} onClick={e=>{e.stopPropagation();setEditing(true);}}>✏️ {t.editRecord}</button>
          <button style={{...css.btnSmall,fontSize:11,color:C.red,borderColor:C.red}} onClick={e=>{e.stopPropagation();if(window.confirm(t.confirmDelete))onDelete();}}>🗑 {t.deleteRecord}</button>
        </div>
      )}
      {!d.exported&&!currentFolder&&(
        <select style={{...css.select,width:viewMode==="grid"?"100%":"120px",marginTop:viewMode==="grid"?"8px":0,fontSize:11,padding:"5px 8px"}} value="" onChange={e=>e.target.value&&onMove(e.target.value)}>
          <option value="">→ 移動</option>
          {cats.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  );
}

function ProjectList({t,projects,token,onRefresh}){
  const [showForm,setShowForm]=useState(false);
  const [name,setName]=useState(""); const [num,setNum]=useState("");
  const [start,setStart]=useState(""); const [person,setPerson]=useState("");
  const [loading,setLoad]=useState(false); const [error,setError]=useState("");

  const create=async()=>{
    if(!name||!start){setError(t.requiredError);return;}
    setLoad(true);
    try{await apiFetch("/api/projects",{method:"POST",body:JSON.stringify({name,num,start,person})},token);setShowForm(false);setName("");setNum("");setStart("");setPerson("");setError("");await onRefresh();}
    catch(e){setError(e.message);}
    setLoad(false);
  };
  const complete=async(id,n)=>{
    if(!window.confirm(`「${n}」を${t.confirmComplete}`))return;
    try{await apiFetch(`/api/projects/${id}/done`,{method:"PATCH"},token);await onRefresh();}catch{}
  };
  const deleteProject=async(id,n)=>{
    if(!window.confirm(`「${n}」を一覧から完全に削除しますか？この操作は元に戻せません。`))return;
    try{await apiFetch(`/api/projects/${id}`,{method:"DELETE"},token);await onRefresh();}catch{}
  };

  const active=projects.filter(p=>!p.done);
  const done=projects.filter(p=>p.done);

  return(
    <div style={{maxWidth:560,margin:"0 auto",padding:16}}>
      <button style={{...css.btnPrimary,marginBottom:12}} onClick={()=>setShowForm(s=>!s)}>{showForm?"✕ キャンセル":`＋ ${t.newProject}`}</button>
      {showForm&&(
        <div style={css.card}>
          <p style={{fontSize:14,fontWeight:700,margin:"0 0 14px"}}>{t.newProject}</p>
          {[[t.projectNameRequired,name,setName,"text","田中邸 外壁塗装"],[t.startDate,start,setStart,"date",""],[t.projectNum,num,setNum,"text","2024-001"],[t.person,person,setPerson,"text","山田"]].map(([label,val,setter,type,ph])=>(
            <div key={label} style={{marginBottom:12}}><label style={css.label}>{label}</label><input style={css.input} type={type} value={val} placeholder={ph} onChange={e=>setter(e.target.value)}/></div>
          ))}
          {error&&<div style={css.errorBox}>{error}</div>}
          <button style={{...css.btnPrimary,opacity:loading?.5:1}} onClick={create} disabled={loading}>{loading?"登録中...":t.register_project}</button>
        </div>
      )}
      <div style={css.card}>
        <p style={{fontSize:13,color:C.sub,fontWeight:600,margin:"0 0 12px"}}>🏗 {t.active}（{active.length}件）</p>
        {active.length===0?<p style={{color:"#bbb",fontSize:14,textAlign:"center",padding:"16px 0",margin:0}}>{t.noProjects}</p>:
          active.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14}}>{p.name}</div><div style={{fontSize:12,color:C.sub,marginTop:2}}>{p.num&&`${p.num}　`}{p.start&&`開始：${p.start}`}{p.person&&`　担当：${p.person}`}</div></div>
              <button style={css.btnDanger} onClick={()=>complete(p.id,p.name)}>{t.complete}</button>
            </div>
          ))
        }
      </div>
      {done.length>0&&(
        <div style={css.card}>
          <p style={{fontSize:13,color:C.sub,fontWeight:600,margin:"0 0 12px"}}>✅ {t.done}（{done.length}件）</p>
          {done.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{flex:1}}><div style={{fontWeight:500,fontSize:14,color:"#999"}}>{p.name}</div><div style={{fontSize:12,color:"#bbb"}}>{p.num}</div></div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={css.badge("gray")}>{t.done}</span>
                <button style={css.btnDanger} onClick={()=>deleteProject(p.id,p.name)}>🗑 削除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthPage({t,onLogin}){
  const [mode,setMode]=useState("login");
  const [user,setUser]=useState(""); const [pass,setPass]=useState("");
  const [error,setError]=useState(""); const [loading,setLoad]=useState(false);

  const submit=async()=>{
    if(!user||!pass){setError("入力してください");return;}
    setLoad(true);setError("");
    try{const d=await apiFetch(mode==="login"?"/api/auth/login":"/api/auth/register",{method:"POST",body:JSON.stringify({username:user,password:pass})});onLogin(d.token,d.username);}
    catch(e){setError(e.message);}
    setLoad(false);
  };

  return(
    <div style={{minHeight:"100vh",background:C.ink,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap');"}</style>
      <div style={{width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:36}}><div style={{fontSize:52,marginBottom:10}}>🏗</div><h1 style={{color:"#fff",fontSize:26,fontWeight:700,margin:0,fontFamily:"'Noto Sans JP',sans-serif"}}>{t.appName}</h1></div>
        <div style={{background:"#2C2C2E",borderRadius:20,padding:"26px 22px"}}>
          {[[t.username,user,setUser,"text"],[t.password,pass,setPass,"password"]].map(([label,val,setter,type])=>(
            <div key={label} style={{marginBottom:14}}><label style={{...css.label,color:"#aaa"}}>{label}</label><input style={{...css.input,background:"#3A3A3C",border:"1.5px solid #48484A",color:"#fff"}} type={type} value={val} onChange={e=>setter(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}/></div>
          ))}
          {error&&<div style={{color:"#FF6B6B",fontSize:13,marginBottom:8}}>{error}</div>}
          <button style={{...css.btnPrimary,background:loading?"#555":"#F5F5F5",color:C.ink}} onClick={submit} disabled={loading}>{loading?"…":mode==="login"?t.loginBtn:t.registerBtn}</button>
          <button style={{width:"100%",background:"transparent",border:"none",color:"#8E8E93",fontSize:13,marginTop:14,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>setMode(m=>m==="login"?"register":"login")}>{mode==="login"?t.switchToRegister:t.switchToLogin}</button>
        </div>
      </div>
    </div>
  );
}

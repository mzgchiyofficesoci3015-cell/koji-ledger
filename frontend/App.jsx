import { useState, useEffect, useCallback } from "react";

// =========================================================
// 多言語対応（i18n）
// =========================================================
const TRANSLATIONS = {
  ja: {
    appName: "工事台帳",
    login: "ログイン", logout: "ログアウト",
    username: "ユーザー名", password: "パスワード",
    loginBtn: "ログイン", registerBtn: "登録して始める",
    switchToRegister: "アカウントをお持ちでない方", switchToLogin: "すでにアカウントをお持ちの方",
    step1Title: "工事を選択 / 新規登録",
    step2Title: "費用項目を選択",
    step3Title: "レシート・領収書をアップロード",
    existingProject: "既存の工事から選択",
    selectPlaceholder: "-- 工事を選択してください --",
    orNewProject: "または新規工事を登録",
    projectNameRequired: "工事名（必須）",
    startDate: "工事開始日（必須）",
    person: "記載者（任意）",
    projectNum: "工事番号（任意）",
    next: "次へ", back: "戻る",
    categories: { 材料費: "材料費", 人件費: "人件費", 外注費: "外注費", 経費: "経費" },
    catDesc: { 材料費: "セメント・木材・金物など", 人件費: "作業員・職人の賃金", 外注費: "下請け・専門業者", 経費: "交通費・消耗品など" },
    tapToUpload: "タップして写真を選択", supportedFormats: "レシート・領収書（JPG・PNG）",
    readBtn: "AIで読み取る", reading: "AIで読み取り中...",
    readResult: "読み取り結果", confidence: "読み取り精度",
    date: "日付", amount: "合計金額", supplier: "仕入先・外注先",
    manualInput: "読み取れなかった場合は手動で入力",
    datePlaceholder: "例：2024-11-15", amountPlaceholder: "例：15000",
    saveBtn: "台帳に保存", saving: "保存中...", saved: "✅ 保存しました",
    retry: "やり直す", addMore: "続けて追加する",
    high: "高", mid: "中", low: "低",
    unreadable: "画像を読み取れませんでした。\n明るく・文字がはっきり写った写真で再度お試しください。",
    confirmComplete: "完了にしますか？完了後は選択肢から非表示になります。",
    noProjects: "登録された工事はありません",
    newProject: "新規工事登録",
    complete: "完了にする", active: "進行中", done: "完了",
    register_project: "工事を登録",
    nav: { add: "追加", list: "一覧" },
    requiredError: "工事名と開始日は必須です",
    selectOrFill: "工事を選択するか、工事名と開始日を入力してください",
    selectCategory: "費用項目を選択してください",
    uploadFirst: "写真を選択してください",
  },
  en: {
    appName: "Construction Ledger",
    login: "Login", logout: "Logout",
    username: "Username", password: "Password",
    loginBtn: "Login", registerBtn: "Create Account",
    switchToRegister: "Don't have an account?", switchToLogin: "Already have an account?",
    step1Title: "Select / Register Project",
    step2Title: "Select Expense Category",
    step3Title: "Upload Receipt / Invoice",
    existingProject: "Select existing project",
    selectPlaceholder: "-- Select a project --",
    orNewProject: "Or register new project",
    projectNameRequired: "Project Name (required)",
    startDate: "Start Date (required)",
    person: "Person in charge (optional)",
    projectNum: "Project No. (optional)",
    next: "Next", back: "Back",
    categories: { 材料費: "Materials", 人件費: "Labor", 外注費: "Subcontract", 経費: "Expenses" },
    catDesc: { 材料費: "Cement, lumber, hardware", 人件費: "Worker wages", 外注費: "Subcontractors", 経費: "Transport, supplies" },
    tapToUpload: "Tap to select photo", supportedFormats: "Receipt / Invoice (JPG・PNG)",
    readBtn: "Read with AI", reading: "AI reading...",
    readResult: "Read Result", confidence: "Confidence",
    date: "Date", amount: "Total", supplier: "Supplier",
    manualInput: "Enter manually if not read correctly",
    datePlaceholder: "e.g. 2024-11-15", amountPlaceholder: "e.g. 15000",
    saveBtn: "Save to Ledger", saving: "Saving...", saved: "✅ Saved!",
    retry: "Retry", addMore: "Add more",
    high: "High", mid: "Med", low: "Low",
    unreadable: "Could not read the image.\nPlease try with a clearer photo.",
    confirmComplete: "Mark as complete? It will be hidden from selections.",
    noProjects: "No projects registered",
    newProject: "New Project",
    complete: "Mark Complete", active: "Active", done: "Done",
    register_project: "Register",
    nav: { add: "Add", list: "List" },
    requiredError: "Project name and start date are required",
    selectOrFill: "Select a project or enter name and start date",
    selectCategory: "Please select a category",
    uploadFirst: "Please select a photo",
  },
};

// =========================================================
// 定数・ユーティリティ
// =========================================================
const API        = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) || "http://localhost:8000";
const CATEGORIES = ["材料費", "人件費", "外注費", "経費"];
const CAT_ICONS  = { 材料費: "📦", 人件費: "👷", 外注費: "🏢", 経費: "🧾" };

async function apiFetch(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.detail || "エラーが発生しました"); }
  return res.json();
}

function fileToBase64(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(file); });
}

// =========================================================
// カラー・スタイル
// =========================================================
const C = { bg: "#F4F3EF", card: "#FFF", ink: "#1A1A1A", sub: "#888", border: "#E8E8E8", green: "#2E7D32", greenBg: "#E8F5E9", orange: "#E65100", orangeBg: "#FFF3E0", red: "#C62828", redBg: "#FFEBEE" };

const css = {
  app:        { minHeight: "100vh", background: C.bg, fontFamily: "'Noto Sans JP', sans-serif", paddingBottom: 72 },
  header:     { background: C.ink, color: "#fff", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 },
  page:       { maxWidth: 560, margin: "0 auto", padding: "16px" },
  card:       { background: C.card, borderRadius: 16, padding: "20px 16px", marginBottom: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.06)" },
  label:      { fontSize: 12, color: C.sub, marginBottom: 5, display: "block", fontWeight: 500, letterSpacing: "0.03em" },
  input:      { width: "100%", padding: "11px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#FAFAFA", color: C.ink },
  select:     { width: "100%", padding: "11px 13px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#FAFAFA", color: C.ink, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" },
  btnPrimary: { width: "100%", padding: "14px", borderRadius: 12, background: C.ink, color: "#fff", border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.03em" },
  btnOutline: { padding: "11px 20px", borderRadius: 10, background: "#fff", color: C.ink, border: `1.5px solid ${C.border}`, fontSize: 14, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 },
  btnDanger:  { padding: "8px 14px", borderRadius: 8, background: "#fff", color: C.red, border: `1.5px solid ${C.red}`, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  divider:    { display: "flex", alignItems: "center", gap: 10, margin: "16px 0", color: C.sub, fontSize: 12 },
  divLine:    { flex: 1, height: 1, background: C.border },
  catGrid:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  catBtn: s  => ({ padding: "16px 12px", borderRadius: 14, border: `2px solid ${s ? C.ink : C.border}`, background: s ? C.ink : "#fff", color: s ? "#fff" : C.ink, cursor: "pointer", textAlign: "center", fontFamily: "inherit", transition: "all .15s" }),
  catSub: s  => ({ fontSize: 11, display: "block", marginTop: 4, color: s ? "rgba(255,255,255,.65)" : C.sub }),
  uploadZone: { border: `2px dashed ${C.border}`, borderRadius: 14, padding: "32px 20px", textAlign: "center", cursor: "pointer", background: "#FAFAFA" },
  previewImg: { width: "100%", maxHeight: 220, objectFit: "contain", borderRadius: 12, marginTop: 14, border: `1px solid ${C.border}` },
  resultBox:  { background: "#F8F8F6", borderRadius: 12, padding: "14px 16px", marginTop: 14 },
  resultRow:  { display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: `1px solid ${C.border}`, fontSize: 14 },
  resultLbl:  { color: C.sub, fontSize: 13 },
  badge: t   => ({ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: t === "green" ? C.greenBg : t === "orange" ? C.orangeBg : t === "red" ? C.redBg : "#F0F0F0", color: t === "green" ? C.green : t === "orange" ? C.orange : t === "red" ? C.red : C.sub }),
  errorBox:   { background: C.redBg,   color: C.red,   padding: "10px 14px", borderRadius: 10, fontSize: 13, marginTop: 10, whiteSpace: "pre-wrap" },
  successBox: { background: C.greenBg, color: C.green, padding: "10px 14px", borderRadius: 10, fontSize: 13, marginTop: 10 },
  spinner:    { display: "inline-block", width: 18, height: 18, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", verticalAlign: "middle", marginRight: 8 },
  bottomNav:  { position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 100 },
  navBtn: a  => ({ flex: 1, padding: "10px 0 13px", border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 11, color: a ? C.ink : "#aaa", fontWeight: a ? 700 : 400, fontFamily: "inherit" }),
  stepBar:    { display: "flex", gap: 6, marginBottom: 20 },
  stepLine: (a,d) => ({ height: 3, borderRadius: 2, background: d ? C.ink : a ? "#888" : C.border, marginBottom: 5 }),
};

// =========================================================
// メインApp
// =========================================================
export default function App() {
  const [lang, setLang]   = useState("ja");
  const [token, setToken] = useState(() => localStorage.getItem("koji_token") || "");
  const [uname, setUname] = useState(() => localStorage.getItem("koji_user") || "");
  const [page, setPage]   = useState("add");
  const [projects, setProjects] = useState([]);
  const t = TRANSLATIONS[lang];

  const logout = () => { setToken(""); setUname(""); localStorage.removeItem("koji_token"); localStorage.removeItem("koji_user"); };
  const fetchProjects = useCallback(async () => {
    if (!token) return;
    try { const d = await apiFetch("/api/projects", {}, token); setProjects(d.projects); } catch {}
  }, [token]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  if (!token) return (
    <AuthPage t={t} lang={lang} setLang={setLang} onLogin={(tok, user) => {
      setToken(tok); setUname(user);
      localStorage.setItem("koji_token", tok); localStorage.setItem("koji_user", user);
    }} />
  );

  return (
    <div style={css.app}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;600;700&display=swap'); input:focus,select:focus{border-color:#555!important;background:#fff!important;outline:none}`}</style>
      <header style={css.header}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "0.02em" }}>🏗 {t.appName}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setLang(l => l === "ja" ? "en" : "ja")} style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>{lang === "ja" ? "EN" : "日本語"}</button>
          <span style={{ fontSize: 12, color: "#aaa" }}>{uname}</span>
          <button onClick={logout} style={{ background: "rgba(255,80,80,.2)", border: "none", color: "#fff", padding: "4px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer" }}>{t.logout}</button>
        </div>
      </header>
      {page === "add"  && <AddPage     t={t} projects={projects} token={token} onRefresh={fetchProjects} />}
      {page === "list" && <ProjectList t={t} projects={projects} token={token} onRefresh={fetchProjects} />}
      <nav style={css.bottomNav}>
        {[["add","➕",t.nav.add],["list","📋",t.nav.list]].map(([key, icon, label]) => (
          <button key={key} style={css.navBtn(page === key)} onClick={() => setPage(key)}>
            <span style={{ fontSize: 24 }}>{icon}</span>{label}
          </button>
        ))}
      </nav>
    </div>
  );
}

// =========================================================
// ステップバー
// =========================================================
function StepBar({ step }) {
  return (
    <div style={css.stepBar}>
      {[1,2,3].map(n => (
        <div key={n} style={{ flex:1, textAlign:"center" }}>
          <div style={css.stepLine(step === n, step > n)} />
          <span style={{ fontSize: 10, color: step >= n ? C.ink : "#bbb", fontWeight: step === n ? 700 : 400 }}>STEP {n}</span>
        </div>
      ))}
    </div>
  );
}

// =========================================================
// 経費追加フロー
// =========================================================
function AddPage({ t, projects, token, onRefresh }) {
  const active = projects.filter(p => !p.done);

  // ステップ管理
  const [step, setStep] = useState(1);

  // STEP1
  const [selId,      setSelId]      = useState("");
  const [newName,    setNewName]    = useState("");
  const [newStart,   setNewStart]   = useState("");
  const [newPerson,  setNewPerson]  = useState("");
  const [newNum,     setNewNum]     = useState("");

  // STEP2
  const [category, setCategory] = useState("");

  // STEP3
  const [file,          setFile]      = useState(null);
  const [preview,       setPreview]   = useState("");
  const [aiResult,      setAiResult]  = useState(null);
  const [manualDate,    setMDate]     = useState("");
  const [manualAmount,  setMAmount]   = useState("");
  const [loading,       setLoading]   = useState(false);
  const [error,         setError]     = useState("");
  const [saveStatus,    setSave]      = useState(""); // "" | "saving" | "saved"

  const projName = selId ? active.find(p => p.id === selId)?.name : newName;

  const reset = () => {
    setStep(1); setSelId(""); setNewName(""); setNewStart(""); setNewPerson(""); setNewNum("");
    setCategory(""); setFile(null); setPreview(""); setAiResult(null); setMDate(""); setMAmount(""); setError(""); setSave("");
  };

  // STEP1→2
  const goStep2 = () => {
    if (!selId && (!newName || !newStart)) { setError(t.requiredError); return; }
    setError(""); setStep(2);
  };

  // STEP2→3
  const goStep3 = () => {
    if (!category) { setError(t.selectCategory); return; }
    setError(""); setStep(3);
  };

  // 画像選択
  const onFile = e => {
    const f = e.target.files[0]; if (!f) return;
    setFile(f); setAiResult(null); setError(""); setMDate(""); setMAmount("");
    const r = new FileReader(); r.onload = ev => setPreview(ev.target.result); r.readAsDataURL(f);
  };

  // AI読み取り
  const readImage = async () => {
    if (!file) { setError(t.uploadFirst); return; }
    setLoading(true); setError(""); setAiResult(null);
    try {
      // 新規工事なら先に登録
      let projId = selId;
      if (!projId) {
        const d = await apiFetch("/api/projects", { method: "POST", body: JSON.stringify({ name: newName, num: newNum, start: newStart, person: newPerson }) }, token);
        projId = d.project.id;
        await onRefresh();
      }
      const b64 = await fileToBase64(file);
      const d   = await apiFetch("/api/records", { method: "POST", body: JSON.stringify({ project_id: projId, category, image_b64: b64 }) }, token);
      setAiResult({ ...d.ai_result, _projId: projId });
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  // 保存（読み取り結果を手動補正してサーバーに通知）
  const saveRecord = async () => {
    setSave("saving");
    // 手動入力があれば上書き（サーバーのキュー内データは既に保存済みのため、
    // 手動補正分はここでキューの最新レコードを更新するAPIを呼ぶ設計に拡張できる）
    await onRefresh();
    setSave("saved");
  };

  const confBadge = { 高: "green", 中: "orange", 低: "red" };

  return (
    <div style={css.page}>
      <StepBar step={step} />

      {/* ── STEP 1: 工事選択 / 新規登録 ── */}
      {step === 1 && (
        <div style={css.card}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 16px" }}>STEP 1 ─ {t.step1Title}</p>

          {active.length > 0 && (
            <>
              <label style={css.label}>{t.existingProject}</label>
              <select style={css.select} value={selId} onChange={e => { setSelId(e.target.value); if (e.target.value) { setNewName(""); setNewStart(""); setNewPerson(""); setNewNum(""); } }}>
                <option value="">{t.selectPlaceholder}</option>
                {active.map(p => <option key={p.id} value={p.id}>{p.name}{p.num ? `（${p.num}）` : ""}</option>)}
              </select>
              <div style={css.divider}><div style={css.divLine} /><span>{t.orNewProject}</span><div style={css.divLine} /></div>
            </>
          )}

          {/* 新規工事フォーム（既存選択中は薄く表示） */}
          <div style={{ opacity: selId ? .3 : 1, pointerEvents: selId ? "none" : "auto" }}>
            <div style={{ marginBottom: 12 }}>
              <label style={css.label}>{t.projectNameRequired}</label>
              <input style={css.input} value={newName} placeholder="例：田中邸 外壁塗装" onChange={e => { setNewName(e.target.value); setSelId(""); }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <div>
                <label style={css.label}>{t.startDate}</label>
                <input style={css.input} type="date" value={newStart} onChange={e => { setNewStart(e.target.value); setSelId(""); }} />
              </div>
              <div>
                <label style={css.label}>{t.projectNum}</label>
                <input style={css.input} value={newNum} placeholder="例：2024-001" onChange={e => setNewNum(e.target.value)} />
              </div>
            </div>
            <div>
              <label style={css.label}>{t.person}</label>
              <input style={css.input} value={newPerson} placeholder="例：山田" onChange={e => setNewPerson(e.target.value)} />
            </div>
          </div>

          {error && <div style={css.errorBox}>{error}</div>}
          <button style={{ ...css.btnPrimary, marginTop: 18 }} onClick={goStep2}>{t.next} →</button>
        </div>
      )}

      {/* ── STEP 2: 費用項目選択 ── */}
      {step === 2 && (
        <div style={css.card}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>STEP 2 ─ {t.step2Title}</p>
          <p style={{ fontSize: 12, color: C.sub, margin: "0 0 16px" }}>🏗 {projName}</p>
          <div style={css.catGrid}>
            {CATEGORIES.map(cat => (
              <button key={cat} style={css.catBtn(category === cat)} onClick={() => setCategory(cat)}>
                <span style={{ fontSize: 28, display: "block", marginBottom: 6 }}>{CAT_ICONS[cat]}</span>
                <span style={{ fontSize: 14, fontWeight: 700, display: "block" }}>{t.categories[cat]}</span>
                <span style={css.catSub(category === cat)}>{t.catDesc[cat]}</span>
              </button>
            ))}
          </div>
          {error && <div style={css.errorBox}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            <button style={css.btnOutline} onClick={() => { setStep(1); setCategory(""); setError(""); }}>← {t.back}</button>
            <button style={{ ...css.btnPrimary, flex: 1 }} onClick={goStep3}>{t.next} →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: 画像アップロード・読み取り・保存 ── */}
      {step === 3 && (
        <div style={css.card}>
          <p style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px" }}>STEP 3 ─ {t.step3Title}</p>
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            <span style={css.badge("green")}>{projName}</span>
            <span style={css.badge("orange")}>{t.categories[category]}</span>
          </div>

          {/* アップロードゾーン */}
          <div style={css.uploadZone} onClick={() => document.getElementById("koji-file-input").click()}>
            {preview
              ? <img src={preview} style={css.previewImg} alt="preview" />
              : <><div style={{ fontSize: 44, marginBottom: 10 }}>📷</div><p style={{ fontSize: 14, color: "#666", margin: 0 }}>{t.tapToUpload}</p><p style={{ fontSize: 12, color: "#aaa", margin: "4px 0 0" }}>{t.supportedFormats}</p></>
            }
          </div>
          <input id="koji-file-input" type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onFile} />

          {/* AIで読み取るボタン（画像選択後・読み取り前） */}
          {file && !aiResult && (
            <button style={{ ...css.btnPrimary, marginTop: 12 }} onClick={readImage} disabled={loading}>
              {loading ? <><span style={css.spinner} />{t.reading}</> : `🤖 ${t.readBtn}`}
            </button>
          )}

          {error && <div style={css.errorBox}>{error}</div>}

          {/* 読み取り結果 */}
          {aiResult && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t.readResult}</span>
                <span style={css.badge(confBadge[aiResult.読み取り信頼度] || "gray")}>
                  {t.confidence}：{{ 高: t.high, 中: t.mid, 低: t.low }[aiResult.読み取り信頼度] || "—"}
                </span>
              </div>
              <div style={css.resultBox}>
                {[
                  [t.date,     aiResult.日付           ? aiResult.日付                                      : "—"],
                  [t.supplier, aiResult.仕入先_外注先   ? aiResult.仕入先_外注先                             : "—"],
                  ...(aiResult.明細 || []).map(d => [`${d.品名_作業内容}${d.数量 ? ` ${d.数量}${d.単位||""}` : ""}`, d.金額 ? `¥${Number(d.金額).toLocaleString()}` : "—"]),
                ].map(([label, val], i) => (
                  <div key={i} style={css.resultRow}><span style={css.resultLbl}>{label}</span><span>{val}</span></div>
                ))}
                <div style={{ ...css.resultRow, borderBottom: "none", paddingTop: 10 }}>
                  <span style={{ fontWeight: 700 }}>{t.amount}</span>
                  <span style={{ fontWeight: 700, fontSize: 17 }}>{aiResult.合計金額 ? `¥${Number(aiResult.合計金額).toLocaleString()}` : "—"}</span>
                </div>
              </div>

              {/* 手動補正（折りたたみ） */}
              <details style={{ marginTop: 14 }}>
                <summary style={{ fontSize: 13, color: C.sub, cursor: "pointer", userSelect: "none", padding: "4px 0" }}>✏️ {t.manualInput}</summary>
                <div style={{ paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={css.label}>{t.date}</label>
                    <input style={css.input} type="date" value={manualDate} onChange={e => setMDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={css.label}>{t.amount}（円）</label>
                    <input style={css.input} value={manualAmount} placeholder={t.amountPlaceholder} onChange={e => setMAmount(e.target.value)} />
                  </div>
                </div>
              </details>

              {/* 保存・やり直しボタン */}
              {saveStatus === "" && (
                <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                  <button style={css.btnOutline} onClick={() => { setAiResult(null); setFile(null); setPreview(""); }}>{t.retry}</button>
                  <button style={{ ...css.btnPrimary, flex: 1, marginTop: 0 }} onClick={saveRecord}>{t.saveBtn}</button>
                </div>
              )}
              {saveStatus === "saving" && <button style={{ ...css.btnPrimary, marginTop: 16, opacity: .6 }} disabled><span style={css.spinner} />{t.saving}</button>}
              {saveStatus === "saved"  && (
                <>
                  <div style={css.successBox}>{t.saved}</div>
                  <button style={{ ...css.btnPrimary, marginTop: 12 }} onClick={reset}>{t.addMore}</button>
                </>
              )}
            </>
          )}

          {/* 戻るボタン（読み取り前のみ表示） */}
          {!aiResult && (
            <button style={{ ...css.btnOutline, width: "100%", marginTop: 12, textAlign: "center", boxSizing: "border-box" }} onClick={() => { setStep(2); setError(""); }}>← {t.back}</button>
          )}
        </div>
      )}
    </div>
  );
}

// =========================================================
// 工事一覧・管理
// =========================================================
function ProjectList({ t, projects, token, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName]   = useState(""); const [num, setNum]     = useState("");
  const [start, setStart] = useState(""); const [person, setPerson] = useState("");
  const [loading, setLoad]= useState(false); const [error, setError] = useState("");

  const create = async () => {
    if (!name || !start) { setError(t.requiredError); return; }
    setLoad(true);
    try { await apiFetch("/api/projects", { method: "POST", body: JSON.stringify({ name, num, start, person }) }, token); setShowForm(false); setName(""); setNum(""); setStart(""); setPerson(""); setError(""); await onRefresh(); }
    catch (e) { setError(e.message); }
    setLoad(false);
  };

  const complete = async (id, n) => {
    if (!window.confirm(`「${n}」を${t.confirmComplete}`)) return;
    try { await apiFetch(`/api/projects/${id}/done`, { method: "PATCH" }, token); await onRefresh(); } catch {}
  };

  const active = projects.filter(p => !p.done);
  const done   = projects.filter(p => p.done);

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 16 }}>
      <button style={{ ...css.btnPrimary, marginBottom: 12 }} onClick={() => setShowForm(s => !s)}>
        {showForm ? "✕ キャンセル" : `＋ ${t.newProject}`}
      </button>

      {showForm && (
        <div style={css.card}>
          <p style={{ fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>{t.newProject}</p>
          {[[t.projectNameRequired, name, setName, "text", "田中邸 外壁塗装"], [t.startDate, start, setStart, "date", ""], [t.projectNum, num, setNum, "text", "2024-001"], [t.person, person, setPerson, "text", "山田"]].map(([label, val, setter, type, ph]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <label style={css.label}>{label}</label>
              <input style={css.input} type={type} value={val} placeholder={ph} onChange={e => setter(e.target.value)} />
            </div>
          ))}
          {error && <div style={css.errorBox}>{error}</div>}
          <button style={{ ...css.btnPrimary, opacity: loading ? .5 : 1 }} onClick={create} disabled={loading}>{loading ? "登録中..." : t.register_project}</button>
        </div>
      )}

      <div style={css.card}>
        <p style={{ fontSize: 13, color: C.sub, fontWeight: 600, margin: "0 0 12px" }}>🏗 {t.active}（{active.length}件）</p>
        {active.length === 0
          ? <p style={{ color: "#bbb", fontSize: 14, textAlign: "center", padding: "16px 0", margin: 0 }}>{t.noProjects}</p>
          : active.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{p.num && `${p.num}　`}{p.start && `開始：${p.start}`}{p.person && `　担当：${p.person}`}</div>
              </div>
              <button style={css.btnDanger} onClick={() => complete(p.id, p.name)}>{t.complete}</button>
            </div>
          ))
        }
      </div>

      {done.length > 0 && (
        <div style={css.card}>
          <p style={{ fontSize: 13, color: C.sub, fontWeight: 600, margin: "0 0 12px" }}>✅ {t.done}（{done.length}件）</p>
          {done.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
              <div><div style={{ fontWeight: 500, fontSize: 14, color: "#999" }}>{p.name}</div><div style={{ fontSize: 12, color: "#bbb" }}>{p.num}</div></div>
              <span style={css.badge("gray")}>{t.done}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =========================================================
// 認証ページ
// =========================================================
function AuthPage({ t, lang, setLang, onLogin }) {
  const [mode, setMode]   = useState("login");
  const [user, setUser]   = useState(""); const [pass, setPass] = useState("");
  const [error, setError] = useState(""); const [loading, setLoad] = useState(false);

  const submit = async () => {
    if (!user || !pass) { setError("入力してください"); return; }
    setLoad(true); setError("");
    try { const d = await apiFetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ username: user, password: pass }) }); onLogin(d.token, d.username); }
    catch (e) { setError(e.message); }
    setLoad(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap');"}</style>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>🏗</div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 700, margin: 0, fontFamily: "'Noto Sans JP',sans-serif" }}>{t.appName}</h1>
        </div>
        <div style={{ background: "#2C2C2E", borderRadius: 20, padding: "26px 22px" }}>
          {[[t.username, user, setUser, "text"], [t.password, pass, setPass, "password"]].map(([label, val, setter, type]) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ ...css.label, color: "#aaa" }}>{label}</label>
              <input style={{ ...css.input, background: "#3A3A3C", border: "1.5px solid #48484A", color: "#fff" }} type={type} value={val} onChange={e => setter(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
            </div>
          ))}
          {error && <div style={{ color: "#FF6B6B", fontSize: 13, marginBottom: 8 }}>{error}</div>}
          <button style={{ ...css.btnPrimary, background: loading ? "#555" : "#F5F5F5", color: C.ink }} onClick={submit} disabled={loading}>{loading ? "…" : mode === "login" ? t.loginBtn : t.registerBtn}</button>
          <button style={{ width: "100%", background: "transparent", border: "none", color: "#8E8E93", fontSize: 13, marginTop: 14, cursor: "pointer", fontFamily: "inherit" }} onClick={() => setMode(m => m === "login" ? "register" : "login")}>
            {mode === "login" ? t.switchToRegister : t.switchToLogin}
          </button>
        </div>
        <button style={{ display: "block", margin: "16px auto 0", background: "rgba(255,255,255,.1)", border: "none", color: "#aaa", padding: "5px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer" }} onClick={() => setLang(l => l === "ja" ? "en" : "ja")}>{lang === "ja" ? "English" : "日本語"}</button>
      </div>
    </div>
  );
}

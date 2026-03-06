import { useState, useEffect, useCallback, useRef } from "react";
const KEYS = { food: "body-log-entries", stats: "body-stats", exercise: "body-exercise", settings: "body-settings", sleep: "body-sleep" };
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric", weekday: "short" });
const mc = { protein: "#3B82F6", fat: "#F59E0B", carbs: "#10B981", cal: "#EF4444", burn: "#f97316", exercise: "#a855f7", sleep: "#818cf8", deep: "#4338ca", core: "#6366f1", rem: "#a78bfa", awake: "#fbbf24" };
const mealLabels = { breakfast: "朝食", lunch: "昼食", dinner: "夕食", snack: "間食", other: "その他" };
const mealEmoji = { breakfast: "🌅", lunch: "☀️", dinner: "🌙", snack: "🍎", other: "📝" };
const actFactors = [
  { key: "sedentary", label: "ほぼ座位", factor: 1.2 },
  { key: "light", label: "軽い活動", factor: 1.375 },
  { key: "moderate", label: "適度に活動", factor: 1.55 },
  { key: "active", label: "活発", factor: 1.725 },
];
function autoMeal() { const h = new Date().getHours(); if (h < 10) return "breakfast"; if (h < 14) return "lunch"; if (h < 20) return "dinner"; return "snack"; }
// ===== JSONP fetch (CORS-free) =====
function fetchJsonp(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cb = "_blcb_" + Date.now();
    const timer = setTimeout(() => { cleanup(); reject(new Error("タイムアウト")); }, timeout);
    const cleanup = () => { clearTimeout(timer); delete window[cb]; const s = document.getElementById(cb); if (s) s.remove(); };
    window[cb] = (data) => { cleanup(); resolve(data); };
    const sep = url.includes("?") ? "&" : "?";
    const s = document.createElement("script");
    s.id = cb; s.src = url + sep + "callback=" + cb;
    s.onerror = () => { cleanup(); reject(new Error("GAS接続エラー")); };
    document.head.appendChild(s);
  });
}
// ===== Local PFC database (API-free fallback) =====
const FOOD_DB = [
  {k:["プロテイン","ホエイ"],u:"30g",cal:120,p:24,f:1.5,c:3},
  {k:["オートミール"],u:"30g",cal:114,p:4,f:2,c:20},
  {k:["卵","たまご","玉子"],u:"1個",cal:91,p:7.4,f:6.2,c:0.2},
  {k:["鶏むね","むね肉"],u:"100g",cal:108,p:22.3,f:1.5,c:0},
  {k:["ささみ"],u:"1本70g",cal:74,p:16,f:0.5,c:0},
  {k:["鮭","サーモン","焼き鮭"],u:"1切80g",cal:150,p:18,f:8,c:0.1},
  {k:["納豆"],u:"1パック",cal:100,p:8.3,f:5,c:6.1},
  {k:["豆腐","とうふ"],u:"150g",cal:84,p:7.8,f:4.2,c:2.1},
  {k:["白米","ごはん","ご飯"],u:"150g",cal:234,p:3.8,f:0.5,c:53},
  {k:["玄米"],u:"150g",cal:228,p:4.2,f:1.5,c:50},
  {k:["パン","食パン"],u:"1枚",cal:158,p:5.6,f:2.6,c:28},
  {k:["バナナ"],u:"1本",cal:86,p:1.1,f:0.2,c:22},
  {k:["りんご","リンゴ"],u:"1個",cal:138,p:0.3,f:0.5,c:36},
  {k:["味噌汁","みそ汁"],u:"1杯",cal:40,p:3,f:1,c:4},
  {k:["サラダチキン"],u:"1個110g",cal:125,p:25,f:1.5,c:1},
  {k:["ドーナツ"],u:"1個",cal:250,p:3,f:12,c:33},
  {k:["パルテノ"],u:"100g",cal:100,p:10,f:0,c:13},
  {k:["ソイラテ","豆乳ラテ"],u:"トール",cal:100,p:2.5,f:6.5,c:10},
  {k:["コーヒー","ブラックコーヒー"],u:"1杯",cal:5,p:0.2,f:0,c:0.7},
  {k:["牛乳","ミルク"],u:"200ml",cal:134,p:6.6,f:7.6,c:9.6},
  {k:["ヨーグルト"],u:"100g",cal:62,p:3.6,f:3,c:4.9},
  {k:["チキンカレー","カレー"],u:"1皿",cal:600,p:22,f:18,c:80},
  {k:["ラーメン"],u:"1杯",cal:500,p:18,f:15,c:65},
  {k:["牛丼"],u:"並盛",cal:650,p:20,f:22,c:85},
  {k:["鶏もも","もも肉"],u:"100g",cal:200,p:16,f:14,c:0},
  {k:["アボカド"],u:"半分",cal:130,p:1.5,f:12,c:5},
  {k:["ブロッコリー"],u:"100g",cal:33,p:4.3,f:0.5,c:3.7},
  {k:["そば","蕎麦"],u:"1人前",cal:300,p:12,f:2,c:55},
  {k:["うどん"],u:"1人前",cal:270,p:7,f:1,c:56},
  {k:["焼肉"],u:"1人前",cal:500,p:30,f:35,c:5},
];
function localFoodEstimate(text) {
  const lower = text.toLowerCase();
  const results = [];
  for (const item of FOOD_DB) {
    for (const keyword of item.k) {
      if (lower.includes(keyword.toLowerCase()) || text.includes(keyword)) {
        const regex = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:個|つ|枚|杯|切れ?|本|パック)?\\s*(?:の)?\\s*${keyword}|${keyword}\\s*(\\d+(?:\\.\\d+)?)\\s*(?:個|つ|枚|杯|切れ?|本|パック|g)?`, 'i');
        const match = text.match(regex);
        let qty = 1;
        if (match) { qty = parseFloat(match[1] || match[2]) || 1; }
        const gramMatch = text.match(new RegExp(`${keyword}\\s*(\\d+)\\s*g`, 'i')) || text.match(new RegExp(`(\\d+)\\s*g\\s*${keyword}`, 'i'));
        if (gramMatch && item.u.includes('g')) {
          const baseG = parseFloat(item.u);
          qty = parseFloat(gramMatch[1]) / baseG;
        }
        results.push({ name: keyword, qty, cal: Math.round(item.cal * qty), p: +(item.p * qty).toFixed(1), f: +(item.f * qty).toFixed(1), c: +(item.c * qty).toFixed(1), unit: item.u });
        break;
      }
    }
  }
  if (results.length === 0) return null;
  const total = results.reduce((acc, r) => ({ cal: acc.cal + r.cal, p: acc.p + r.p, f: acc.f + r.f, c: acc.c + r.c }), { cal: 0, p: 0, f: 0, c: 0 });
  const note = results.map(r => `${r.name}${r.qty > 1 ? '×'+r.qty : ''}(${r.unit}→${r.cal}kcal)`).join('、');
  return { food: text, calories: total.cal, protein: +total.p.toFixed(1), fat: +total.f.toFixed(1), carbs: +total.c.toFixed(1), confidence: "medium", note: "ローカル推定: " + note };
}
async function callAI(messages, maxTokens = 1000) {
  let r;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, messages }),
    });
  } catch(e_) {
    throw new Error("API接続エラー: " + (e_?.message || "ネットワークブロック"));
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error("API " + r.status + ": " + text.slice(0, 100));
  }
  return await r.json();
}
async function callAIJson(messages) {
  const d = await callAI(messages);
  if (d.error) throw new Error(d.error.message || JSON.stringify(d.error));
  if (!d.content) throw new Error("No content: " + JSON.stringify(d).slice(0, 200));
  const raw = d.content.map(c => c.text || "").join("").replace(/```json|```/g, "").trim();
  try { return JSON.parse(raw); } catch(e_) { throw new Error("Parse fail: " + raw.slice(0, 100)); }
}
const toB64 = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
async function aiFoodPhoto(b64, mt) {
  return callAIJson([{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
    { type: "text", text: `食事写真を分析。JSONのみ回答。バッククォート不要。\n{"food":"料理名（日本語）","calories":数値,"protein":数値,"fat":数値,"carbs":数値,"confidence":"high/medium/low","note":"補足"}` },
  ]}]);
}
async function aiFoodText(text) {
  return callAIJson([{ role: "user", content: `食事内容の栄養素を推定。JSONのみ。バッククォート不要。\n食事: ${text}\n{"food":"整理した内容","calories":数値,"protein":数値,"fat":数値,"carbs":数値,"confidence":"high/medium/low","note":"補足"}\nグラム数記載あれば正確に。なければ一般的1人前で。` }]);
}
async function aiBody(b64, mt) {
  return callAIJson([{ role: "user", content: [
    { type: "image", source: { type: "base64", media_type: mt, data: b64 } },
    { type: "text", text: `体組成計スクショから数値読取。JSONのみ。バッククォート不要。読めない項目はnull。\n{"date":"YYYY-MM-DD or null","weight":kg,"bodyFat":%,"bmi":BMI,"muscleMass":筋肉量kg,"visceralFat":内臓脂肪Lv,"basalMetabolism":基礎代謝kcal,"bodyAge":体内年齢,"muscleQuality":筋質点数,"fatMass":脂肪量kg,"leanMass":除脂肪量kg,"bodyWaterPct":体水分率%,"proteinMass":タンパク質量kg,"smi":SMI,"note":""}` },
  ]}]);
}
async function aiExercise(text, weightKg) {
  return callAIJson([{ role: "user", content: `運動内容から消費カロリー推定。体重${weightKg || 68}kg。JSONのみ。バッククォート不要。\n運動: ${text}\n{"exercise":"整理した運動内容（日本語）","duration_min":分,"calories":数値,"intensity":"low/medium/high","note":"補足"}` }]);
}
const STAT_FIELDS = [
  { key: "weight", label: "体重", unit: "kg", primary: true },
  { key: "bodyFat", label: "体脂肪率", unit: "%", primary: true },
  { key: "muscleMass", label: "筋肉量", unit: "kg", primary: true },
  { key: "bmi", label: "BMI", unit: "" }, { key: "visceralFat", label: "内臓脂肪", unit: "Lv" },
  { key: "basalMetabolism", label: "基礎代謝", unit: "kcal" }, { key: "bodyAge", label: "体内年齢", unit: "才" },
  { key: "muscleQuality", label: "筋質点数", unit: "点" }, { key: "fatMass", label: "脂肪量", unit: "kg" },
  { key: "leanMass", label: "除脂肪量", unit: "kg" }, { key: "bodyWaterPct", label: "体水分率", unit: "%" },
  { key: "proteinMass", label: "タンパク質量", unit: "kg" }, { key: "smi", label: "SMI", unit: "" },
];
function csvEscape(v) { if (v == null) return ""; const s = String(v); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; }
function downloadCSV(filename, headers, rows) {
  const bom = "\uFEFF";
  const csv = bom + [headers.join(","), ...rows.map(r => r.map(csvEscape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
function calcSleepScore(s) {
  if (!s || !s.totalMin) return null;
  const targetMin = 420;
  const durScore = Math.min(s.totalMin / targetMin * 100, 100);
  const totalSleep = s.totalMin || 1;
  const deepPct = ((s.deepMin || 0) / totalSleep) * 100;
  const remPct = ((s.remMin || 0) / totalSleep) * 100;
  const deepScore = Math.min(deepPct / 18 * 100, 100);
  const remScore = Math.min(remPct / 22 * 100, 100);
  const totalInBed = totalSleep + (s.awakeMin || 0);
  const effScore = totalInBed > 0 ? (totalSleep / totalInBed) * 100 : 100;
  return Math.round(durScore * 0.35 + deepScore * 0.25 + remScore * 0.2 + effScore * 0.2);
}
function scoreColor(score) {
  if (score >= 85) return "#34d399";
  if (score >= 70) return "#60a5fa";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
}
function fmtMin(min) {
  if (!min && min !== 0) return "--";
  const h = Math.floor(min / 60); const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? m + "m" : ""}` : `${m}m`;
}
function buildAnalysisData(food, exercises, stats, sleep, settings, bmr, tdee, neat) {
  const last30 = new Date(); last30.setDate(last30.getDate() - 30);
  const cutoff = last30.toISOString().slice(0, 10);
  const recentFood = food.filter(e => e.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const recentEx = exercises.filter(e => e.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const recentStats = stats.filter(s => s.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const recentSleep = sleep.filter(s => s.date >= cutoff).sort((a, b) => a.date.localeCompare(b.date));
  const dates = new Set([...recentFood.map(e => e.date), ...recentEx.map(e => e.date)]);
  const daily = [...dates].sort().map(d => {
    const df = recentFood.filter(e => e.date === d);
    const de = recentEx.filter(e => e.date === d);
    return {
      date: d,
      intake_kcal: df.reduce((s, e) => s + (e.calories || 0), 0),
      protein_g: df.reduce((s, e) => s + (e.protein || 0), 0),
      fat_g: df.reduce((s, e) => s + (e.fat || 0), 0),
      carbs_g: df.reduce((s, e) => s + (e.carbs || 0), 0),
      meals: df.length,
      exercise_kcal: de.reduce((s, e) => s + (e.calories || 0), 0),
      foods: df.map(e => `[${mealLabels[e.meal]}]${e.food}`).join(", "),
      exercises: de.map(e => e.exercise).join(", "),
    };
  });
  const bodyTrend = recentStats.map(s => {
    const o = { date: s.date };
    STAT_FIELDS.forEach(f => { if (s[f.key] != null) o[f.label] = s[f.key] + f.unit; });
    return o;
  });
  const sleepTrend = recentSleep.map(s => {
    const score = calcSleepScore(s);
    return `${s.date}: ${fmtMin(s.totalMin)}睡眠 (深い:${fmtMin(s.deepMin)} コア:${fmtMin(s.coreMin)} レム:${fmtMin(s.remMin)} 覚醒:${fmtMin(s.awakeMin)}) 就寝${s.bedtime||"?"} 起床${s.wakeTime||"?"} HR:${s.avgHr||"?"}bpm スコア:${score||"?"}`;
  });
  return `## ユーザーの直近30日間のボディログデータ
### 基本情報
- 基礎代謝(BMR): ${bmr || "未設定"}kcal
- TDEE(運動除く): ${tdee || "未設定"}kcal
- 活動代謝(NEAT): ${neat || "未設定"}kcal
- 活動レベル: ${actFactors.find(a => a.key === settings.activityLevel)?.label || settings.activityLevel}
### 日別食事データ (${daily.length}日分)
${daily.map(d => `${d.date}: 摂取${d.intake_kcal}kcal(P:${d.protein_g}g F:${d.fat_g}g C:${d.carbs_g}g) ${d.meals}食 | 運動消費${d.exercise_kcal}kcal | ${d.foods}${d.exercises ? " | 運動:" + d.exercises : ""}`).join("\n")}
### 睡眠データ (${sleepTrend.length}日分)
${sleepTrend.join("\n")}
### 体組成推移 (${bodyTrend.length}回)
${bodyTrend.map(b => `${b.date}: ${Object.entries(b).filter(([k]) => k !== "date").map(([k, v]) => `${k}${v}`).join(" / ")}`).join("\n")}
### 全期間の記録数
- 食事ログ: ${food.length}件
- 運動ログ: ${exercises.length}件
- 睡眠ログ: ${sleep.length}件
- 体組成: ${stats.length}件`;
}
export default function BodyTracker() {
  const [food, setFood] = useState([]);
  const [stats, setStats] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [sleep, setSleep] = useState([]);
  const [settings, setSettings] = useState({ activityLevel: "light", manualBmr: "", gasUrl: "", sleepTarget: 420 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("log");
  const [logSection, setLogSection] = useState("food");
  const [saving, setSaving] = useState(false);
  const [sleepSyncing, setSleepSyncing] = useState(false);
  const [sleepSyncResult, setSleepSyncResult] = useState(null);
  const [sleepLastSync, setSleepLastSync] = useState(null);
  const [foodText, setFoodText] = useState("");
  const [mealType, setMealType] = useState(autoMeal());
  const [kcal, setKcal] = useState(""); const [pro, setPro] = useState(""); const [fatV, setFatV] = useState(""); const [carbV, setCarbV] = useState("");
  const [fNote, setFNote] = useState(""); const [fDate, setFDate] = useState(today());
  const [fAnalyzing, setFAnalyzing] = useState(false); const [fTextAnalyzing, setFTextAnalyzing] = useState(false);
  const [fPreview, setFPreview] = useState(null); const [fConf, setFConf] = useState(null); const [fErr, setFErr] = useState(null);
  const fRef = useRef(null);
  const [sv, setSv] = useState({}); const [sNote, setSNote] = useState(""); const [sDate, setSDate] = useState(today());
  const [sAnalyzing, setSAnalyzing] = useState(false); const [sPreview, setSPreview] = useState(null);
  const [sAiDone, setSAiDone] = useState(false); const [sErr, setSErr] = useState(null); const [showAll, setShowAll] = useState(false);
  const sRef = useRef(null);
  const [exText, setExText] = useState(""); const [exKcal, setExKcal] = useState(""); const [exDur, setExDur] = useState("");
  const [exNote, setExNote] = useState(""); const [exDate, setExDate] = useState(today());
  const [exAnalyzing, setExAnalyzing] = useState(false); const [exConf, setExConf] = useState(null); const [exErr, setExErr] = useState(null);
  const [filterDays, setFilterDays] = useState(7);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const res = await Promise.allSettled(Object.values(KEYS).map(k => window.storage.get(k)));
        const parse = (i) => res[i].status === "fulfilled" && res[i].value ? JSON.parse(res[i].value.value) : null;
        if (parse(0)) setFood(parse(0));
        if (parse(1)) setStats(parse(1));
        if (parse(2)) setExercises(parse(2));
        const loadedSettings = parse(3);
        if (loadedSettings) setSettings(s => ({ ...s, ...loadedSettings }));
        if (parse(4)) setSleep(parse(4));
      } catch(e_) {}
      setLoading(false);
    })();
  }, []);
  const save = useCallback(async (key, val, setter) => {
    setSaving(true); setter(val);
    try {
      const result = await window.storage.set(key, JSON.stringify(val));
      if (!result) console.error('Storage save failed for', key);
    } catch(e_) { console.error('Storage error:', key, e_); }
    setSaving(false);
  }, []);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const normalizeSleepData = (data) => {
    if (!Array.isArray(data)) throw new Error('配列形式のJSONが必要です');
    const normalized = data.map(r => {
      let dateStr = String(r.date || '');
      if (dateStr.includes('T')) {
        const d = new Date(dateStr);
        dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      }
      return {
        date: dateStr.slice(0, 10),
        bedtime: String(r.bedtime || ''),
        wakeTime: String(r.wakeTime || ''),
        totalMin: Number(r.totalMin) || 0,
        deepMin: Number(r.deepMin) || 0,
        coreMin: Number(r.coreMin) || 0,
        remMin: Number(r.remMin) || 0,
        awakeMin: Number(r.awakeMin) || 0,
        avgHr: Number(r.avgHr) || null,
        minHr: Number(r.minHr) || null,
        source: String(r.source || 'sync'),
      };
    }).filter(d => d.date && d.totalMin > 0);
    if (normalized.length === 0) throw new Error('有効な睡眠データがありません');
    return normalized;
  };
  const mergeSleepAndSave = async (normalized) => {
    const merged = [...sleep];
    for (const remote of normalized) {
      const idx = merged.findIndex(m => m.date === remote.date);
      if (idx >= 0) { merged[idx] = { ...merged[idx], ...remote, id: merged[idx].id || Date.now() }; }
      else { merged.push({ ...remote, id: Date.now() + Math.random() * 1000 }); }
    }
    merged.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    await save(KEYS.sleep, merged, setSleep);
    setSleepSyncResult({ ok: true, count: normalized.length });
    setSleepLastSync(new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }));
  };
  // JSONP 1-tap auto sync
  const syncSleepJsonp = async () => {
    if (!settings.gasUrl) { setSleepSyncResult({ ok: false, error: "GAS URLが未設定です" }); return; }
    setSleepSyncing(true); setSleepSyncResult(null);
    try {
      const data = await fetchJsonp(settings.gasUrl);
      const normalized = normalizeSleepData(data);
      await mergeSleepAndSave(normalized);
    } catch (e) {
      setSleepSyncResult({ ok: false, error: e.message });
    }
    setSleepSyncing(false);
  };
  // Paste-based import (fallback)
  const importSleepFromPaste = async (text) => {
    if (!text.trim()) return;
    setSleepSyncing(true); setSleepSyncResult(null);
    try {
      let data;
      try { data = JSON.parse(text.trim()); } catch(e2) { throw new Error('JSONの形式が不正です'); }
      const normalized = normalizeSleepData(data);
      await mergeSleepAndSave(normalized);
      setPasteText(''); setShowPasteBox(false);
    } catch (e) {
      setSleepSyncResult({ ok: false, error: e.message });
    }
    setSleepSyncing(false);
  };
  const getLatestBmr = () => {
    if (settings.manualBmr) return Number(settings.manualBmr);
    const w = stats.filter(s => s.basalMetabolism != null).sort((a, b) => b.date.localeCompare(a.date));
    return w.length ? w[0].basalMetabolism : null;
  };
  const getLatestWeight = () => {
    const w = stats.filter(s => s.weight != null).sort((a, b) => b.date.localeCompare(a.date));
    return w.length ? w[0].weight : null;
  };
  const actFactor = actFactors.find(a => a.key === settings.activityLevel)?.factor || 1.375;
  const bmr = getLatestBmr();
  const tdee = bmr ? Math.round(bmr * actFactor) : null;
  const neat = tdee && bmr ? tdee - bmr : null;
  const runAiAnalysis = async () => {
    setAiAnalyzing(true); setAiAnalysis(null);
    try {
      const dataStr = buildAnalysisData(food, exercises, stats, sleep, settings, bmr, tdee, neat);
      const result = await callAI([{ role: "user", content: `あなたはボディメイクと睡眠科学に詳しいパーソナルトレーナー兼栄養士です。以下のユーザーのボディログデータを分析し、日本語で具体的なフィードバックをしてください。
${dataStr}
以下の観点で分析してください：
1. **カロリー収支**: 摂取vs消費の傾向、減量/維持/増量どのフェーズか
2. **PFCバランス**: タンパク質は十分か（体重×1.5〜2gが目安）、脂質と炭水化物のバランス
3. **睡眠品質**: 深い睡眠・レム睡眠の比率、睡眠時間の充足度、就寝・起床時刻の安定性、心拍数の傾向
4. **食事×睡眠の相関**: 夕食の時間帯・内容が睡眠に影響していないか、運動と睡眠の関係
5. **体組成の変化**: 体重・体脂肪・筋肉量のトレンド
6. **具体的アクション**: 今すぐ改善できること3つ（睡眠改善を含む）
バキバキのスマート体型（マッチョではない引き締まった体）を目指し、パフォーマンス最大化のために睡眠を最適化したいユーザーです。簡潔に、でも具体的に。` }], 2000);
      const text = result.content.map(c => c.text || "").join("");
      setAiAnalysis(text);
    } catch (e) { setAiAnalysis("⚠️ 分析に失敗しました。データが十分にあるか確認してください。"); }
    setAiAnalyzing(false);
  };
  const copyDataToClipboard = async () => {
    const dataStr = buildAnalysisData(food, exercises, stats, sleep, settings, bmr, tdee, neat);
    try { await navigator.clipboard.writeText(dataStr); } catch(e_) { const ta = document.createElement("textarea"); ta.value = dataStr; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const applyFoodResult = (r) => {
    setKcal(r.calories != null ? String(r.calories) : "");
    setPro(r.protein != null ? String(r.protein) : "");
    setFatV(r.fat != null ? String(r.fat) : "");
    setCarbV(r.carbs != null ? String(r.carbs) : "");
    if (r.note) setFNote(r.note);
    setFConf(r.confidence || "medium");
  };
  const handleFoodPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setFPreview(URL.createObjectURL(file)); setFErr(null); setFConf(null); setFAnalyzing(true);
    try { const r = await aiFoodPhoto(await toB64(file), file.type || "image/jpeg"); setFoodText(r.food || ""); applyFoodResult(r); }
    catch(e_) { setFErr("AI解析失敗: " + (e_?.message || String(e_))); } setFAnalyzing(false);
  };
  const handleFoodTextAI = async () => {
    if (!foodText.trim()) return; setFErr(null); setFConf(null); setFTextAnalyzing(true);
    try {
      let result;
      try { result = await aiFoodText(foodText.trim()); }
      catch(apiErr) {
        const local = localFoodEstimate(foodText.trim());
        if (local) { result = local; }
        else { throw new Error(apiErr.message + "（ローカルDBにも該当なし）"); }
      }
      applyFoodResult(result);
    }
    catch(e_) { setFErr("AI解析失敗: " + (e_?.message || String(e_))); } setFTextAnalyzing(false);
  };
  const clearFP = () => { setFPreview(null); setFConf(null); setFErr(null); if (fRef.current) fRef.current.value = ""; };
  const addFood = async () => {
    if (!foodText.trim()) return;
    await save(KEYS.food, [{ id: Date.now(), date: fDate, meal: mealType, food: foodText.trim(), calories: kcal?+kcal:null, protein: pro?+pro:null, fat: fatV?+fatV:null, carbs: carbV?+carbV:null, note: fNote.trim(), ai: !!fConf }, ...food], setFood);
    setFoodText(""); setKcal(""); setPro(""); setFatV(""); setCarbV(""); setFNote(""); setFConf(null); clearFP();
  };
  const handleBodyPhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setSPreview(URL.createObjectURL(file)); setSErr(null); setSAiDone(false); setSAnalyzing(true);
    try {
      const r = await aiBody(await toB64(file), file.type || "image/jpeg");
      const nv = {}; STAT_FIELDS.forEach(f => { if (r[f.key] != null) nv[f.key] = String(r[f.key]); });
      setSv(nv); if (r.date) setSDate(r.date); if (r.note) setSNote(r.note); setSAiDone(true); setShowAll(true);
    } catch(e_) { setSErr("AI解析失敗: " + (e_?.message || String(e_))); } setSAnalyzing(false);
  };
  const clearBP = () => { setSPreview(null); setSAiDone(false); setSErr(null); if (sRef.current) sRef.current.value = ""; };
  const addBody = async () => {
    if (!STAT_FIELDS.some(f => sv[f.key])) return;
    const entry = { id: Date.now(), date: sDate, note: sNote.trim(), ai: sAiDone };
    STAT_FIELDS.forEach(f => { entry[f.key] = sv[f.key] ? +sv[f.key] : null; });
    await save(KEYS.stats, [entry, ...stats], setStats);
    setSv({}); setSNote(""); clearBP(); setShowAll(false);
  };
  const handleExTextAI = async () => {
    if (!exText.trim()) return; setExErr(null); setExConf(null); setExAnalyzing(true);
    try {
      const r = await aiExercise(exText.trim(), getLatestWeight());
      setExKcal(r.calories != null ? String(r.calories) : "");
      setExDur(r.duration_min != null ? String(r.duration_min) : "");
      if (r.note) setExNote(r.note); setExConf(r.intensity || "medium");
    } catch(e_) { setExErr("AI解析失敗: " + (e_?.message || String(e_))); } setExAnalyzing(false);
  };
  const addExercise = async () => {
    if (!exText.trim() && !exKcal) return;
    await save(KEYS.exercise, [{ id: Date.now(), date: exDate, exercise: exText.trim(), calories: exKcal?+exKcal:null, duration: exDur?+exDur:null, note: exNote.trim(), ai: !!exConf }, ...exercises], setExercises);
    setExText(""); setExKcal(""); setExDur(""); setExNote(""); setExConf(null);
  };
  const saveSettings = async (newS) => { const merged = { ...settings, ...newS }; setSettings(merged); try { await window.storage.set(KEYS.settings, JSON.stringify(merged)); } catch(e_) {} };
  const exportAll = () => {
    const dates = new Set([...food.map(e=>e.date),...exercises.map(e=>e.date),...stats.map(s=>s.date),...sleep.map(s=>s.date)]);
    const sorted = [...dates].sort();
    const rows = sorted.map(d => {
      const df = food.filter(e=>e.date===d); const de = exercises.filter(e=>e.date===d);
      const ds = stats.filter(s=>s.date===d).sort((a,b)=>b.id-a.id)[0];
      const sl = sleep.find(s=>s.date===d);
      return [d, df.length, df.map(e=>`[${mealLabels[e.meal]}]${e.food}`).join(" / "),
        df.reduce((s,e)=>s+(e.calories||0),0), df.reduce((s,e)=>s+(e.protein||0),0),
        df.reduce((s,e)=>s+(e.fat||0),0), df.reduce((s,e)=>s+(e.carbs||0),0),
        de.length, de.map(e=>e.exercise).join(" / "), de.reduce((s,e)=>s+(e.calories||0),0),
        tdee||"", (tdee||0)+de.reduce((s,e)=>s+(e.calories||0),0),
        df.reduce((s,e)=>s+(e.calories||0),0)-((tdee||0)+de.reduce((s,e)=>s+(e.calories||0),0)),
        ds?.weight, ds?.bodyFat, ds?.muscleMass, ds?.bmi, ds?.basalMetabolism, ds?.visceralFat, ds?.bodyAge,
        sl?.totalMin, sl?.deepMin, sl?.coreMin, sl?.remMin, sl?.awakeMin, sl?.avgHr, sl?.bedtime, sl?.wakeTime, calcSleepScore(sl)];
    });
    downloadCSV("bodylog_daily.csv", ["日付","食事数","食事内容","摂取kcal","P(g)","F(g)","C(g)","運動数","運動内容","運動消費kcal","TDEE","総消費kcal","収支kcal","体重","体脂肪%","筋肉量","BMI","基礎代謝","内臓脂肪","体内年齢","睡眠(分)","深い(分)","コア(分)","レム(分)","覚醒(分)","心拍数","就寝","起床","睡眠スコア"], rows);
  };
  const cutoffStr = (() => { const c = new Date(); c.setDate(c.getDate() - filterDays); return c.toISOString().slice(0, 10); })();
  const getDailyFood = () => {
    const byDate = {};
    food.filter(e => e.date >= cutoffStr).forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = { cal: 0, p: 0, f: 0, c: 0, n: 0 };
      byDate[e.date].cal += e.calories || 0; byDate[e.date].p += e.protein || 0;
      byDate[e.date].f += e.fat || 0; byDate[e.date].c += e.carbs || 0; byDate[e.date].n++;
    });
    return Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([d, v]) => ({ date: d, ...v }));
  };
  const getDailyExercise = () => {
    const byDate = {};
    exercises.filter(e => e.date >= cutoffStr).forEach(e => {
      if (!byDate[e.date]) byDate[e.date] = { cal: 0, n: 0 };
      byDate[e.date].cal += e.calories || 0; byDate[e.date].n++;
    });
    return byDate;
  };
  const getAvgFood = () => {
    const t = getDailyFood(); if (!t.length) return null; const n = t.length;
    return { cal: Math.round(t.reduce((s,d)=>s+d.cal,0)/n), p: Math.round(t.reduce((s,d)=>s+d.p,0)/n), f: Math.round(t.reduce((s,d)=>s+d.f,0)/n), c: Math.round(t.reduce((s,d)=>s+d.c,0)/n), days: n };
  };
  const getRecentSleep = () => sleep.filter(s => s.date >= cutoffStr).sort((a, b) => b.date.localeCompare(a.date));
  const getAvgSleep = () => {
    const rs = getRecentSleep(); if (!rs.length) return null; const n = rs.length;
    return {
      total: Math.round(rs.reduce((s,d)=>s+(d.totalMin||0),0)/n),
      deep: Math.round(rs.reduce((s,d)=>s+(d.deepMin||0),0)/n),
      core: Math.round(rs.reduce((s,d)=>s+(d.coreMin||0),0)/n),
      rem: Math.round(rs.reduce((s,d)=>s+(d.remMin||0),0)/n),
      awake: Math.round(rs.reduce((s,d)=>s+(d.awakeMin||0),0)/n),
      hr: Math.round(rs.filter(d=>d.avgHr).reduce((s,d)=>s+(d.avgHr||0),0)/(rs.filter(d=>d.avgHr).length||1)),
      score: Math.round(rs.map(calcSleepScore).filter(Boolean).reduce((s,v)=>s+v,0)/(rs.map(calcSleepScore).filter(Boolean).length||1)),
      days: n
    };
  };
  const confLabel = { high: "🟢 高", medium: "🟡 中", low: "🔴 参考" };
  const isFA = fAnalyzing || fTextAnalyzing;
  if (loading) return <div style={S.loadWrap}><div>読み込み中...</div></div>;
  const visibleStats = showAll ? STAT_FIELDS : STAT_FIELDS.filter(f => f.primary);
  const SleepBar = ({ s, wide }) => {
    const total = (s.deepMin||0) + (s.coreMin||0) + (s.remMin||0) + (s.awakeMin||0);
    if (!total) return null;
    const pcts = { deep: (s.deepMin||0)/total*100, core: (s.coreMin||0)/total*100, rem: (s.remMin||0)/total*100, awake: (s.awakeMin||0)/total*100 };
    return (
      <div style={{ display: "flex", borderRadius: 4, overflow: "hidden", height: wide ? 16 : 10, marginTop: 4 }}>
        {pcts.deep > 0 && <div style={{ width: pcts.deep+"%", background: mc.deep }} title={`深い ${s.deepMin}m`}/>}
        {pcts.core > 0 && <div style={{ width: pcts.core+"%", background: mc.core }} title={`コア ${s.coreMin}m`}/>}
        {pcts.rem > 0 && <div style={{ width: pcts.rem+"%", background: mc.rem }} title={`レム ${s.remMin}m`}/>}
        {pcts.awake > 0 && <div style={{ width: pcts.awake+"%", background: mc.awake }} title={`覚醒 ${s.awakeMin}m`}/>}
      </div>
    );
  };
  return (
    <div style={S.container}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={S.header}>
        <div><h1 style={S.title}>BODY LOG</h1><p style={S.subtitle}>AI解析 × 摂取 × 消費 × 体組成 × 睡眠</p></div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          {sleepSyncing && <span style={{...S.badge, color: mc.sleep, background: mc.sleep+"15"}}>同期中</span>}
          {saving && <span style={S.badge}>保存中</span>}
        </div>
      </div>
      <div style={S.tabs}>
        {[{ k:"log",l:"記録",i:"✏️" },{ k:"history",l:"履歴",i:"📋" },{ k:"analytics",l:"分析",i:"📊" }].map(t=>(
          <button key={t.k} onClick={()=>setTab(t.k)} style={{...S.tab,...(tab===t.k?S.tabOn:{})}}>{t.i} {t.l}</button>
        ))}
      </div>
      {tab === "log" && (<div style={S.content}>
        <div style={S.subTabs}>
          {[{ k:"food",l:"🍽️ 食事" },{ k:"exercise",l:"🏃 運動" },{ k:"sleep",l:"🌙 睡眠" },{ k:"body",l:"📐 体組成" }].map(t=>(
            <button key={t.k} onClick={()=>setLogSection(t.k)} style={{...S.subTab,...(logSection===t.k?S.subTabOn:{})}}>{t.l}</button>
          ))}
        </div>
        {logSection === "food" && (<div style={S.card}>
          <div style={{marginBottom:12}}>
            {fPreview?(<div style={S.prevWrap}><img src={fPreview} alt="" style={S.prevImg}/>
              {fAnalyzing&&<div style={S.overlay}><div style={S.spinner}/><span style={S.olText}>解析中...</span></div>}
              {!fAnalyzing&&<button onClick={clearFP} style={S.clrBtn}>✕</button>}
            </div>):(<label style={S.upLabel}><input ref={fRef} type="file" accept="image/*" capture="environment" onChange={handleFoodPhoto} style={{display:"none"}}/>
              <div style={S.upInner}><span style={{fontSize:24}}>📷</span><span style={{fontSize:12,color:"#888"}}>写真で自動解析</span></div>
            </label>)}
          </div>
          <div style={S.row}>
            <input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} style={S.dateInput}/>
            <div style={S.mealBtns}>{Object.entries(mealLabels).map(([k,v])=>(<button key={k} onClick={()=>setMealType(k)} style={{...S.mBtn,...(mealType===k?S.mBtnOn:{})}}>{mealEmoji[k]} {v}</button>))}</div>
          </div>
          <div style={{position:"relative",marginBottom:8}}>
            <textarea value={foodText} onChange={e=>setFoodText(e.target.value)} placeholder={"食べたものをメモ\n例: ホエイプロテイン30g水割り、オートミール30g"} style={{...S.ta,marginBottom:0,paddingBottom:44}} rows={3}/>
            <button onClick={handleFoodTextAI} disabled={!foodText.trim()||isFA} style={{...S.aiBtn,opacity:(!foodText.trim()||isFA)?0.4:1}}>
              {fTextAnalyzing?<span style={{animation:"pulse 1s infinite"}}>推定中...</span>:"✨ AIでPFC推定"}</button>
          </div>
          {fConf&&<div style={S.conf}>{confLabel[fConf]} AI推定（修正可）</div>}
          {fErr&&<div style={{...S.conf,color:"#f87171"}}>⚠️ {fErr}</div>}
          <div style={{...S.grid4,marginTop:12}}>
            {[{l:"kcal",c:mc.cal,v:kcal,s:setKcal},{l:"P(g)",c:mc.protein,v:pro,s:setPro},{l:"F(g)",c:mc.fat,v:fatV,s:setFatV},{l:"C(g)",c:mc.carbs,v:carbV,s:setCarbV}].map(m=>(
              <div key={m.l} style={S.mIn}><label style={{...S.mLbl,color:m.c}}>{m.l}</label><input type="number" value={m.v} onChange={e=>m.s(e.target.value)} placeholder="--" style={S.nIn}/></div>))}
          </div>
          <input value={fNote} onChange={e=>setFNote(e.target.value)} placeholder="メモ（任意）" style={S.noteIn}/>
          <button onClick={addFood} style={S.btnBlue} disabled={!foodText.trim()||isFA}>食事を記録</button>
          <details style={{marginTop:16}}>
            <summary style={{fontSize:12,color:"#666",cursor:"pointer"}}>📱 Claudeチャットからインポート</summary>
            <div style={{marginTop:8,background:"#1a1a2e",borderRadius:8,padding:12}}>
              <p style={{fontSize:10,color:"#666",lineHeight:1.6,marginBottom:8}}>
                Claudeに「<span style={{color:"#aaa"}}>朝食: ぶり切り身、味噌汁 → JSON出力して</span>」と送り、返ってきたJSONを貼り付け
              </p>
              <textarea id="foodImportBox" placeholder='[{"meal":"breakfast","food":"...","calories":120,"protein":24,"fat":1.5,"carbs":3}]' style={{...S.ta,height:60,fontSize:10,fontFamily:"monospace"}}/>
              <button onClick={async()=>{
                const text = document.getElementById("foodImportBox").value;
                if (!text.trim()) return;
                try {
                  let items = JSON.parse(text.trim());
                  if (!Array.isArray(items)) items = [items];
                  const newEntries = items.map(r => ({
                    id: Date.now() + Math.random()*1000,
                    date: r.date || today(),
                    meal: r.meal || autoMeal(),
                    food: r.food || "",
                    calories: r.calories != null ? Number(r.calories) : null,
                    protein: r.protein != null ? Number(r.protein) : null,
                    fat: r.fat != null ? Number(r.fat) : null,
                    carbs: r.carbs != null ? Number(r.carbs) : null,
                    note: r.note || "チャットAI",
                    ai: true,
                  })).filter(e => e.food);
                  if (newEntries.length === 0) throw new Error("有効なデータなし");
                  await save(KEYS.food, [...newEntries, ...food], setFood);
                  document.getElementById("foodImportBox").value = "";
                  setFErr(null);
                  alert("✅ " + newEntries.length + "件の食事を追加");
                } catch(e_) { alert("❌ " + e_.message); }
              }} style={{...S.mBtn,width:"100%",borderColor:mc.protein+"40",color:mc.protein,marginTop:4}}>
                📥 食事データを取り込む
              </button>
            </div>
          </details>
        </div>)}
        {logSection === "exercise" && (<div><div style={S.card}>
          <h3 style={S.cardTitle}>🏃 運動ログ</h3>
          <input type="date" value={exDate} onChange={e=>setExDate(e.target.value)} style={S.dateInput}/>
          <div style={{position:"relative",marginBottom:8}}>
            <textarea value={exText} onChange={e=>setExText(e.target.value)} placeholder={"運動内容をメモ\n例: ランニング30分、ベンチプレス60kg×10×3セット"} style={{...S.ta,marginBottom:0,paddingBottom:44}} rows={3}/>
            <button onClick={handleExTextAI} disabled={!exText.trim()||exAnalyzing} style={{...S.aiBtn,opacity:(!exText.trim()||exAnalyzing)?0.4:1}}>
              {exAnalyzing?<span style={{animation:"pulse 1s infinite"}}>推定中...</span>:"✨ AI消費推定"}</button>
          </div>
          {exConf&&<div style={S.conf}>強度: {exConf}（修正可）</div>}
          {exErr&&<div style={{...S.conf,color:"#f87171"}}>⚠️ {exErr}</div>}
          <div style={{...S.grid4,gridTemplateColumns:"repeat(2,1fr)",marginTop:12}}>
            <div style={S.mIn}><label style={{...S.mLbl,color:mc.exercise}}>消費(kcal)</label><input type="number" value={exKcal} onChange={e=>setExKcal(e.target.value)} placeholder="--" style={S.nIn}/></div>
            <div style={S.mIn}><label style={S.mLbl}>時間(分)</label><input type="number" value={exDur} onChange={e=>setExDur(e.target.value)} placeholder="--" style={S.nIn}/></div>
          </div>
          <input value={exNote} onChange={e=>setExNote(e.target.value)} placeholder="メモ（任意）" style={S.noteIn}/>
          <button onClick={addExercise} style={S.btnPurple} disabled={(!exText.trim()&&!exKcal)||exAnalyzing}>運動を記録</button>
        </div>
        <div style={S.card}>
          <h3 style={S.cardTitle}>⚙️ 消費カロリー設定</h3>
          <label style={{...S.mLbl,marginBottom:8,display:"block"}}>活動レベル</label>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
            {actFactors.map(a=>(<button key={a.key} onClick={()=>saveSettings({activityLevel:a.key})} style={{...S.mBtn,...(settings.activityLevel===a.key?S.mBtnOn:{})}}>{a.label}(×{a.factor})</button>))}
          </div>
          <label style={{...S.mLbl,marginBottom:4,display:"block"}}>基礎代謝(kcal)</label>
          <input type="number" value={settings.manualBmr} onChange={e=>saveSettings({manualBmr:e.target.value})} placeholder={bmr?`自動:${bmr}kcal`:"未設定"} style={{...S.nIn,width:"100%",textAlign:"left",padding:"8px 12px",marginBottom:12}}/>
          {bmr&&(<div style={{background:"#1a1a2e",borderRadius:8,padding:12,fontSize:13}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#888"}}>BMR</span><span style={{fontWeight:700}}>{bmr}kcal</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{color:"#888"}}>NEAT</span><span style={{color:mc.burn,fontWeight:700}}>+{neat}kcal</span></div>
            <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #2a2a40",paddingTop:6}}><span style={{color:"#888"}}>TDEE</span><span style={{fontWeight:800}}>{tdee}kcal</span></div>
          </div>)}
        </div></div>)}
        {logSection === "sleep" && (<div>
          <div style={{...S.card, borderColor: mc.sleep+"40"}}>
            <h3 style={{...S.cardTitle, color: mc.sleep}}>🌙 Apple Watch 睡眠同期</h3>
            {sleepSyncResult && (
              <div style={{...S.conf, color: sleepSyncResult.ok ? "#34d399" : "#f87171", marginBottom: 8}}>
                {sleepSyncResult.ok ? `✅ ${sleepSyncResult.count}件取得` : `⚠️ ${sleepSyncResult.error}`}
                {sleepLastSync && <span style={{marginLeft:8,color:"#666"}}>({sleepLastSync})</span>}
              </div>
            )}
            {/* Main 1-tap sync button */}
            <button onClick={syncSleepJsonp} disabled={sleepSyncing||!settings.gasUrl}
              style={{...S.btnSleep,width:"100%",marginBottom:8,opacity:(sleepSyncing||!settings.gasUrl)?0.5:1,fontSize:15,padding:14}}>
              {sleepSyncing ? <span style={{animation:"pulse 1s infinite"}}>⏳ 同期中...</span> : "⌚ 睡眠データを同期"}
            </button>
            {!settings.gasUrl && <p style={{fontSize:11,color:"#f87171",textAlign:"center",marginBottom:8}}>↓ まずGAS URLを設定してください</p>}
            {/* GAS URL setting */}
            <details style={{marginBottom:8}} open={!settings.gasUrl}>
              <summary style={{fontSize:11,color:"#555",cursor:"pointer"}}>⚙️ GAS URL設定</summary>
              <div style={{marginTop:8}}>
                <input value={settings.gasUrl||""} onChange={e=>saveSettings({gasUrl:e.target.value.trim()})}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  style={{...S.noteIn,fontSize:10,fontFamily:"monospace"}}/>
              </div>
            </details>
            {/* Paste fallback */}
            <details style={{marginBottom:8}}>
              <summary style={{fontSize:11,color:"#555",cursor:"pointer"}}>📋 手動コピペ（JSONP非対応時）</summary>
              <div style={{animation:"fadeIn .3s ease",marginTop:8}}>
                <textarea
                  value={pasteText} onChange={e=>setPasteText(e.target.value)}
                  placeholder='[{"date":"2026-03-01","totalMin":334,...}]'
                  style={{...S.ta,height:80,fontSize:11,fontFamily:"monospace"}}
                />
                <button onClick={()=>importSleepFromPaste(pasteText)} disabled={!pasteText.trim()||sleepSyncing}
                  style={{...S.btnSleep,width:"100%",opacity:(!pasteText.trim()||sleepSyncing)?0.5:1}}>
                  {sleepSyncing ? "取り込み中..." : "✨ データを取り込む"}
                </button>
              </div>
            </details>
                {sleep.length > 0 && (() => {
                  const latest = sleep[0];
                  const score = calcSleepScore(latest);
                  return (
                    <div style={{background:"#1a1a2e",borderRadius:10,padding:14,marginTop:4}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                        <span style={{fontSize:12,color:mc.sleep,fontWeight:600}}>{fmtDate(latest.date)}</span>
                        {score && <div style={{fontSize:22,fontWeight:800,color:scoreColor(score)}}>{score}<span style={{fontSize:11,fontWeight:400,color:"#888"}}>/100</span></div>}
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#aaa",marginBottom:6}}>
                        <span>🛏 {latest.bedtime||"--"} → ⏰ {latest.wakeTime||"--"}</span>
                        <span style={{fontWeight:700,color:"#e8e8ec"}}>{fmtMin(latest.totalMin)}</span>
                      </div>
                      <SleepBar s={latest} wide/>
                      <div style={{display:"flex",gap:10,marginTop:8,fontSize:10,color:"#888",flexWrap:"wrap"}}>
                        <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:mc.deep,marginRight:3}}/>深い {fmtMin(latest.deepMin)}</span>
                        <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:mc.core,marginRight:3}}/>コア {fmtMin(latest.coreMin)}</span>
                        <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:mc.rem,marginRight:3}}/>レム {fmtMin(latest.remMin)}</span>
                        <span><span style={{display:"inline-block",width:8,height:8,borderRadius:2,background:mc.awake,marginRight:3}}/>覚醒 {fmtMin(latest.awakeMin)}</span>
                        {latest.avgHr && <span>❤️ {latest.avgHr}bpm</span>}
                      </div>
                    </div>
                  );
                })()}
          </div>
          <div style={{...S.card, opacity: 0.7}}>
            <details>
              <summary style={{fontSize:12,color:"#666",cursor:"pointer",marginBottom:8}}>📝 手動入力（自動同期できない場合）</summary>
              <ManualSleepForm onAdd={async (entry) => {
                await save(KEYS.sleep, [entry, ...sleep.filter(s => s.date !== entry.date)], setSleep);
              }}/>
            </details>
          </div>
        </div>)}
        {logSection === "body" && (<div style={S.card}>
          <h3 style={S.cardTitle}>📐 体組成ログ</h3>
          <div style={{marginBottom:12}}>
            {sPreview?(<div style={S.prevWrap}><img src={sPreview} alt="" style={S.prevImg}/>
              {sAnalyzing&&<div style={S.overlay}><div style={S.spinner}/><span style={S.olText}>解析中...</span></div>}
              {!sAnalyzing&&<button onClick={clearBP} style={S.clrBtn}>✕</button>}
            </div>):(<label style={S.upLabel}><input ref={sRef} type="file" accept="image/*" onChange={handleBodyPhoto} style={{display:"none"}}/>
              <div style={S.upInner}><span style={{fontSize:24}}>📷</span><span style={{fontSize:12,color:"#888"}}>体組成スクショで自動解析</span></div>
            </label>)}
          </div>
          {sAiDone&&<div style={S.conf}>🟢 読み取り完了（修正可）</div>}
          {sErr&&<div style={{...S.conf,color:"#f87171"}}>⚠️ {sErr}</div>}
          <input type="date" value={sDate} onChange={e=>setSDate(e.target.value)} style={S.dateInput}/>
          <div style={{...S.grid4,gridTemplateColumns:"repeat(3,1fr)"}}>
            {visibleStats.map(f=>(<div key={f.key} style={S.mIn}><label style={S.mLbl}>{f.label}{f.unit?`(${f.unit})`:""}</label>
              <input type="number" step="0.1" value={sv[f.key]||""} onChange={e=>setSv({...sv,[f.key]:e.target.value})} placeholder="--" style={S.nIn}/></div>))}
          </div>
          <button onClick={()=>setShowAll(!showAll)} style={S.expBtn}>{showAll?"ー 主要のみ":"＋ 詳細"}</button>
          <input value={sNote} onChange={e=>setSNote(e.target.value)} placeholder="体調メモ（任意）" style={S.noteIn}/>
          <button onClick={addBody} style={S.btnGreen} disabled={!STAT_FIELDS.some(f=>sv[f.key])||sAnalyzing}>体型を記録</button>
        </div>)}
        <div style={S.qSum}>📦食事{food.length} 🏃運動{exercises.length} 🌙睡眠{sleep.length} 📐体型{stats.length} <span style={{color:"#333"}}>v3</span></div>
      </div>)}
      {tab === "history" && (<div style={S.content}>
        <h2 style={S.secT}>🌙 睡眠</h2>
        {sleep.length===0?<p style={S.empty}>記録なし</p>:sleep.slice(0,30).map(s=>{
          const score = calcSleepScore(s);
          return (
          <div key={s.date+s.id} style={S.hI}>
            <div style={S.hH}>
              <span style={{...S.hD,color:mc.sleep}}>{fmtDate(s.date)}</span>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {score&&<span style={{fontSize:14,fontWeight:800,color:scoreColor(score)}}>{score}</span>}
                {s.source&&<span style={{...S.aiB,background:mc.sleep+"20",color:mc.sleep}}>{s.source==="shortcut"?"⌚":"auto"}</span>}
                <button onClick={()=>save(KEYS.sleep,sleep.filter(x=>x.date!==s.date||x.id!==s.id),setSleep)} style={S.dBtn}>×</button>
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#aaa",marginBottom:4}}>
              <span>🛏 {s.bedtime||"--"} → ⏰ {s.wakeTime||"--"}</span>
              <span style={{fontWeight:700,color:"#e8e8ec"}}>{fmtMin(s.totalMin)}</span>
            </div>
            <SleepBar s={s}/>
            <div style={{display:"flex",gap:8,marginTop:4,fontSize:10,color:"#666"}}>
              <span>深い:{fmtMin(s.deepMin)}</span><span>コア:{fmtMin(s.coreMin)}</span>
              <span>レム:{fmtMin(s.remMin)}</span><span>覚醒:{fmtMin(s.awakeMin)}</span>
              {s.avgHr&&<span>❤️{s.avgHr}</span>}
            </div>
          </div>);
        })}
        <h2 style={{...S.secT,marginTop:28}}>🍽️ 食事</h2>
        {food.length===0?<p style={S.empty}>記録なし</p>:food.slice(0,40).map(e=>(
          <div key={e.id} style={S.hI}><div style={S.hH}><span style={S.hD}>{fmtDate(e.date)}</span><span style={S.hM}>{mealEmoji[e.meal]} {mealLabels[e.meal]}{e.ai&&<span style={S.aiB}>AI</span>}</span><button onClick={()=>save(KEYS.food,food.filter(x=>x.id!==e.id),setFood)} style={S.dBtn}>×</button></div>
            <p style={S.hF}>{e.food}</p>
            <div style={S.hMc}>{e.calories!=null&&<span style={{color:mc.cal}}>{e.calories}kcal</span>}{e.protein!=null&&<span style={{color:mc.protein}}>P:{e.protein}</span>}{e.fat!=null&&<span style={{color:mc.fat}}>F:{e.fat}</span>}{e.carbs!=null&&<span style={{color:mc.carbs}}>C:{e.carbs}</span>}</div>
            {e.note&&<p style={S.hN}>💬 {e.note}</p>}</div>))}
        <h2 style={{...S.secT,marginTop:28}}>🏃 運動</h2>
        {exercises.length===0?<p style={S.empty}>記録なし</p>:exercises.slice(0,40).map(e=>(
          <div key={e.id} style={S.hI}><div style={S.hH}><span style={S.hD}>{fmtDate(e.date)}</span><span style={S.hM}>{e.ai&&<span style={S.aiB}>AI</span>}</span><button onClick={()=>save(KEYS.exercise,exercises.filter(x=>x.id!==e.id),setExercises)} style={S.dBtn}>×</button></div>
            <p style={S.hF}>{e.exercise||"運動"}</p>
            <div style={S.hMc}>{e.calories!=null&&<span style={{color:mc.exercise}}>-{e.calories}kcal</span>}{e.duration!=null&&<span>{e.duration}分</span>}</div>
            {e.note&&<p style={S.hN}>💬 {e.note}</p>}</div>))}
        <h2 style={{...S.secT,marginTop:28}}>📐 体型</h2>
        {stats.length===0?<p style={S.empty}>記録なし</p>:stats.slice(0,30).map(s=>(
          <div key={s.id} style={S.hI}><div style={S.hH}><span style={S.hD}>{fmtDate(s.date)}</span><span style={S.hM}>{s.ai&&<span style={S.aiB}>AI</span>}</span><button onClick={()=>save(KEYS.stats,stats.filter(x=>x.id!==s.id),setStats)} style={S.dBtn}>×</button></div>
            <div style={S.sR}>{STAT_FIELDS.filter(f=>s[f.key]!=null).map(f=>(<span key={f.key} style={S.sB}>{f.label} {s[f.key]}{f.unit}</span>))}</div>
            {s.note&&<p style={S.hN}>💬 {s.note}</p>}</div>))}
        <div style={{marginTop:40,textAlign:"center"}}>
          <details>
            <summary style={{fontSize:12,color:"#555",cursor:"pointer",marginBottom:12}}>🔄 デバイス間データ同期</summary>
            <div style={{padding:12,background:"#1a1a2e",borderRadius:8,marginBottom:12}}>
              <p style={{fontSize:11,color:"#888",marginBottom:8,lineHeight:1.6}}>
                PC ↔ スマホ間でデータを同期できます。<br/>元のデバイスでエクスポート → 先のデバイスでインポート
              </p>
              <button onClick={async()=>{
                const all = {food, exercises, stats, sleep, settings, _v:"3", _at: new Date().toISOString()};
                const json = JSON.stringify(all);
                try { await navigator.clipboard.writeText(json); setCopied(true); setTimeout(()=>setCopied(false),2000); }
                catch(e_) { const ta = document.createElement("textarea"); ta.value = json; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta); setCopied(true); setTimeout(()=>setCopied(false),2000); }
              }} style={{...S.btnSleep,width:"100%",marginBottom:8}}>
                {copied ? "✅ コピー済み！" : "📤 全データをクリップボードにコピー"}
              </button>
              <textarea
                id="syncImportBox"
                placeholder="他デバイスからコピーしたJSONを貼り付け"
                style={{...S.ta,height:60,fontSize:10,fontFamily:"monospace",marginBottom:8}}
              />
              <button onClick={async()=>{
                const text = document.getElementById("syncImportBox").value;
                if (!text.trim()) return;
                try {
                  const d = JSON.parse(text.trim());
                  if (d.food) await save(KEYS.food, d.food, setFood);
                  if (d.exercises) await save(KEYS.exercise, d.exercises, setExercises);
                  if (d.stats) await save(KEYS.stats, d.stats, setStats);
                  if (d.sleep) await save(KEYS.sleep, d.sleep, setSleep);
                  if (d.settings) { const merged = {...settings, ...d.settings}; setSettings(merged); try{await window.storage.set(KEYS.settings, JSON.stringify(merged));}catch(e_){} }
                  alert("✅ インポート完了: 食事" + (d.food?.length||0) + "件, 運動" + (d.exercises?.length||0) + "件, 睡眠" + (d.sleep?.length||0) + "件");
                  document.getElementById("syncImportBox").value = "";
                } catch(e_) { alert("❌ エラー: " + e_.message); }
              }} style={{...S.mBtn,width:"100%",borderColor:mc.sleep+"40",color:mc.sleep}}>
                📥 インポート
              </button>
            </div>
          </details>
          <button onClick={async()=>{if(confirm("全データ削除？")){await save(KEYS.food,[],setFood);await save(KEYS.stats,[],setStats);await save(KEYS.exercise,[],setExercises);await save(KEYS.sleep,[],setSleep);}}} style={S.resetBtn}>🗑 全リセット</button>
        </div>
      </div>)}
      {tab === "analytics" && (<div style={S.content}>
        <div style={{...S.card,background:"linear-gradient(135deg,#12121e,#1a1530)",borderColor:"#2d2850"}}>
          <h3 style={{...S.cardTitle,background:"linear-gradient(90deg,#a855f7,#60a5fa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",fontSize:16}}>🤖 AIコーチ</h3>
          <p style={{fontSize:12,color:"#888",marginTop:-4,marginBottom:14}}>食事・運動・睡眠・体組成を横断分析。パフォーマンス最大化の提案。</p>
          <div style={{display:"flex",gap:8,marginBottom:aiAnalysis?14:0}}>
            <button onClick={runAiAnalysis} disabled={aiAnalyzing||(food.length===0&&stats.length===0&&sleep.length===0)} style={{...S.btnAiCoach,flex:1,opacity:(aiAnalyzing||(food.length===0&&stats.length===0&&sleep.length===0))?0.5:1}}>
              {aiAnalyzing?<span style={{animation:"pulse 1s infinite"}}>🔍 分析中...</span>:"🤖 データを分析する"}
            </button>
            <button onClick={copyDataToClipboard} style={S.copyBtn}>
              {copied?"✅ コピー済":"📋 データコピー"}
            </button>
          </div>
          {aiAnalysis && (
            <div style={S.aiResult}>
              {aiAnalysis.split("\n").map((line, i) => {
                if (line.startsWith("## ") || line.startsWith("### ")) return <h4 key={i} style={{fontSize:13,fontWeight:700,color:"#ccc",marginTop:12,marginBottom:6}}>{line.replace(/^#+\s/,"")}</h4>;
                if (line.startsWith("**") && line.endsWith("**")) return <p key={i} style={{fontSize:12,fontWeight:700,color:"#ddd",marginTop:8,marginBottom:4}}>{line.replace(/\*\*/g,"")}</p>;
                if (line.startsWith("- ")) return <p key={i} style={{fontSize:12,color:"#bbb",paddingLeft:12,marginTop:2,marginBottom:2,lineHeight:1.6}}>• {line.slice(2)}</p>;
                if (line.trim() === "") return <div key={i} style={{height:6}}/>;
                return <p key={i} style={{fontSize:12,color:"#bbb",marginTop:2,marginBottom:2,lineHeight:1.6}}>{line}</p>;
              })}
            </div>
          )}
        </div>
        <div style={S.fRow}>{[7,14,30,90].map(d=>(<button key={d} onClick={()=>setFilterDays(d)} style={{...S.fB,...(filterDays===d?S.fBOn:{})}}>{d}日</button>))}</div>
        {(()=>{
          const avg = getAvgSleep();
          const recent = getRecentSleep();
          if (!avg || recent.length === 0) return <div style={S.card}><h3 style={S.cardTitle}>🌙 睡眠</h3><p style={S.empty}>睡眠データなし</p></div>;
          return (<div style={{...S.card,borderColor:mc.sleep+"30"}}>
            <h3 style={{...S.cardTitle,color:mc.sleep}}>🌙 睡眠サマリー（{avg.days}日平均）</h3>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              <div style={{...S.balBox,borderLeft:`4px solid ${mc.sleep}`}}>
                <div style={S.balVal}>{fmtMin(avg.total)}</div><div style={S.balLbl}>平均睡眠</div>
              </div>
              <div style={{...S.balBox,borderLeft:`4px solid ${scoreColor(avg.score)}`}}>
                <div style={{...S.balVal,color:scoreColor(avg.score)}}>{avg.score}<small style={{fontSize:12}}>/100</small></div><div style={S.balLbl}>平均スコア</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:14}}>
              {[{l:"深い",v:avg.deep,c:mc.deep},{l:"コア",v:avg.core,c:mc.core},{l:"レム",v:avg.rem,c:mc.rem},{l:"覚醒",v:avg.awake,c:mc.awake}].map(s=>(
                <div key={s.l} style={{textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:700,color:s.c}}>{fmtMin(s.v)}</div>
                  <div style={{fontSize:10,color:"#666"}}>{s.l}</div>
                </div>
              ))}
            </div>
            {avg.hr > 0 && <div style={{textAlign:"center",fontSize:12,color:"#888",marginBottom:12}}>❤️ 平均心拍数 <span style={{fontWeight:700,color:"#e8e8ec"}}>{avg.hr}bpm</span></div>}
            <h4 style={{fontSize:12,fontWeight:600,color:"#888",marginBottom:8}}>日別推移</h4>
            {recent.map(s => {
              const score = calcSleepScore(s);
              return (
                <div key={s.date} style={{...S.dR,flexDirection:"column",alignItems:"stretch",gap:4,paddingBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{...S.dD,color:mc.sleep}}>{fmtDate(s.date)}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center",fontSize:12}}>
                      <span>{fmtMin(s.totalMin)}</span>
                      <span>{s.bedtime} → {s.wakeTime}</span>
                      {score&&<span style={{fontWeight:700,color:scoreColor(score)}}>{score}</span>}
                    </div>
                  </div>
                  <SleepBar s={s}/>
                </div>
              );
            })}
          </div>);
        })()}
        <div style={S.card}>
          <h3 style={S.cardTitle}>🔥 カロリー収支</h3>
          {(()=>{
            const avg=getAvgFood(); const exByDate=getDailyExercise(); const exDays=Object.keys(exByDate);
            const avgExCal=exDays.length?Math.round(exDays.reduce((s,d)=>s+exByDate[d].cal,0)/(avg?.days||exDays.length)):0;
            const totalBurn=(tdee||0)+avgExCal; const balance=avg?avg.cal-totalBurn:null;
            return (<div>
              <div style={S.balGrid}>
                <div style={{...S.balBox,borderLeft:`4px solid ${mc.cal}`}}><div style={S.balVal}>{avg?.cal||"--"}<small style={{fontSize:12}}>kcal</small></div><div style={S.balLbl}>摂取/日</div></div>
                <div style={{...S.balBox,borderLeft:`4px solid ${mc.burn}`}}><div style={S.balVal}>{totalBurn||"--"}<small style={{fontSize:12}}>kcal</small></div><div style={S.balLbl}>消費/日</div></div>
              </div>
              {totalBurn>0&&(<div style={{background:"#1a1a2e",borderRadius:8,padding:12,marginTop:8,fontSize:12,color:"#aaa"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>BMR</span><span>{bmr||"--"}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>NEAT</span><span>+{neat||"--"}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span>運動(平均)</span><span style={{color:mc.exercise}}>+{avgExCal}</span></div>
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #2a2a40",paddingTop:6,marginTop:4}}>
                  <span style={{fontWeight:700,color:"#ccc"}}>収支</span>
                  <span style={{fontWeight:800,fontSize:16,color:balance!=null?(balance<0?"#34d399":"#f87171"):"#888"}}>{balance!=null?(balance>0?"+":"")+balance:"--"} kcal</span>
                </div>
              </div>)}
            </div>);
          })()}
        </div>
        {(()=>{
          const avg=getAvgFood(); if(!avg) return <p style={S.empty}>食事データなし</p>;
          return (<div style={S.card}><h3 style={S.cardTitle}>📊 PFC平均（{avg.days}日）</h3>
            <div style={S.avgGrid}>{[{v:avg.p,l:"P",u:"g",c:mc.protein},{v:avg.f,l:"F",u:"g",c:mc.fat},{v:avg.c,l:"C",u:"g",c:mc.carbs}].map(a=>(
              <div key={a.l} style={{...S.avgBox,borderLeft:`4px solid ${a.c}`}}><div style={S.avgVal}>{a.v}{a.u}</div><div style={S.avgLbl}>{a.l}</div></div>
            ))}</div></div>);
        })()}
        <div style={S.card}><h3 style={S.cardTitle}>📅 日別</h3>
          {getDailyFood().length===0?<p style={S.empty}>データなし</p>:getDailyFood().map(d=>{
            const exD=getDailyExercise()[d.date];
            return (<div key={d.date} style={S.dR}><span style={S.dD}>{fmtDate(d.date)}</span>
              <div style={S.dM}><span style={{color:mc.cal,fontWeight:700}}>+{d.cal}</span>{exD&&<span style={{color:mc.exercise}}>-{exD.cal}</span>}<span style={{color:mc.protein,fontSize:11}}>P:{d.p}</span><span style={{opacity:.4,fontSize:11}}>{d.n}食</span></div>
            </div>);
          })}</div>
        {stats.length>0&&(<div style={S.card}><h3 style={S.cardTitle}>📈 体型推移</h3>
          {[...stats].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,20).map(s=>(
            <div key={s.id} style={S.dR}><span style={S.dD}>{fmtDate(s.date)}</span>
              <div style={{...S.dM,flexWrap:"wrap"}}>{s.weight!=null&&<span style={{fontWeight:700}}>{s.weight}kg</span>}{s.bodyFat!=null&&<span>BF:{s.bodyFat}%</span>}{s.muscleMass!=null&&<span>MM:{s.muscleMass}</span>}</div>
            </div>
          ))}</div>)}
        <div style={S.card}><h3 style={S.cardTitle}>📤 CSVエクスポート</h3>
          <button onClick={exportAll} style={S.exportBtn}>📊 全データCSVダウンロード（睡眠含む）</button>
        </div>
      </div>)}
    </div>
  );
}
function ManualSleepForm({ onAdd }) {
  const [d, setD] = useState(today());
  const [bt, setBt] = useState("23:00");
  const [wt, setWt] = useState("06:30");
  const [deep, setDeep] = useState(""); const [core, setCore] = useState(""); const [rem, setRem] = useState(""); const [aw, setAw] = useState("");
  const [hr, setHr] = useState("");
  return (
    <div style={{marginTop:8}}>
      <input type="date" value={d} onChange={e=>setD(e.target.value)} style={S.dateInput}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        <div style={S.mIn}><label style={S.mLbl}>就寝</label><input type="time" value={bt} onChange={e=>setBt(e.target.value)} style={S.nIn}/></div>
        <div style={S.mIn}><label style={S.mLbl}>起床</label><input type="time" value={wt} onChange={e=>setWt(e.target.value)} style={S.nIn}/></div>
      </div>
      <div style={{...S.grid4,marginBottom:8}}>
        {[{l:"深い(分)",v:deep,s:setDeep,c:mc.deep},{l:"コア(分)",v:core,s:setCore,c:mc.core},{l:"レム(分)",v:rem,s:setRem,c:mc.rem},{l:"覚醒(分)",v:aw,s:setAw,c:mc.awake}].map(m=>(
          <div key={m.l} style={S.mIn}><label style={{...S.mLbl,color:m.c}}>{m.l}</label><input type="number" value={m.v} onChange={e=>m.s(e.target.value)} placeholder="--" style={S.nIn}/></div>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr",gap:6,marginBottom:8}}>
        <div style={S.mIn}><label style={S.mLbl}>心拍数(avg)</label><input type="number" value={hr} onChange={e=>setHr(e.target.value)} placeholder="--" style={S.nIn}/></div>
      </div>
      <button onClick={() => {
        const totalMin = (deep?+deep:0) + (core?+core:0) + (rem?+rem:0);
        onAdd({ id: Date.now(), date: d, bedtime: bt, wakeTime: wt, totalMin: totalMin || null, deepMin: deep?+deep:null, coreMin: core?+core:null, remMin: rem?+rem:null, awakeMin: aw?+aw:null, avgHr: hr?+hr:null, source: "manual" });
        setDeep(""); setCore(""); setRem(""); setAw(""); setHr("");
      }} style={S.btnSleep}>睡眠を記録</button>
    </div>
  );
}
const S={
  container:{fontFamily:"'Helvetica Neue','Hiragino Kaku Gothic Pro',sans-serif",maxWidth:520,margin:"0 auto",background:"#0a0a0f",minHeight:"100vh",color:"#e8e8ec"},
  loadWrap:{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#0a0a0f",color:"#888"},
  header:{padding:"24px 20px 14px",background:"linear-gradient(135deg,#0f0f18,#141422)",borderBottom:"1px solid #1e1e30",display:"flex",justifyContent:"space-between",alignItems:"flex-end"},
  title:{fontSize:24,fontWeight:800,letterSpacing:5,margin:0,background:"linear-gradient(90deg,#60a5fa,#818cf8,#34d399)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  subtitle:{fontSize:11,color:"#666",marginTop:3,letterSpacing:1},
  badge:{fontSize:10,color:"#60a5fa",background:"#60a5fa15",padding:"3px 8px",borderRadius:16},
  tabs:{display:"flex",background:"#0e0e16",borderBottom:"1px solid #1e1e30"},
  tab:{flex:1,padding:"11px 6px",border:"none",background:"transparent",color:"#666",fontSize:13,cursor:"pointer",borderBottom:"2px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",gap:5},
  tabOn:{color:"#e8e8ec",borderBottomColor:"#60a5fa",background:"#12121e"},
  content:{padding:"14px 14px 40px"},
  subTabs:{display:"flex",gap:5,marginBottom:14},
  subTab:{flex:1,padding:"9px 4px",border:"1px solid #1e1e30",borderRadius:8,background:"#12121e",color:"#888",fontSize:11,cursor:"pointer",textAlign:"center"},
  subTabOn:{background:"#60a5fa15",borderColor:"#60a5fa",color:"#60a5fa"},
  card:{background:"#12121e",borderRadius:12,padding:18,marginBottom:14,border:"1px solid #1e1e30"},
  cardTitle:{fontSize:14,fontWeight:700,marginTop:0,marginBottom:12,color:"#ccc"},
  upLabel:{display:"block",border:"2px dashed #2a2a45",borderRadius:10,padding:"18px 14px",textAlign:"center",cursor:"pointer",background:"#0f0f1a"},
  upInner:{display:"flex",flexDirection:"column",alignItems:"center",gap:4},
  prevWrap:{position:"relative",borderRadius:10,overflow:"hidden"},
  prevImg:{width:"100%",maxHeight:220,objectFit:"cover",display:"block",borderRadius:10},
  overlay:{position:"absolute",inset:0,background:"rgba(0,0,0,.7)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,borderRadius:10},
  spinner:{width:28,height:28,border:"3px solid #333",borderTopColor:"#60a5fa",borderRadius:"50%",animation:"spin .8s linear infinite"},
  olText:{color:"#60a5fa",fontSize:13,fontWeight:600},
  clrBtn:{position:"absolute",top:6,right:6,background:"rgba(0,0,0,.6)",border:"none",color:"#fff",width:26,height:26,borderRadius:"50%",fontSize:13,cursor:"pointer"},
  conf:{textAlign:"center",padding:6,fontSize:11,color:"#aaa",background:"#1a1a2e",borderRadius:6,marginBottom:8},
  aiB:{display:"inline-block",marginLeft:5,padding:"1px 5px",borderRadius:3,fontSize:9,fontWeight:700,background:"#60a5fa25",color:"#60a5fa"},
  row:{marginBottom:10},
  dateInput:{background:"#1a1a2e",border:"1px solid #2a2a40",borderRadius:8,color:"#e8e8ec",padding:"7px 10px",fontSize:13,marginBottom:8,width:"100%",boxSizing:"border-box"},
  mealBtns:{display:"flex",gap:5,flexWrap:"wrap"},
  mBtn:{padding:"5px 10px",borderRadius:16,border:"1px solid #2a2a40",background:"#1a1a2e",color:"#888",fontSize:11,cursor:"pointer"},
  mBtnOn:{background:"#60a5fa20",borderColor:"#60a5fa",color:"#60a5fa"},
  ta:{width:"100%",background:"#1a1a2e",border:"1px solid #2a2a40",borderRadius:8,color:"#e8e8ec",padding:10,fontSize:13,resize:"vertical",marginBottom:10,boxSizing:"border-box",lineHeight:1.6},
  aiBtn:{position:"absolute",bottom:8,right:8,padding:"5px 12px",borderRadius:16,border:"1px solid #60a5fa40",background:"#60a5fa15",color:"#60a5fa",fontSize:11,fontWeight:600,cursor:"pointer"},
  grid4:{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10},
  mIn:{textAlign:"center"},
  mLbl:{fontSize:10,fontWeight:700,display:"block",marginBottom:3,color:"#888",letterSpacing:.5},
  nIn:{width:"100%",background:"#1a1a2e",border:"1px solid #2a2a40",borderRadius:6,color:"#e8e8ec",padding:"7px 3px",fontSize:14,textAlign:"center",boxSizing:"border-box"},
  noteIn:{width:"100%",background:"#1a1a2e",border:"1px solid #2a2a40",borderRadius:6,color:"#e8e8ec",padding:"8px 10px",fontSize:12,marginBottom:10,boxSizing:"border-box"},
  btnBlue:{width:"100%",padding:11,border:"none",borderRadius:8,background:"linear-gradient(90deg,#3B82F6,#2563EB)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnGreen:{width:"100%",padding:11,border:"none",borderRadius:8,background:"linear-gradient(90deg,#10B981,#059669)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnPurple:{width:"100%",padding:11,border:"none",borderRadius:8,background:"linear-gradient(90deg,#a855f7,#7c3aed)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnSleep:{width:"100%",padding:11,border:"none",borderRadius:8,background:"linear-gradient(90deg,#6366f1,#4338ca)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"},
  btnAiCoach:{padding:12,border:"none",borderRadius:8,background:"linear-gradient(90deg,#a855f7,#6366f1)",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer"},
  copyBtn:{padding:"12px 16px",border:"1px solid #2a2a40",borderRadius:8,background:"#1a1a2e",color:"#aaa",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"},
  aiResult:{background:"#0f0f1a",borderRadius:8,padding:16,border:"1px solid #2a2a40",maxHeight:400,overflowY:"auto"},
  expBtn:{width:"100%",padding:"8px",border:"1px solid #2a2a40",borderRadius:6,background:"transparent",color:"#888",fontSize:11,cursor:"pointer",marginBottom:10},
  qSum:{textAlign:"center",padding:12,fontSize:12,color:"#555"},
  secT:{fontSize:15,fontWeight:700,marginBottom:10,color:"#ccc"},
  empty:{color:"#555",fontSize:13,textAlign:"center",padding:16},
  hI:{background:"#12121e",borderRadius:8,padding:"12px 14px",marginBottom:6,border:"1px solid #1e1e30"},
  hH:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4},
  hD:{fontSize:11,color:"#60a5fa",fontWeight:600},
  hM:{fontSize:11,color:"#888",display:"flex",alignItems:"center"},
  dBtn:{background:"transparent",border:"none",color:"#555",fontSize:16,cursor:"pointer",padding:"0 3px"},
  hF:{fontSize:13,margin:"3px 0 6px",color:"#ddd",lineHeight:1.4},
  hMc:{display:"flex",gap:10,fontSize:11,fontWeight:600},
  hN:{fontSize:11,color:"#666",marginTop:4,marginBottom:0},
  sR:{display:"flex",gap:5,flexWrap:"wrap",marginTop:3},
  sB:{background:"#1a1a2e",padding:"2px 7px",borderRadius:5,fontSize:11,color:"#aaa"},
  resetBtn:{background:"transparent",border:"1px solid #333",borderRadius:6,color:"#555",padding:"8px 20px",fontSize:12,cursor:"pointer"},
  fRow:{display:"flex",gap:6,marginBottom:14},
  fB:{padding:"7px 14px",borderRadius:16,border:"1px solid #2a2a40",background:"#12121e",color:"#888",fontSize:12,cursor:"pointer"},
  fBOn:{background:"#60a5fa20",borderColor:"#60a5fa",color:"#60a5fa"},
  balGrid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8},
  balBox:{background:"#1a1a2e",borderRadius:8,padding:"12px 14px"},
  balVal:{fontSize:20,fontWeight:800,color:"#e8e8ec"},
  balLbl:{fontSize:10,color:"#888",marginTop:2},
  avgGrid:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8},
  avgBox:{background:"#1a1a2e",borderRadius:8,padding:"10px 12px"},
  avgVal:{fontSize:18,fontWeight:800,color:"#e8e8ec"},
  avgLbl:{fontSize:10,color:"#888",marginTop:2},
  dR:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1a1a2e"},
  dD:{fontSize:12,color:"#60a5fa",fontWeight:600,minWidth:72},
  dM:{display:"flex",gap:8,fontSize:12},
  exportBtn:{width:"100%",padding:11,border:"1px solid #2a2a40",borderRadius:8,background:"#1a1a2e",color:"#aaa",fontSize:12,cursor:"pointer"},
};

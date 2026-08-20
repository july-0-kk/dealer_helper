"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Pause, Plus, Sparkles, Square, X } from "lucide-react";
import type { MapStore, ProductInsight } from "./StoreMap";

type ChangeType = "增加" | "减少" | "后续补货";
type ProductSignal = ProductInsight["signal"];
type ProductChange = { id: string; product: string; type: ChangeType; reason: string; signal: ProductSignal; expectation: string };
const LOCAL_OLLAMA_URL = "http://127.0.0.1:11434";

function defaultSignal(type: ChangeType, reason: string): ProductSignal {
  if (type === "减少") return "放缓";
  if (type === "后续补货" || /(热销|好卖|卖得快|销量好|缺货|紧俏)/.test(reason)) return "热销";
  return "待观察";
}

function defaultExpectation(type: ChangeType, product: string) {
  if (type === "减少") return `下次拜访核对 ${product} 的库存与替代品`;
  if (type === "后续补货") return `下次拜访前确认 ${product} 的到货和陈列`;
  return `建议增加 ${product} 的铺货与陈列，观察后续动销`;
}

function parseModelSuggestions(content: string): ProductChange[] {
  const cleaned = content.replace(/```json|```/gi, "").trim();
  const parsed = JSON.parse(cleaned);
  const rows = Array.isArray(parsed) ? parsed : parsed?.suggestions;
  if (!Array.isArray(rows)) return [];

  const allowed = new Set<ChangeType>(["增加", "减少", "后续补货"]);
  return rows
    .filter((row) => row && typeof row.product === "string" && allowed.has(row.type as ChangeType))
    .slice(0, 10)
    .map((row, index) => ({
      id: `model-${Date.now()}-${index}`,
      product: row.product.trim(),
      type: row.type as ChangeType,
      reason: typeof row.reason === "string" ? row.reason.slice(0, 48) : "根据拜访谈话整理",
      signal: ["热销", "正常", "放缓", "待观察"].includes(row.signal) ? row.signal as ProductSignal : defaultSignal(row.type as ChangeType, typeof row.reason === "string" ? row.reason : ""),
      expectation: typeof row.expectation === "string" && row.expectation.trim() ? row.expectation.slice(0, 60) : defaultExpectation(row.type as ChangeType, row.product.trim()),
    }))
    .filter((row) => row.product.length > 0);
}

function productCandidates(text: string, products: string[]) {
  const candidates = new Set(products.filter(Boolean));
  const pattern = /(?:增加|补充|补货|进货|减少|下架|滞销|需要|缺少|后续|下次)[：:，,\s]*([^，。；、\s]{2,14})/g;
  for (const match of text.matchAll(pattern)) {
    const product = match[1].replace(/(库存|数量|一些|一点|一下|产品)$/g, "").trim();
    if (product.length >= 2) candidates.add(product);
  }
  return [...candidates].slice(0, 12);
}

function analyzeTranscript(text: string, products: string[]) {
  const candidates = productCandidates(text, products);
  const result: ProductChange[] = [];
  candidates.forEach((product) => {
    const around = text.slice(Math.max(0, text.indexOf(product) - 28), text.indexOf(product) + product.length + 28);
    const type: ChangeType = /(减少|下架|滞销|压货|退货)/.test(around) ? "减少" : /(后续|下次|预计|月底|下周|再补)/.test(around) ? "后续补货" : "增加";
    if (text.includes(product)) {
      const reason = around || "从拜访谈话中识别";
      result.push({ id: `${product}-${type}`, product, type, reason, signal: defaultSignal(type, reason), expectation: defaultExpectation(type, product) });
    }
  });
  return result;
}

export default function VisitAssistant({ store, onClose, onSave }: { store: MapStore; onClose: () => void; onSave: (store: MapStore) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [suggestions, setSuggestions] = useState<ProductChange[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [modelConnected, setModelConnected] = useState<boolean | null>(null);
  const [notice, setNotice] = useState("录音仅保留在当前浏览器；接入语音服务后可自动云端转写。");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => () => stopRecording(), []);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      const audioChunks: Blob[] = [];
      recorder.ondataavailable = (event) => { if (event.data.size) audioChunks.push(event.data); };
      recorder.onstop = () => {
        if (!audioChunks.length) return;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(URL.createObjectURL(new Blob(audioChunks, { type: recorder.mimeType || "audio/webm" })));
      };
      recorder.start();
      const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.lang = "zh-CN";
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let finalText = "", temporary = "";
          for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const value = event.results[index][0]?.transcript || "";
            if (event.results[index].isFinal) finalText += value;
            else temporary += value;
          }
          if (finalText) setTranscript((value) => `${value}${finalText}`);
          setInterim(temporary);
        };
        recognition.onerror = () => setNotice("当前浏览器无法实时转写，但录音仍在本机进行；接入语音 API 后可稳定转写。");
        recognition.start();
        recognitionRef.current = recognition;
      } else setNotice("当前浏览器不支持实时转写。录音已开始，稍后可补充文字记录或接入语音 API。");
      setSeconds(0);
      setRecording(true);
    } catch {
      setNotice("未获得麦克风权限。请允许浏览器使用麦克风后再开始录音。");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    recognitionRef.current?.stop?.();
    recognitionRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setInterim("");
    setRecording(false);
  }

  async function runAnalysis() {
    const text = transcript.trim();
    if (!text) {
      setNotice("请先录音或填写谈话记录，再进行产品分析。");
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch(`${LOCAL_OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "qwen3.5:4b",
          stream: false,
          think: false,
          format: "json",
          options: { temperature: 0.1 },
          messages: [
            { role: "system", content: "你是防水产品渠道拜访助手。只输出合法 JSON，不要输出解释、Markdown 或其他字段。" },
            {
              role: "user",
              content: `请根据以下门店拜访谈话，生成可落地的产品经营模块。\n门店：${store.name}\n现有产品：${store.products.join("、") || "暂无记录"}\n谈话记录：${text}\n\n仅输出：{"suggestions":[{"product":"产品名","type":"增加|减少|后续补货","signal":"热销|正常|放缓|待观察","reason":"不超过24字","expectation":"下一步预期，不超过30字"}]}。每个产品只输出一条。没有明确信息时 suggestions 为空数组。不得编造谈话中不存在的产品。`,
            },
          ],
        }),
      });
      if (!response.ok) throw new Error(`local model ${response.status}`);
      const payload = await response.json();
      const result = parseModelSuggestions(payload?.message?.content || "");
      setSuggestions(result);
      setModelConnected(true);
      setNotice(result.length ? "本机免费模型已完成分析，请确认后同步到门店。" : "本机模型未识别到明确产品动作；你仍可手动添加建议。");
    } catch {
      const result = analyzeTranscript(text, store.products);
      setSuggestions(result);
      setModelConnected(false);
      setNotice(result.length ? "本机模型暂未连接，已使用基础规则整理建议。" : "本机模型暂未连接，且基础规则未识别到产品；可手动添加建议。");
    } finally {
      setAnalyzing(false);
    }
  }

  function applyChanges() {
    const activeProducts = new Set(store.products);
    const pendingProducts = new Set(store.pendingProducts || []);
    const insightMap = new Map((store.productInsights || []).map((item) => [item.product, item]));
    const updatedAt = new Date().toISOString();
    suggestions.forEach((item) => {
      if (!item.product.trim()) return;
      const product = item.product.trim();
      if (item.type === "增加") activeProducts.add(product);
      if (item.type === "减少") activeProducts.delete(product);
      if (item.type === "后续补货") { activeProducts.add(product); pendingProducts.add(product); }
      insightMap.set(product, { product, action: item.type === "后续补货" ? "补货" : item.type, signal: item.signal, reason: item.reason || "根据拜访谈话整理", expectation: item.expectation || defaultExpectation(item.type, product), updatedAt });
    });
    onSave({ ...store, products: [...activeProducts], pendingProducts: [...pendingProducts], productInsights: [...insightMap.values()], lastVisitTranscript: transcript, lastVisitAt: updatedAt, visit: `今天 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` });
    onClose();
  }

  return <div className="visit-assistant-bg" role="dialog" aria-modal="true" aria-label="智能拜访记录" onClick={onClose}>
    <section className="visit-assistant" onClick={(event) => event.stopPropagation()}>
      <header><div><small>智能拜访记录</small><h2>{store.name}</h2><p>录音、转写和产品建议将在确认后同步到该网点。</p></div><button onClick={onClose} aria-label="关闭"><X size={18} /></button></header>
      <div className="recording-panel">
        <button className={`record-button ${recording ? "recording" : ""}`} onClick={recording ? stopRecording : startRecording}>{recording ? <Square size={17} fill="currentColor" /> : <Mic size={18} />} {recording ? "结束录音" : "开始录音"}</button>
        <strong>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong>
        <span>{recording ? "正在录音与实时转写" : "录音未开始"}</span>
      </div>
      <p className="recording-notice">{notice}</p>
      {audioUrl && <audio className="visit-audio" controls src={audioUrl}>当前浏览器不支持录音回放。</audio>}
      <label className="transcript-label">谈话记录<textarea value={`${transcript}${interim}`} onChange={(event) => { setTranscript(event.target.value); setInterim(""); }} placeholder="开始录音后，实时转写会显示在这里；也可以手动补充关键谈话。" /></label>
      <div className="assistant-actions"><button className="analyze-button" onClick={runAnalysis} disabled={analyzing}><Sparkles size={15} />{analyzing ? "本机模型分析中…" : modelConnected === false ? "重新连接本机模型" : "用本机模型分析"}</button><button onClick={() => setSuggestions((value) => [...value, { id: String(Date.now()), product: "", type: "增加", reason: "手动补充", signal: "待观察", expectation: "下次拜访观察实际动销" }])}><Plus size={15} />添加建议</button></div>
      <div className="suggestion-list"><div><b>产品调整建议</b><small>可修改后再同步</small></div>{suggestions.length ? suggestions.map((item, index) => <article key={item.id}><input value={item.product} placeholder="产品名称" onChange={(event) => setSuggestions((value) => value.map((row, rowIndex) => rowIndex === index ? { ...row, product: event.target.value } : row))} /><select value={item.type} onChange={(event) => setSuggestions((value) => value.map((row, rowIndex) => rowIndex === index ? { ...row, type: event.target.value as ChangeType } : row))}><option>增加</option><option>减少</option><option>后续补货</option></select><input value={item.reason} placeholder="原因" onChange={(event) => setSuggestions((value) => value.map((row, rowIndex) => rowIndex === index ? { ...row, reason: event.target.value } : row))} /><button onClick={() => setSuggestions((value) => value.filter((_, rowIndex) => rowIndex !== index))} aria-label="删除建议"><Pause size={13} /></button></article>) : <p>尚无建议。完成录音后点击“分析产品动作”。</p>}</div>
      {!!suggestions.length && <section className="module-preview" aria-label="AI 产品经营模块预览"><div><b>AI 产品经营模块</b><small>确认后将写入门店档案</small></div><div className="module-preview-grid">{suggestions.map((item) => <article key={`module-${item.id}`} className={item.type}><header><strong>{item.product || "待填写产品"}</strong><span>{item.type === "后续补货" ? "补货计划" : item.type === "增加" ? "建议增加" : "建议减少"}</span></header><p>{item.signal} · {item.reason || "待补充销售判断"}</p><small>预期：{item.expectation || defaultExpectation(item.type, item.product || "该产品")}</small></article>)}</div></section>}
      <footer><span>后续补货会作为待跟进产品保存在门店详情中。</span><button className="apply-button" onClick={applyChanges}>确认并同步门店</button></footer>
    </section>
  </div>;
}

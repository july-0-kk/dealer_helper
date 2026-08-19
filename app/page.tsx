"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Store = { id: string; name: string; region: string; dealer: string; owner: string; level: string; products: string[]; visit: string; status: "正常" | "待跟进" };
const seed: Store[] = [
  { id: "MD001", name: "东区防水建材门店001", region: "东区", dealer: "杭州新材贸易", owner: "王晨", level: "S", products: ["A产品", "B产品", "E产品", "I产品"], visit: "今天 09:42", status: "正常" },
  { id: "MD002", name: "南区防水建材门店002", region: "南区", dealer: "宁波甬城代理", owner: "李杰", level: "S", products: ["B产品", "C产品", "E产品", "I产品"], visit: "昨天 16:18", status: "待跟进" },
  { id: "MD003", name: "西区防水建材门店003", region: "西区", dealer: "嘉兴恒盛建材", owner: "赵一鸣", level: "A", products: ["A产品", "D产品", "F产品"], visit: "8 月 16 日", status: "正常" },
  { id: "MD004", name: "北区防水建材门店004", region: "北区", dealer: "绍兴越达贸易", owner: "陈浩", level: "A", products: ["C产品", "G产品", "J产品", "K产品"], visit: "8 月 15 日", status: "正常" },
];

export default function Home() {
  const [stores, setStores] = useState<Store[]>(seed);
  const [activeId, setActiveId] = useState("MD001");
  const [nav, setNav] = useState("门店档案");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Store | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => { const raw = localStorage.getItem("landun-stores-v2"); if (raw) setStores(JSON.parse(raw)); }, []);
  useEffect(() => { localStorage.setItem("landun-stores-v2", JSON.stringify(stores)); }, [stores]);
  const filtered = useMemo(() => stores.filter(s => `${s.id}${s.name}${s.region}${s.dealer}${s.products.join("")}`.toLowerCase().includes(query.toLowerCase())), [stores, query]);
  const active = stores.find(s => s.id === activeId) || filtered[0] || stores[0];
  const toast = (msg: string) => { setNotice(msg); window.setTimeout(() => setNotice(""), 2800); };

  function importFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array", cellDates: true });
        const name = wb.SheetNames.includes("出货明细") ? "出货明细" : wb.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name], { defval: "" }); const map = new Map<string, Store>();
        rows.forEach(r => { const id = String(r["门店编号"] || r["门店ID"] || r["门店名称"] || ""); const store = map.get(id) || { id, name: String(r["门店名称"] || "未命名门店"), region: String(r["区域"] || "待补充"), dealer: String(r["代理商"] || r["经销商"] || "未关联代理商"), owner: String(r["业务员"] || r["负责人"] || "待补充"), level: String(r["门店等级"] || r["等级"] || "-"), products: [], visit: "尚未拜访", status: "正常" as const }; const product = String(r["产品名称"] || r["产品代码"] || ""); if (product && !store.products.includes(product)) store.products.push(product); map.set(id, store); });
        const next = [...map.values()]; if (!next.length) throw new Error(); setStores(next); setActiveId(next[0].id); setNav("门店档案"); toast(`已导入 ${next.length} 家门店的产品清单`);
      } catch { toast("导入失败：请确认文件含有“出货明细”页"); }
    }; reader.readAsArrayBuffer(file); e.target.value = "";
  }
  function saveEdit() { if (!editing) return; setStores(prev => prev.map(s => s.id === editing.id ? editing : s)); setEditing(null); toast("门店资料已保存"); }
  function addStore() { const s: Store = { id: `NEW${stores.length + 1}`, name: "新建门店", region: "待补充区域", dealer: "待关联代理商", owner: "待填写", level: "A", products: [], visit: "尚未拜访", status: "待跟进" }; setStores([s, ...stores]); setActiveId(s.id); setEditing(s); }

  return <main className="shell">
    <aside className="side"><div className="logo"><span>澜</span><div><b>澜盾防水</b><small>经销商工作台</small></div></div><div className="side-title">工作台</div>{["总览", "门店档案", "订单导入", "拜访记录"].map(item => <button className={`nav ${nav === item ? "on" : ""}`} key={item} onClick={() => setNav(item)}><i>{item === "总览" ? "⌂" : item === "门店档案" ? "▦" : item === "订单导入" ? "↥" : "✓"}</i>{item}{item === "订单导入" && <em>导入</em>}</button>)}<div className="side-bottom"><div className="online"><i /> 数据已同步</div><div className="profile"><span>林</span><div><b>林晓峰</b><small>销售主管</small></div></div></div></aside>
    <section className="main"><header className="header"><div><small>2026 年 8 月 19 日 · 星期三</small><h1>{nav}</h1></div><div className="header-actions"><button className="outline" onClick={() => document.getElementById("file-input")?.click()}>↥ 导入出货表</button><input id="file-input" hidden type="file" accept=".xlsx,.xls,.csv" onChange={importFile} /><button className="solid" onClick={addStore}>＋ 新建门店</button></div></header>
      {nav === "门店档案" || nav === "总览" ? <div className="page"><div className="summary"><div><small>门店总数</small><strong>{stores.length}</strong><span>家门店已建立档案</span></div><div><small>已记录产品</small><strong>{new Set(stores.flatMap(s => s.products)).size}</strong><span>个不同产品</span></div><div><small>待跟进</small><strong className="orange-text">{stores.filter(s => s.status === "待跟进").length}</strong><span>家需要回访</span></div><div><small>本月导入</small><strong>2,468</strong><span>条出货明细</span></div></div><div className="workspace"><div className="list-panel"><div className="panel-head"><div><h2>门店货品台账</h2><p>每家门店卖什么，一眼看清</p></div><label className="mini-upload">导入清单<input type="file" accept=".xlsx,.xls,.csv" onChange={importFile} /></label></div><div className="search-row"><div className="search">⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索门店、编号、代理商或产品" /></div><button className="filter">筛选　⌄</button></div><div className="count">全部门店 <b>{filtered.length}</b><span>按最近拜访排序　⌄</span></div><div className="store-list">{filtered.map(s => <button className={`store ${active?.id === s.id ? "selected" : ""}`} key={s.id} onClick={() => setActiveId(s.id)}><span className="store-badge">{s.name.slice(0, 1)}</span><span className="store-name"><b>{s.name}</b><small>{s.id} · {s.region}</small></span><span className="product-tags">{s.products.slice(0, 3).map(p => <em key={p}>{p}</em>)}{s.products.length > 3 && <em>+{s.products.length - 3}</em>}<small>{s.products.length} 个产品</small></span><span className={`state ${s.status === "正常" ? "good" : "wait"}`}>{s.status}</span><strong className="arrow">›</strong></button>)}</div></div>
          {active && <div className="detail-panel"><div className="detail-header"><div><small>门店档案 · {active.id}</small><h2>{active.name}</h2><p>{active.region}　/　{active.dealer}</p></div><button className="edit" onClick={() => setEditing({ ...active })}>编辑资料　✎</button></div><div className="owner"><span>{active.owner.slice(0, 1)}</span><div><small>负责人 / 业务员</small><b>{active.owner}</b></div><div className="last"><small>最近拜访</small><b>{active.visit}</b></div></div><div className="products-head"><h3>已铺产品 <b>{active.products.length}</b></h3><button onClick={() => { const v = window.prompt("新增产品名称"); if (v) setStores(prev => prev.map(s => s.id === active.id ? { ...s, products: [...s.products, v] } : s)); }}>＋ 添加产品</button></div><div className="products">{active.products.map((p, i) => <div className="product" key={p}><span className={`product-icon c${i % 5}`}>{p.slice(0, 1)}</span><div><b>{p}</b><small>来自出货明细 · 已记录</small></div><button onClick={() => setStores(prev => prev.map(s => s.id === active.id ? { ...s, products: s.products.filter(x => x !== p) } : s))}>×</button></div>)}{!active.products.length && <div className="empty">暂无产品，可从出货表导入或手动添加</div>}</div><div className="detail-bottom"><span>门店等级 <b>{active.level}</b></span><button className="visit-btn">✓ 记录本次拜访</button></div></div>}</div></div> : <div className="empty-page"><div>{nav === "订单导入" ? "↥" : "✓"}</div><h2>{nav}</h2><p>{nav === "订单导入" ? "上传代理商出货表，系统将自动按门店归类产品。" : "这里用于集中管理销售人员的拜访记录。"}</p>{nav === "订单导入" && <label className="solid import-big">选择出货表<input type="file" accept=".xlsx,.xls,.csv" onChange={importFile} /></label>}</div>}
    </section>{editing && <div className="backdrop" onClick={() => setEditing(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-top"><div><small>编辑门店档案</small><h2>{editing.name}</h2></div><button onClick={() => setEditing(null)}>×</button></div><label>门店名称<input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} /></label><div className="grid"><label>门店编号<input value={editing.id} onChange={e => setEditing({ ...editing, id: e.target.value })} /></label><label>区域<input value={editing.region} onChange={e => setEditing({ ...editing, region: e.target.value })} /></label><label>代理商<input value={editing.dealer} onChange={e => setEditing({ ...editing, dealer: e.target.value })} /></label><label>负责人<input value={editing.owner} onChange={e => setEditing({ ...editing, owner: e.target.value })} /></label></div><label>在售产品（逗号分隔）<textarea value={editing.products.join("，")} onChange={e => setEditing({ ...editing, products: e.target.value.split(/[，,]/).map(x => x.trim()).filter(Boolean) })} /></label><div className="modal-actions"><button onClick={() => setEditing(null)}>取消</button><button className="solid" onClick={saveEdit}>保存修改</button></div></div></div>}{notice && <div className="notice">✓　{notice}</div>}</main>;
}

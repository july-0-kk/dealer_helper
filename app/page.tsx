"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

type Store = {
  id?: string;
  name: string;
  city: string;
  dealer: string;
  contact: string;
  lastVisit: string;
  products: string[];
  health: "正常" | "待跟进";
};

const initialStores: Store[] = [
  { name: "宏达建材·城南店", city: "杭州 · 上城区", dealer: "杭州新材贸易", contact: "王建国", lastVisit: "今天 09:42", products: ["堵漏王", "K11 防水浆料", "JS 聚合物", "高弹防水涂料"], health: "正常" },
  { name: "家家乐防水专营店", city: "宁波 · 鄞州区", dealer: "宁波甬城代理", contact: "周晓梅", lastVisit: "昨天 16:18", products: ["彩色防水涂料", "瓷砖胶", "堵漏王"], health: "待跟进" },
  { name: "老李装饰材料", city: "嘉兴 · 南湖区", dealer: "嘉兴恒盛建材", contact: "李海峰", lastVisit: "8 月 16 日", products: ["K11 防水浆料", "JS 聚合物"], health: "正常" },
  { name: "安心防水材料店", city: "绍兴 · 越城区", dealer: "绍兴越达贸易", contact: "陈芳", lastVisit: "8 月 15 日", products: ["高弹防水涂料", "堵漏王", "彩色防水涂料", "瓷砖胶"], health: "正常" },
];

const productColors: Record<string, string> = { "堵漏王": "orange", "K11 防水浆料": "blue", "JS 聚合物": "violet", "高弹防水涂料": "green", "彩色防水涂料": "pink", "瓷砖胶": "yellow" };

export default function Home() {
  const [stores, setStores] = useState(initialStores);
  const [query, setQuery] = useState("");
  const [activeStore, setActiveStore] = useState(0);
  const [toast, setToast] = useState("");
  const [section, setSection] = useState("总览");
  const [editing, setEditing] = useState<Store | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("landun-stores");
      if (saved) setStores(JSON.parse(saved));
    } catch { /* ignore malformed local data */ }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("landun-stores", JSON.stringify(stores));
  }, [stores]);

  const filtered = useMemo(() => stores.filter((s) => `${s.name}${s.city}${s.dealer}${s.products.join("")}`.toLowerCase().includes(query.toLowerCase())), [stores, query]);
  const selected = filtered[activeStore] ?? filtered[0] ?? stores[0];

  function importList(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames.includes("出货明细") ? "出货明细" : workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
        const grouped = new Map<string, Store>();
        rows.forEach((row) => {
          const id = String(row["门店编号"] || row["门店ID"] || row["门店名称"] || "").trim();
          const name = String(row["门店名称"] || row["客户名称"] || id || "未命名门店").trim();
          if (!id && !name) return;
          const store = grouped.get(id || name) || { id, name, city: String(row["区域"] || "待补充区域"), dealer: String(row["代理商"] || row["经销商"] || "未关联代理商"), contact: String(row["老板"] || row["负责人"] || "待补充"), lastVisit: "尚未拜访", products: [], health: "正常" };
          const product = String(row["产品名称"] || row["产品"] || row["产品代码"] || "").trim();
          if (product && !store.products.includes(product)) store.products.push(product);
          if (row["业务员"] && store.contact === "待补充") store.contact = String(row["业务员"]);
          grouped.set(id || name, store);
        });
        if (grouped.size) {
          setStores(Array.from(grouped.values()));
          setActiveStore(0);
          setSection("门店档案");
          setToast(`已导入「${file.name}」：${grouped.size} 家门店，按产品自动归类`);
        } else throw new Error("没有识别到门店");
      } catch {
        setToast("导入失败，请确认文件包含“出货明细”页和门店/产品列");
      }
      setTimeout(() => setToast(""), 3500);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  function addStore() {
    setStores((prev) => [{ name: "新门店（待完善）", city: "待填写地区", dealer: "待关联代理商", contact: "待填写", lastVisit: "尚未拜访", products: [], health: "待跟进" }, ...prev]);
    setActiveStore(0);
    setToast("已新建门店，请在右侧补充资料");
    setTimeout(() => setToast(""), 2800);
  }

  function saveStore() {
    if (!editing) return;
    setStores((prev) => prev.map((store) => store.name === editing.name ? editing : store));
    setEditing(null);
    setToast("门店资料已保存");
    setTimeout(() => setToast(""), 2400);
  }

  function addProduct() {
    const value = window.prompt("请输入产品名称");
    if (!value?.trim() || !selected) return;
    const next = { ...selected, products: [...selected.products, value.trim()] };
    setStores((prev) => prev.map((store) => store.name === selected.name ? next : store));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">防</div><div><strong>澜盾防水</strong><span>经销商工作台</span></div></div>
        <div className="nav-label">工作台</div>
        {["总览", "门店档案", "订单导入", "拜访记录"].map((item) => <button key={item} onClick={() => setSection(item)} className={`nav-item ${section === item ? "active" : ""}`}><span className="nav-dot">{item === "总览" ? "⌂" : item === "门店档案" ? "▦" : item === "订单导入" ? "↥" : "✓"}</span>{item}{item === "订单导入" && <span className="nav-badge">3</span>}</button>)}
        <div className="sidebar-spacer" />
        <div className="sync-card"><span className="sync-dot" />数据已同步<span className="sync-time">刚刚</span></div>
        <div className="user-card"><div className="avatar">林</div><div><strong>林晓峰</strong><span>销售主管</span></div><span className="more">•••</span></div>
      </aside>

      <section className="content">
        <header className="topbar"><div><p className="eyebrow">周三 · 2026 年 8 月 19 日</p><h1>{section}</h1></div><div className="top-actions"><button className="icon-btn" aria-label="通知">♧<i /></button><button className="help-btn">?</button><button className="primary-btn" onClick={addStore}>＋ 新建门店</button></div></header>
        <div className="content-body">
          <div className="stats-grid"><div className="stat-card"><span>门店总数</span><strong>{stores.length}</strong><small className="up">↗ 12.5% <em>较上月</em></small><div className="spark orange-spark" /></div><div className="stat-card"><span>本月已铺货</span><strong>¥ 286,450</strong><small className="up">↗ 8.2% <em>较上月</em></small><div className="spark blue-spark" /></div><div className="stat-card"><span>待跟进门店</span><strong>6</strong><small className="down">↘ 2 家 <em>较上周</em></small><div className="spark purple-spark" /></div><div className="stat-card accent-stat"><span>本月拜访</span><strong>42 <small>/ 48</small></strong><small className="up">完成率 87.5%</small><div className="progress"><i /></div></div></div>

          {section === "总览" || section === "门店档案" ? <><div className="section-head"><div><h2>门店货品台账</h2><p>从代理商订单中同步，快速掌握每家门店的在售产品</p></div><label className="upload-btn">↥ 导入订单清单<input type="file" accept=".csv,.xlsx,.xls" onChange={importList} /></label></div>
          <div className="ledger-layout"><div className="store-list card"><div className="list-toolbar"><div className="search"><span>⌕</span><input value={query} onChange={(e) => { setQuery(e.target.value); setActiveStore(0); }} placeholder="搜索门店、代理商或产品" /></div><button className="filter-btn">≡ 筛选</button></div><div className="list-meta"><span>全部门店 <b>{filtered.length}</b></span><span className="sort">最近拜访　⌄</span></div><div className="rows">{filtered.map((store, i) => <button key={store.name} onClick={() => setActiveStore(i)} className={`store-row ${selected?.name === store.name ? "selected" : ""}`}><div className="store-icon">{store.name.slice(0, 1)}</div><div className="store-main"><strong>{store.name}</strong><span>{store.city}</span></div><div className="store-products"><div>{store.products.slice(0, 3).map((p) => <em key={p} className={productColors[p] || "gray"}>{p}</em>)}{store.products.length > 3 && <em className="more-pill">+{store.products.length - 3}</em>}</div><small>共 {store.products.length} 个产品</small></div><div className={`status ${store.health === "正常" ? "ok" : "warn"}`}>{store.health}</div><span className="chevron">›</span></button>)}</div></div>
            <div className="detail card"><div className="detail-top"><div><span className="detail-kicker">门店详情 {selected.id && `· ${selected.id}`}</span><h2>{selected.name}</h2><p>{selected.city}　·　{selected.dealer}</p></div><button className="ghost-btn" onClick={() => setEditing({ ...selected })}>编辑资料　✎</button></div><div className="owner"><div className="owner-avatar">{selected.contact.slice(0, 1)}</div><div><span>负责人</span><strong>{selected.contact}</strong></div><div className="visit"><span>最近拜访</span><strong>{selected.lastVisit}</strong></div></div><div className="detail-section"><div className="detail-title"><h3>在售产品 <b>{selected.products.length}</b></h3><button className="text-btn" onClick={addProduct}>＋ 添加产品</button></div><div className="product-grid">{selected.products.map((p, i) => <div className="product-card" key={p}><div className={`product-thumb ${productColors[p] || "gray"}`}><span>{["堵", "K", "JS", "弹", "彩", "瓷"][i % 6]}</span></div><div><strong>{p}</strong><span>已铺货 · {i % 2 === 0 ? "常规装" : "工程装"}</span></div><button onClick={() => setStores((prev) => prev.map((store) => store.name === selected.name ? { ...store, products: store.products.filter((x) => x !== p) } : store))}>×</button></div>)}{selected.products.length === 0 && <div className="empty-products">暂无产品记录<br /><small>可从订单清单导入或手动添加</small></div>}</div></div><div className="detail-footer"><div><span>最后更新</span><strong>今天 09:42 · 林晓峰</strong></div><button className="visit-btn">✓ 记录本次拜访</button></div></div></div></> : <div className="placeholder-page card"><div className="placeholder-icon">{section === "订单导入" ? "↥" : section === "拜访记录" ? "✓" : "▦"}</div><h2>{section}</h2><p>{section === "订单导入" ? "上传代理商出货表，系统会从“出货明细”页自动识别门店与产品。" : section === "拜访记录" ? "这里将集中展示销售人员的门店拜访记录和照片。" : "这里集中管理全部门店档案，点击左侧门店即可编辑资料。"}</p>{section === "订单导入" && <label className="upload-btn">选择出货表<input type="file" accept=".csv,.xlsx,.xls" onChange={importList} /></label>}</div>}
          <div className="bottom-note"><span>⌁</span><div><strong>订单导入小贴士</strong><p>支持 Excel / CSV 格式。系统会自动按“门店名称”归类产品，重复门店将合并更新。</p></div><button className="download-btn">下载模板　↧</button></div>
        </div>
      </section>
      {toast && <div className="toast">✓　{toast}</div>}
      {editing && <div className="modal-backdrop" onClick={() => setEditing(null)}><div className="edit-modal" onClick={(e) => e.stopPropagation()}><div className="modal-head"><div><span className="detail-kicker">编辑门店资料</span><h2>{editing.name}</h2></div><button className="close-btn" onClick={() => setEditing(null)}>×</button></div><label>门店名称<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><div className="form-grid"><label>所在区域<input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></label><label>代理商<input value={editing.dealer} onChange={(e) => setEditing({ ...editing, dealer: e.target.value })} /></label><label>负责人<input value={editing.contact} onChange={(e) => setEditing({ ...editing, contact: e.target.value })} /></label><label>状态<select value={editing.health} onChange={(e) => setEditing({ ...editing, health: e.target.value as Store["health"] })}><option>正常</option><option>待跟进</option></select></label></div><label>在售产品（用逗号分隔）<textarea value={editing.products.join("，")} onChange={(e) => setEditing({ ...editing, products: e.target.value.split(/[，,]/).map((x) => x.trim()).filter(Boolean) })} /></label><div className="modal-actions"><button className="cancel-btn" onClick={() => setEditing(null)}>取消</button><button className="primary-btn" onClick={saveStore}>保存修改</button></div></div></div>}
    </main>
  );
}

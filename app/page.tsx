"use client";

import { ChangeEvent, useMemo, useState } from "react";

type Store = {
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

  const filtered = useMemo(() => stores.filter((s) => `${s.name}${s.city}${s.dealer}${s.products.join("")}`.toLowerCase().includes(query.toLowerCase())), [stores, query]);
  const selected = filtered[activeStore] ?? filtered[0] ?? stores[0];

  function importList(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setToast(`已读取「${file.name}」，新增订单中的门店与货品`);
    setTimeout(() => setToast(""), 2800);
  }

  function addStore() {
    setStores((prev) => [{ name: "新门店（待完善）", city: "待填写地区", dealer: "待关联代理商", contact: "待填写", lastVisit: "尚未拜访", products: [], health: "待跟进" }, ...prev]);
    setActiveStore(0);
    setToast("已新建门店，请在右侧补充资料");
    setTimeout(() => setToast(""), 2800);
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

          <div className="section-head"><div><h2>门店货品台账</h2><p>从代理商订单中同步，快速掌握每家门店的在售产品</p></div><label className="upload-btn">↥ 导入订单清单<input type="file" accept=".csv,.xlsx,.xls" onChange={importList} /></label></div>
          <div className="ledger-layout"><div className="store-list card"><div className="list-toolbar"><div className="search"><span>⌕</span><input value={query} onChange={(e) => { setQuery(e.target.value); setActiveStore(0); }} placeholder="搜索门店、代理商或产品" /></div><button className="filter-btn">≡ 筛选</button></div><div className="list-meta"><span>全部门店 <b>{filtered.length}</b></span><span className="sort">最近拜访　⌄</span></div><div className="rows">{filtered.map((store, i) => <button key={store.name} onClick={() => setActiveStore(i)} className={`store-row ${selected?.name === store.name ? "selected" : ""}`}><div className="store-icon">{store.name.slice(0, 1)}</div><div className="store-main"><strong>{store.name}</strong><span>{store.city}</span></div><div className="store-products"><div>{store.products.slice(0, 3).map((p) => <em key={p} className={productColors[p] || "gray"}>{p}</em>)}{store.products.length > 3 && <em className="more-pill">+{store.products.length - 3}</em>}</div><small>共 {store.products.length} 个产品</small></div><div className={`status ${store.health === "正常" ? "ok" : "warn"}`}>{store.health}</div><span className="chevron">›</span></button>)}</div></div>
            <div className="detail card"><div className="detail-top"><div><span className="detail-kicker">门店详情</span><h2>{selected.name}</h2><p>{selected.city}　·　{selected.dealer}</p></div><button className="ghost-btn">编辑资料　✎</button></div><div className="owner"><div className="owner-avatar">{selected.contact.slice(0, 1)}</div><div><span>负责人</span><strong>{selected.contact}</strong></div><div className="visit"><span>最近拜访</span><strong>{selected.lastVisit}</strong></div></div><div className="detail-section"><div className="detail-title"><h3>在售产品 <b>{selected.products.length}</b></h3><button className="text-btn">＋ 添加产品</button></div><div className="product-grid">{selected.products.map((p, i) => <div className="product-card" key={p}><div className={`product-thumb ${productColors[p] || "gray"}`}><span>{["堵", "K", "JS", "弹", "彩", "瓷"][i % 6]}</span></div><div><strong>{p}</strong><span>已铺货 · {i % 2 === 0 ? "常规装" : "工程装"}</span></div><button>•••</button></div>)}{selected.products.length === 0 && <div className="empty-products">暂无产品记录<br /><small>可从订单清单导入或手动添加</small></div>}</div></div><div className="detail-footer"><div><span>最后更新</span><strong>今天 09:42 · 林晓峰</strong></div><button className="visit-btn">✓ 记录本次拜访</button></div></div></div>
          <div className="bottom-note"><span>⌁</span><div><strong>订单导入小贴士</strong><p>支持 Excel / CSV 格式。系统会自动按“门店名称”归类产品，重复门店将合并更新。</p></div><button className="download-btn">下载模板　↧</button></div>
        </div>
      </section>
      {toast && <div className="toast">✓　{toast}</div>}
    </main>
  );
}

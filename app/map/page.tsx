"use client";

import { useEffect, useState } from "react";
import StoreMap, { MapStore } from "../StoreMap";

const fallback: MapStore[] = [
  {
    id: "MD001",
    name: "东区防水建材门店001",
    region: "东区",
    dealer: "杭州新材贸易",
    level: "S",
    products: ["A产品", "B产品", "E产品", "I产品"],
    visit: "今天 09:42",
    status: "正常",
  },
  {
    id: "MD002",
    name: "南区防水建材门店002",
    region: "南区",
    dealer: "宁波甬城代理",
    level: "S",
    products: ["B产品", "C产品", "E产品", "I产品"],
    visit: "昨天 16:18",
    status: "待跟进",
  },
  {
    id: "MD003",
    name: "西区防水建材门店003",
    region: "西区",
    dealer: "嘉兴恒盛建材",
    level: "A",
    products: ["A产品", "D产品", "F产品"],
    visit: "8 月 16 日",
    status: "正常",
  },
  {
    id: "MD004",
    name: "北区防水建材门店004",
    region: "北区",
    dealer: "绍兴越达贸易",
    level: "A",
    products: ["C产品", "G产品", "J产品", "K产品"],
    visit: "尚未拜访",
    status: "正常",
  },
];

export default function MapPage() {
  const [stores, setStores] = useState<MapStore[]>(fallback),
    [selected, setSelected] = useState(""),
    [editMode, setEditMode] = useState(false),
    [addMode, setAddMode] = useState(false),
    [draft, setDraft] = useState<MapStore | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const raw = localStorage.getItem("landun-stores-v2");
    if (raw) setStores(JSON.parse(raw));
  }, []);
  function persist(next: MapStore[]) {
    setStores(next);
    localStorage.setItem("landun-stores-v2", JSON.stringify(next));
  }
  function choose(id: string) {
    setSelected(id);
    setDraft(stores.find((s) => s.id === id) || null);
  }
  function addAt(point: { lat: number; lng: number }) {
    const id = `MAP${String(Date.now()).slice(-6)}`;
    const store: MapStore = { id, name: "新建门店", region: "中心区", dealer: "待关联代理商", owner: "待填写", level: "A", products: [], visit: "尚未拜访", status: "待跟进", address: "", lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) };
    persist([store, ...stores]);
    setSelected(id);
    setDraft(store);
    setAddMode(false);
    setEditMode(true);
    setNotice("已新增地图点位，请补充门店详情");
  }
  function moveStore(id: string, point: { lat: number; lng: number }) {
    const next = stores.map((s) => s.id === id ? { ...s, lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) } : s);
    persist(next);
    setDraft((d) => d?.id === id ? { ...d, lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) } : d);
  }
  function saveDraft() {
    if (!draft) return;
    const next = stores.map((s) => s.id === draft.id ? { ...draft, lat: Number(draft.lat), lng: Number(draft.lng) } : s);
    persist(next);
    setNotice("门店详情和位置已保存");
  }
  function deleteDraft() {
    if (!draft || !confirm(`确定删除「${draft.name}」吗？`)) return;
    persist(stores.filter((s) => s.id !== draft.id));
    setDraft(null);
    setSelected("");
    setNotice("门店点位已删除");
  }
  const selectedStore = stores.find((s) => s.id === selected);
  return (
    <main className="map-shell">
      <header className="map-topbar">
        <a href="/" className="map-brand">
          <b>澜</b>
          <span>
            <strong>澜盾防水</strong>
            <small>经销商工作台</small>
          </span>
        </a>
        <nav>
          <a href="/">门店档案</a>
          <a className="active" href="/map">
            门店地图
          </a>
        </nav>
        <div>
          <span>2026 年 8 月 19 日　星期三</span>
          <a href="/">返回工作台</a>
        </div>
      </header>
      <div className="map-actionbar"><div><b>点位管理</b><span>{editMode ? "拖动地图标记修改坐标" : "开启编辑后可直接维护位置"}</span></div><button className={editMode ? "active" : ""} onClick={() => { setEditMode((v) => !v); setAddMode(false); }}>{editMode ? "完成编辑" : "编辑点位"}</button><button className={addMode ? "active" : ""} onClick={() => { setAddMode((v) => !v); setEditMode(true); }}>{addMode ? "取消新增" : "＋ 地图上新增"}</button></div>
      <StoreMap stores={stores} onChoose={choose} editMode={editMode} addMode={addMode} onAddAt={addAt} onMove={moveStore} />
      {selectedStore && draft && <section className="map-editor-card"><div className="map-editor-head"><div><small>门店详情 · 位置维护</small><h2>{selectedStore.name}</h2></div><button onClick={deleteDraft}>删除点位</button></div><div className="map-editor-grid"><label>门店名称<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label><label>区域<input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} /></label><label className="wide">门店地址<input value={draft.address || ""} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="填写详细地址，便于导航" /></label><label>纬度（百度坐标）<input type="number" step="0.000001" value={draft.lat ?? ""} onChange={(e) => setDraft({ ...draft, lat: Number(e.target.value) })} /></label><label>经度（百度坐标）<input type="number" step="0.000001" value={draft.lng ?? ""} onChange={(e) => setDraft({ ...draft, lng: Number(e.target.value) })} /></label></div><div className="map-editor-footer"><span>地图上拖动标记后，坐标会自动保存到此处</span><button onClick={saveDraft}>保存门店详情</button></div></section>}
      {(notice || selected) && <div className="map-toast">{notice || `已定位：${selectedStore?.name || "门店"}`}</div>}
    </main>
  );
}

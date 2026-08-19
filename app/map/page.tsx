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
    [selected, setSelected] = useState("");
  useEffect(() => {
    const raw = localStorage.getItem("landun-stores-v2");
    if (raw) setStores(JSON.parse(raw));
  }, []);
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
      <StoreMap stores={stores} onChoose={setSelected} />
      {selected && (
        <div className="map-toast">
          已定位：{stores.find((s) => s.id === selected)?.name}
        </div>
      )}
    </main>
  );
}

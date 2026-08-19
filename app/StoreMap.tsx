"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    BMapGL?: any;
  }
}

export type MapStore = {
  id: string;
  name: string;
  region: string;
  dealer: string;
  level: string;
  products: string[];
  visit: string;
  status: "正常" | "待跟进";
};
export type RouteItem = {
  store: MapStore;
  score: number;
  distance: number;
  reasons: string[];
  point: [number, number];
};

const base: [number, number] = [30.252, 120.165];
const BAIDU_MAP_AK = "l5FhlKxJus8GU5Vjv7zhHfkzOAFIeIqw";
const regionCenters: Record<string, [number, number]> = {
  东区: [30.275, 120.235],
  南区: [30.184, 120.152],
  西区: [30.252, 120.073],
  北区: [30.342, 120.156],
  中心区: [30.248, 120.166],
};
function hash(id: string) {
  return [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
}
export function pointFor(store: MapStore): [number, number] {
  const c = regionCenters[store.region] || base,
    n = hash(store.id);
  return [
    c[0] + ((n % 7) - 3) * 0.004,
    c[1] + ((Math.floor(n / 7) % 7) - 3) * 0.005,
  ];
}
function km(a: [number, number], b: [number, number]) {
  const r = 6371,
    d = (x: number) => (x * Math.PI) / 180,
    lat = d(b[0] - a[0]),
    lon = d(b[1] - a[1]);
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(d(a[0])) * Math.cos(d(b[0])) * Math.sin(lon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function business(store: MapStore) {
  let score = 0;
  const reasons: string[] = [];
  if (store.status === "待跟进") {
    score += 45;
    reasons.push("待跟进");
  }
  if (store.visit.includes("尚未")) {
    score += 35;
    reasons.push("从未拜访");
  } else if (store.visit.includes("8 月")) {
    score += 18;
    reasons.push("超过 3 天未拜访");
  } else if (store.visit.includes("昨天")) {
    score += 12;
    reasons.push("需要跟进");
  }
  if (store.products.length <= 2) {
    score += 15;
    reasons.push("产品覆盖偏少");
  }
  if (store.level === "S") {
    score += 5;
    reasons.push("重点门店");
  }
  return { score, reasons: reasons.slice(0, 2) };
}
export function buildRoute(stores: MapStore[]) {
  let origin = base;
  const pool = [...stores],
    route: RouteItem[] = [];
  while (pool.length && route.length < 10) {
    let best = 0,
      bestScore = -Infinity,
      bestDistance = 0;
    pool.forEach((store, i) => {
      const d = km(origin, pointFor(store)),
        b = business(store),
        score = b.score + Math.max(0, 30 - d * 4);
      if (score > bestScore) {
        best = i;
        bestScore = score;
        bestDistance = d;
      }
    });
    const store = pool.splice(best, 1)[0],
      b = business(store),
      point = pointFor(store);
    route.push({
      store,
      score: Math.round(bestScore),
      distance: bestDistance,
      reasons: b.reasons,
      point,
    });
    origin = point;
  }
  return route;
}

function BaiduLayer({
  stores,
  route,
  onChoose,
  onReady,
}: {
  stores: MapStore[];
  route: RouteItem[];
  onChoose: (id: string) => void;
  onReady: (ready: boolean) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [ak, setAk] = useState(BAIDU_MAP_AK);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    localStorage.setItem("landun-baidu-map-ak", BAIDU_MAP_AK);
    setAk(BAIDU_MAP_AK);
  }, []);
  useEffect(() => {
    if (!ak || !host.current) {
      onReady(false);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    const draw = () => {
      try {
        if (cancelled || !host.current || !window.BMapGL) throw new Error("API unavailable");
        host.current.innerHTML = "";
        const B = window.BMapGL;
        const map = new B.Map(host.current);
        map.centerAndZoom(new B.Point(base[1], base[0]), 12);
        map.enableScrollWheelZoom(true);
        const origin = new B.Point(base[1], base[0]);
        map.addOverlay(new B.Marker(origin));
        const routePoints = [origin];
        stores.forEach((store) => {
          const p = pointFor(store), point = new B.Point(p[1], p[0]);
          const item = route.find((r) => r.store.id === store.id);
          const marker = new B.Marker(point);
          map.addOverlay(marker);
          marker.addEventListener("click", () => onChoose(store.id));
          if (item) routePoints.push(point);
        });
        if (routePoints.length > 1) map.addOverlay(new B.Polyline(routePoints, { strokeColor: "#ee743c", strokeWeight: 3, strokeOpacity: 0.75 }));
        onReady(true);
      } catch {
        setStatus("error");
        onReady(false);
      }
    };
    if (window.BMapGL) draw();
    else {
      document.querySelector('script[data-landun-baidu="true"]')?.remove();
      const script = document.createElement("script");
      script.setAttribute("data-landun-baidu", "true");
      script.setAttribute("src", `https://api.map.baidu.com/getscript?v=4.0&ak=${encodeURIComponent(ak)}&services=&t=${Date.now()}`);
      script.addEventListener("load", draw, { once: true });
      script.addEventListener("error", () => { setStatus("error"); onReady(false); }, { once: true });
      document.body.appendChild(script);
      if (!document.querySelector('link[data-landun-baidu-css="true"]')) {
        const css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://api.map.baidu.com/res/webgl/40/bmap.css";
        css.setAttribute("data-landun-baidu-css", "true");
        document.head.appendChild(css);
      }
    }
    return () => {
      cancelled = true;
      onReady(false);
    };
  }, [ak, onChoose, onReady, route, stores]);

  function saveAk() {
    const value = draft.trim();
    if (!value) return;
    localStorage.setItem("landun-baidu-map-ak", value);
    setAk(value);
  }
  return (
    <>
      <div ref={host} className={`baidu-layer ${ak ? "visible" : ""}`} />
      {!ak && (
        <div className="baidu-ak-panel">
          <b>启用百度地图</b>
          <p>在百度地图开放平台创建浏览器端 AK 后粘贴到这里，地图会自动切换为百度底图。</p>
          <div><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="粘贴百度地图 AK" /><button onClick={saveAk}>启用</button></div>
          <a href="https://lbsyun.baidu.com/" target="_blank" rel="noreferrer">前往百度地图开放平台申请 AK ↗</a>
        </div>
      )}
      {ak && status !== "loading" && status !== "idle" && (
        <div className="baidu-error">百度地图没有加载成功。请确认 AK 类型为“浏览器端”，并已将 <b>landun-dealer-workbench.july-0.chatgpt.site</b> 加入 Referer 白名单；修改后刷新本页再试。</div>
      )}
    </>
  );
}

export default function StoreMap({
  stores,
  onChoose,
}: {
  stores: MapStore[];
  onChoose: (id: string) => void;
}) {
  const route = useMemo(() => buildRoute(stores), [stores]);
  const ids = new Set(route.map((r) => r.store.id));
  const [baiduReady, setBaiduReady] = useState(false);
  return (
    <section className="map-page">
      <div className="map-summary">
        <div>
          <small>智能路线规划</small>
          <h1>本轮推荐拜访</h1>
          <p>从销售驻点出发，优先安排高价值且距离更近的门店。</p>
        </div>
        <div className="route-stats">
          <span>
            <b>{route.length}</b> 家门店
          </span>
          <span>
            <b>{route.reduce((n, r) => n + r.distance, 0).toFixed(1)}</b> km
            预计路线
          </span>
        </div>
      </div>
      <div className="map-layout">
        <aside className="route-list">
          <div className="route-label">
            <b>推荐顺序</b>
            <span>每轮最多 10 家</span>
          </div>
          <div className="route-origin">
            <i>●</i>
            <span>
              销售驻点
              <br />
              <small>杭州市中心</small>
            </span>
          </div>
          {route.map((r, i) => (
            <button key={r.store.id} onClick={() => onChoose(r.store.id)}>
              <b className="route-number">{String(i + 1).padStart(2, "0")}</b>
              <span className="route-info">
                <strong>{r.store.name}</strong>
                <small>
                  {r.store.region} · 距上一站 {r.distance.toFixed(1)} km
                </small>
                <em>{r.reasons.join(" · ") || "常规拜访"}</em>
              </span>
              <b className="route-score">{r.score}</b>
            </button>
          ))}
        </aside>
        <div className={`map-wrap ${baiduReady ? "baidu-active" : ""}`}>
          <BaiduLayer stores={stores} route={route} onChoose={onChoose} onReady={setBaiduReady} />
          <div className="store-map">
            <div className="map-grid-lines" />
            <div className="map-title">杭州 · 经销商门店分布</div>
            <button className="map-pin origin-pin" style={{ left: "50%", top: "50%" }} onClick={() => undefined} aria-label="销售驻点">
              <i />
              <span>销售驻点</span>
            </button>
            {stores.map((store) => {
              const p = pointFor(store),
                item = route.find((r) => r.store.id === store.id),
                rank = route.findIndex((r) => r.store.id === store.id);
              const left = `${Math.max(8, Math.min(92, 50 + (p[1] - base[1]) * 260))}%`;
              const top = `${Math.max(10, Math.min(90, 50 - (p[0] - base[0]) * 260))}%`;
              return (
                <button
                  key={store.id}
                  className={`map-pin ${item ? "route-pin" : "store-pin"}`}
                  style={{ left, top }}
                  onClick={() => onChoose(store.id)}
                  aria-label={`选择 ${store.name}`}
                >
                  <i>{item ? String(rank + 1).padStart(2, "0") : ""}</i>
                  <span>{store.name}</span>
                </button>
              );
            })}
            <div className="map-compass">N</div>
            <small className="map-note">点位按门店区域近似展示</small>
          </div>
          <div className="map-legend">
            <span>
              <i className="origin-dot" />
              销售驻点
            </span>
            <span>
              <i className="route-dot" />
              推荐拜访
            </span>
            <span>
              <i className="store-dot" />
              其他门店
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

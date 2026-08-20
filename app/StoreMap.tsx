"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, LocateFixed, MapPinned, Save, Search, Trash2 } from "lucide-react";

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
  owner?: string;
  level: string;
  products: string[];
  visit: string;
  status: "正常" | "待跟进";
  address?: string;
  lat?: number;
  lng?: number;
};

export type RouteItem = {
  store: MapStore;
  score: number;
  distance: number;
  reasons: string[];
  point: [number, number];
};

export const base: [number, number] = [30.252, 120.165];
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

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character] || character));
}

export function pointFor(store: MapStore): [number, number] {
  const lat = Number(store.lat);
  const lng = Number(store.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  const c = regionCenters[store.region] || base;
  const n = hash(store.id);
  return [c[0] + ((n % 7) - 3) * 0.004, c[1] + ((Math.floor(n / 7) % 7) - 3) * 0.005];
}

function km(a: [number, number], b: [number, number]) {
  const r = 6371;
  const d = (x: number) => (x * Math.PI) / 180;
  const lat = d(b[0] - a[0]);
  const lon = d(b[1] - a[1]);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(d(a[0])) * Math.cos(d(b[0])) * Math.sin(lon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function business(store: MapStore) {
  let score = 0;
  const reasons: string[] = [];
  if (store.status === "待跟进") { score += 45; reasons.push("待跟进"); }
  if (store.visit.includes("尚未")) { score += 35; reasons.push("从未拜访"); }
  else if (store.visit.includes("8 月")) { score += 18; reasons.push("超过 3 天未拜访"); }
  else if (store.visit.includes("昨天")) { score += 12; reasons.push("需要跟进"); }
  if (store.products.length <= 2) { score += 15; reasons.push("产品覆盖偏少"); }
  if (store.level === "S") { score += 5; reasons.push("重点门店"); }
  return { score, reasons: reasons.slice(0, 2) };
}

export function buildRoute(stores: MapStore[]) {
  let origin = base;
  const pool = [...stores];
  const route: RouteItem[] = [];
  while (pool.length && route.length < 10) {
    let best = 0, bestScore = -Infinity, bestDistance = 0;
    pool.forEach((store, i) => {
      const distance = km(origin, pointFor(store));
      const score = business(store).score + Math.max(0, 30 - distance * 4);
      if (score > bestScore) { best = i; bestScore = score; bestDistance = distance; }
    });
    const store = pool.splice(best, 1)[0];
    const point = pointFor(store);
    route.push({ store, score: Math.round(bestScore), distance: bestDistance, reasons: business(store).reasons, point });
    origin = point;
  }
  return route;
}

function BaiduLayer({
  stores, route, routeVisible, selectedId, onChoose, onReady, editMode, addMode, trafficEnabled, focusTarget, focusNonce, geocodeRequest, onAddAt, onMove, onLocationStatus,
}: {
  stores: MapStore[];
  route: RouteItem[];
  routeVisible: boolean;
  selectedId: string;
  onChoose: (id: string) => void;
  onReady: (ready: boolean) => void;
  editMode: boolean;
  addMode: boolean;
  trafficEnabled: boolean;
  focusTarget: string;
  focusNonce: number;
  geocodeRequest: { id: string; kind: "address" | "coordinates"; address?: string; lat?: number; lng?: number; nonce: number } | null;
  onAddAt: (point: { lat: number; lng: number; address?: string }) => void;
  onMove: (id: string, point: { lat: number; lng: number; address?: string }) => void;
  onLocationStatus: (message: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const chooseRef = useRef(onChoose), addRef = useRef(onAddAt), moveRef = useRef(onMove), statusRef = useRef(onLocationStatus), addModeRef = useRef(addMode);
  const [ak, setAk] = useState(BAIDU_MAP_AK);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  useEffect(() => { chooseRef.current = onChoose; addRef.current = onAddAt; moveRef.current = onMove; statusRef.current = onLocationStatus; addModeRef.current = addMode; }, [onChoose, onAddAt, onMove, onLocationStatus, addMode]);
  useEffect(() => { localStorage.setItem("landun-baidu-map-ak", BAIDU_MAP_AK); setAk(BAIDU_MAP_AK); }, []);

  useEffect(() => {
    if (!ak || !host.current) { onReady(false); return; }
    let cancelled = false;
    setStatus("loading");
    const draw = () => {
      try {
        if (cancelled || !host.current || !window.BMapGL) throw new Error("API unavailable");
        host.current.innerHTML = "";
        const B = window.BMapGL;
        const map = new B.Map(host.current);
        mapRef.current = map;
        map.centerAndZoom(new B.Point(base[1], base[0]), 12);
        map.enableScrollWheelZoom(true);
        if (B.ZoomControl) map.addControl(new B.ZoomControl());
        if (B.ScaleControl) map.addControl(new B.ScaleControl());
        if (trafficEnabled) map.setTrafficOn?.();
        else map.setTrafficOff?.();
        const resolveAddress = (point: any, done: (address: string) => void) => {
          if (!B.Geocoder) { done(""); return; }
          const geocoder = new B.Geocoder();
          geocoder.getLocation(point, (result: any) => done(result?.address || result?.formatted_address || ""));
        };
        map.addEventListener("click", (event: any) => {
          if (!addModeRef.current || !event.latlng) return;
          const point = event.latlng;
          resolveAddress(point, (address) => {
            addRef.current({ lat: point.lat, lng: point.lng, address });
            statusRef.current(address ? "已新增点位，并识别出门店地址" : "已新增点位，请补充门店地址");
          });
        });
        const origin = new B.Point(base[1], base[0]);
        const originMarker = new B.Marker(origin);
        originMarker.setTitle?.("销售驻点");
        map.addOverlay(originMarker);
        const markerPoints = new Map<string, any>();
        stores.forEach((store) => {
          const p = pointFor(store);
          const isSelected = store.id === selectedId;
          const fill = isSelected ? "#7c3aed" : "#e8753d";
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="44" viewBox="0 0 34 44"><path fill="${fill}" d="M17 1C8.7 1 2 7.6 2 15.8c0 11.1 15 26.6 15 26.6s15-15.5 15-26.6C32 7.6 25.3 1 17 1z"/><circle cx="17" cy="16" r="6" fill="white"/></svg>`;
          const icon = B.Icon && B.Size ? new B.Icon(`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, new B.Size(34, 44), { anchor: new B.Size(17, 43) }) : undefined;
          const marker = new B.Marker(new B.Point(p[1], p[0]), icon ? { icon } : undefined);
          marker.setTitle?.(store.name);
          if (isSelected && marker.setAnimation) {
            const bounce = (window as any).BMAP_ANIMATION_BOUNCE;
            if (bounce !== undefined) {
              marker.setAnimation(bounce);
              window.setTimeout(() => marker.setAnimation(null), 850);
            }
          }
          if (editMode && marker.enableDragging) {
            marker.enableDragging();
            marker.addEventListener("dragend", (event: any) => {
              const point = event.point || event.latlng || marker.getPosition();
              if (!point) return;
              resolveAddress(point, (address) => {
                moveRef.current(store.id, { lat: point.lat, lng: point.lng, address });
                statusRef.current(address ? `已更新「${store.name}」的位置和地址` : `已更新「${store.name}」的位置`);
              });
            });
          }
          marker.addEventListener("click", () => chooseRef.current(store.id));
          map.addOverlay(marker);
          markerPoints.set(store.id, marker.getPosition());
          if (isSelected && B.Label && B.Size) {
            const planned = route.find((item) => item.store.id === store.id);
            const score = planned?.score ?? Math.round(business(store).score + Math.max(0, 30 - km(base, p) * 4));
            const label = new B.Label(`<div style="display:grid;gap:3px;min-width:122px;padding:8px 10px;border-radius:8px;background:#6d35d9;color:#fff;box-shadow:0 8px 20px rgba(91,43,184,.3)"><b style="overflow:hidden;text-overflow:ellipsis;font-size:12px">${escapeHtml(store.name)}</b><span style="font-size:10px;opacity:.9">评分 ${score}</span></div>`, { position: marker.getPosition(), offset: new B.Size(20, -50) });
            label.setStyle?.({ border: "0", borderRadius: "8px", padding: "0", background: "transparent", color: "#ffffff", fontSize: "12px", lineHeight: "1.25", boxShadow: "none", whiteSpace: "nowrap" });
            label.addEventListener?.("click", () => chooseRef.current(store.id));
            map.addOverlay(label);
          }
        });
        const routePoints: any[] = [origin, ...route.map((item) => markerPoints.get(item.store.id)).filter(Boolean)];
        const lineOptions = { renderOptions: { map, autoViewport: false }, strokeColor: "#ee743c", strokeWeight: 5, strokeOpacity: 0.85 };
        if (routeVisible && routePoints.length > 1) {
          const end = routePoints[routePoints.length - 1];
          const waypoints = routePoints.slice(1, -1);
          if (B.DrivingRouteLine) {
            const driving = new B.DrivingRouteLine(map, lineOptions);
            driving.search(origin, end, { waypoints });
          } else if (B.DrivingRoute) {
            const driving = new B.DrivingRoute(map, lineOptions);
            driving.search(origin, end, { waypoints });
          } else {
            map.addOverlay(new B.Polyline(routePoints, lineOptions));
          }
        }
        setStatus("ready");
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
      script.src = `https://api.map.baidu.com/getscript?v=4.0&ak=${encodeURIComponent(ak)}&services=&t=${Date.now()}`;
      script.addEventListener("load", draw, { once: true });
      script.addEventListener("error", () => { if (!window.BMapGL) { setStatus("error"); onReady(false); } }, { once: true });
      document.body.appendChild(script);
      if (!document.querySelector('link[data-landun-baidu-css="true"]')) {
        const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://api.map.baidu.com/res/webgl/40/bmap.css"; css.setAttribute("data-landun-baidu-css", "true"); document.head.appendChild(css);
      }
    }
    return () => { cancelled = true; onReady(false); };
  }, [ak, editMode, route, routeVisible, stores, selectedId, onReady, trafficEnabled]);

  useEffect(() => {
    const map = mapRef.current;
    const B = window.BMapGL;
    if (!map || !B || !focusNonce || !focusTarget) return;
    const point = focusTarget === "origin" ? base : (() => {
      const store = stores.find((item) => item.id === focusTarget);
      return store ? pointFor(store) : null;
    })();
    if (!point) return;
    map.centerAndZoom(new B.Point(point[1], point[0]), focusTarget === "origin" ? 12 : 16);
  }, [focusTarget, focusNonce, stores]);

  useEffect(() => {
    const map = mapRef.current;
    const B = window.BMapGL;
    if (!map || !B || !geocodeRequest || !B.Geocoder) return;
    const geocoder = new B.Geocoder();
    if (geocodeRequest.kind === "address") {
      const address = geocodeRequest.address?.trim();
      if (!address) return;
      geocoder.getPoint(address, (point: any) => {
        if (!point) { statusRef.current("未找到该地址，请补充省、市、区后重试"); return; }
        map.centerAndZoom(point, 16);
        moveRef.current(geocodeRequest.id, { lat: point.lat, lng: point.lng, address });
        chooseRef.current(geocodeRequest.id);
        statusRef.current("已按地址更新地图点位");
      });
      return;
    }
    const lat = Number(geocodeRequest.lat), lng = Number(geocodeRequest.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const point = new B.Point(lng, lat);
    geocoder.getLocation(point, (result: any) => {
      const address = result?.address || result?.formatted_address || "";
      map.centerAndZoom(point, 16);
      moveRef.current(geocodeRequest.id, { lat, lng, address });
      statusRef.current(address ? "已按坐标更新门店地址" : "已更新坐标，未识别到详细地址");
    });
  }, [geocodeRequest]);

  function saveAk() {
    const value = draft.trim();
    if (!value) return;
    localStorage.setItem("landun-baidu-map-ak", value);
    setAk(value);
  }
  return (
    <>
      <div ref={host} className={`baidu-layer ${ak ? "visible" : ""}`} />
      {!ak && <div className="baidu-ak-panel"><b>启用百度地图</b><p>粘贴浏览器端 AK 后启用百度底图。</p><div><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="粘贴百度地图 AK" /><button onClick={saveAk}>启用</button></div></div>}
      {ak && status === "error" && <div className="baidu-error">百度地图没有加载成功，请检查浏览器端 AK 的 Referer 白名单。</div>}
    </>
  );
}

export default function StoreMap({ stores, onChoose, selectedId = "", onUpdateStore, onDeleteStore, editMode = false, addMode = false, trafficEnabled = false, focusTarget = "", focusNonce = 0, onAddAt = () => undefined, onMove = () => undefined, onLocationStatus = () => undefined }: {
  stores: MapStore[];
  onChoose: (id: string) => void;
  selectedId?: string;
  onUpdateStore?: (store: MapStore) => void;
  onDeleteStore?: (id: string) => void;
  editMode?: boolean;
  addMode?: boolean;
  trafficEnabled?: boolean;
  focusTarget?: string;
  focusNonce?: number;
  onAddAt?: (point: { lat: number; lng: number; address?: string }) => void;
  onMove?: (id: string, point: { lat: number; lng: number; address?: string }) => void;
  onLocationStatus?: (message: string) => void;
}) {
  const route = useMemo(() => buildRoute(stores), [stores]);
  const [baiduReady, setBaiduReady] = useState(false);
  const [expandedId, setExpandedId] = useState("");
  const [detailDraft, setDetailDraft] = useState<MapStore | null>(null);
  const [routeVisible, setRouteVisible] = useState(false);
  const [geocodeRequest, setGeocodeRequest] = useState<{ id: string; kind: "address" | "coordinates"; address?: string; lat?: number; lng?: number; nonce: number } | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const store = stores.find((item) => item.id === selectedId);
    if (store) {
      setExpandedId(store.id);
      setDetailDraft(store);
    }
  }, [selectedId, stores]);

  function toggleDetail(store: MapStore) {
    onChoose(store.id);
    if (expandedId === store.id) {
      setExpandedId("");
      return;
    }
    setExpandedId(store.id);
    setDetailDraft(store);
  }

  function saveDetail(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    if (detailDraft) onUpdateStore?.(detailDraft);
  }

  function removeStore(event: React.MouseEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation();
    if (confirm("确定删除这个门店及其地图点位吗？")) onDeleteStore?.(id);
  }

  function locateByAddress(event: React.MouseEvent<HTMLButtonElement>, store: MapStore) {
    event.stopPropagation();
    const address = store.address?.trim();
    if (!address) { onLocationStatus("请先填写门店的详细地址"); return; }
    setGeocodeRequest({ id: store.id, kind: "address", address, nonce: Date.now() });
  }

  function updateAddressByCoordinates(event: React.MouseEvent<HTMLButtonElement>, store: MapStore) {
    event.stopPropagation();
    const lat = Number(store.lat), lng = Number(store.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { onLocationStatus("请先填写有效的经纬度"); return; }
    setGeocodeRequest({ id: store.id, kind: "coordinates", lat, lng, nonce: Date.now() });
  }

  return (
    <section className="map-page">
      <div className="map-layout">
        <aside className="route-list">
          <div className="route-panel-heading"><div><small>门店档案</small><h1>全部门店</h1><p>点击门店后，地图会自动跳转到对应点位</p></div><div className="route-panel-stats"><b>{stores.length}</b><span>家门店</span><strong>{stores.filter((store) => Number.isFinite(Number(store.lat)) && Number.isFinite(Number(store.lng))).length}</strong><span>已定位</span></div></div>
          <div className="route-label"><b>门店列表</b><span>点开箭头查看和编辑详情</span></div>
          <div className="route-cards">
            {stores.map((store, i) => {
              const open = expandedId === store.id;
              const draft = open && detailDraft?.id === store.id ? detailDraft : store;
              return <article className={`route-card ${open ? "open" : ""} ${selectedId === store.id ? "selected" : ""}`} key={store.id}>
                <div className="route-row">
                  <button className="route-select" onClick={() => { onChoose(store.id); if (!open) toggleDetail(store); }} aria-label={`定位 ${store.name}`}>
                    <b className="route-number">{String(i + 1).padStart(2, "0")}</b>
                    <span className="route-info"><strong>{store.name}</strong><small>{store.region} · {store.dealer}</small><em>{store.address || "暂未填写详细地址"}</em></span>
                    <b className="route-score">{store.level}</b>
                  </button>
                  <button className="route-expand" onClick={() => toggleDetail(store)} aria-label={open ? "收起门店详情" : "展开门店详情"} aria-expanded={open}>{open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>
                </div>
                {open && <div className="route-detail">
                  <div className="route-detail-head"><div><small>门店详情</small><b>{draft.name}</b></div><button onClick={(event) => removeStore(event, store.id)} title="删除门店"><Trash2 size={14} />删除</button></div>
                  <div className="route-detail-grid">
                    <label>门店名称<input value={draft.name} onChange={(event) => setDetailDraft({ ...draft, name: event.target.value })} /></label>
                    <label>区域<input value={draft.region} onChange={(event) => setDetailDraft({ ...draft, region: event.target.value })} /></label>
                    <label className="detail-wide">详细地址<input value={draft.address || ""} placeholder="填写门店地址" onChange={(event) => setDetailDraft({ ...draft, address: event.target.value })} /></label>
                    <label>纬度<input type="number" step="0.000001" value={draft.lat ?? ""} onChange={(event) => setDetailDraft({ ...draft, lat: Number(event.target.value) })} /></label>
                    <label>经度<input type="number" step="0.000001" value={draft.lng ?? ""} onChange={(event) => setDetailDraft({ ...draft, lng: Number(event.target.value) })} /></label>
                  </div>
                  <div className="route-detail-actions">
                    <button type="button" onClick={(event) => locateByAddress(event, draft)}><Search size={13} />按地址定位</button>
                    <button type="button" onClick={(event) => updateAddressByCoordinates(event, draft)}><MapPinned size={13} />按坐标更新地址</button>
                    <button type="button" onClick={(event) => { event.stopPropagation(); onChoose(draft.id); }}><LocateFixed size={13} />查看点位</button>
                  </div>
                  <div className="route-detail-meta"><span>经销商：{draft.dealer}</span><span>最近拜访：{draft.visit}</span></div>
                  <div className="detail-products">{draft.products.length ? draft.products.map((product) => <span key={product}>{product}</span>) : <small>暂无产品记录</small>}</div>
                  <button className="route-save" onClick={saveDetail}><Save size={14} />保存门店详情</button>
                </div>}
              </article>;
            })}
          </div>
        </aside>
        <div className={`map-wrap ${baiduReady ? "baidu-active" : ""}`}>
          <BaiduLayer stores={stores} route={route} routeVisible={routeVisible} selectedId={selectedId} onChoose={onChoose} onReady={setBaiduReady} editMode={editMode} addMode={addMode} trafficEnabled={trafficEnabled} focusTarget={focusTarget} focusNonce={focusNonce} geocodeRequest={geocodeRequest} onAddAt={onAddAt} onMove={onMove} onLocationStatus={onLocationStatus} />
          <aside className="visit-plan-panel" aria-label="推荐拜访规划">
            <small>推荐拜访规划</small>
            <b>本轮建议走访 {route.length} 家</b>
            <p>综合门店优先级、拜访状态与相邻距离自动排序。</p>
            <div><span>预计行程</span><strong>{route.reduce((total, item) => total + item.distance, 0).toFixed(1)} km</strong></div>
            <button className={routeVisible ? "active" : ""} onClick={() => setRouteVisible((visible) => !visible)} aria-pressed={routeVisible}>{routeVisible ? "隐藏地图路线" : "在地图上显示路线"}</button>
          </aside>
          <div className="map-tools"><span className={addMode ? "active" : ""}>{addMode ? "请在地图上点击新增位置，地址会自动识别" : editMode ? "拖动门店标记即可同步更新位置与地址" : routeVisible ? "已显示推荐拜访路线" : "路线已隐藏，可在右上角规划窗口开启"}</span></div>
          <div className="store-map"><div className="map-grid-lines" /><div className="map-title">杭州 · 经销商门店分布</div><button className="map-pin origin-pin" style={{ left: "50%", top: "50%" }} aria-label="销售驻点"><i /><span>销售驻点</span></button>{stores.map((store) => { const p = pointFor(store); const item = route.find((r) => r.store.id === store.id); const rank = route.findIndex((r) => r.store.id === store.id); const left = `${Math.max(8, Math.min(92, 50 + (p[1] - base[1]) * 260))}%`; const top = `${Math.max(10, Math.min(90, 50 - (p[0] - base[0]) * 260))}%`; return <button key={store.id} className={`map-pin ${item ? "route-pin" : "store-pin"} ${selectedId === store.id ? "selected" : ""}`} style={{ left, top }} onClick={() => onChoose(store.id)} aria-label={`选择 ${store.name}`}><i>{item ? String(rank + 1).padStart(2, "0") : ""}</i><span>{store.name}</span></button>; })}<div className="map-compass">N</div><small className="map-note">未填写坐标的门店按区域近似展示</small></div>
          <div className="map-legend"><span><i className="origin-dot" />销售驻点</span><span><i className="route-dot" />推荐拜访 · 百度驾车路线</span><span><i className="store-dot" />其他门店</span></div>
        </div>
      </div>
    </section>
  );
}

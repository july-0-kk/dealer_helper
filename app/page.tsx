"use client";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { buildRoute } from "./StoreMap";
import { createRealStores } from "./realStores";

type Store = {
  id: string;
  name: string;
  region: string;
  dealer: string;
  owner: string;
  level: string;
  products: string[];
  visit: string;
  status: "正常" | "待跟进";
  address?: string;
  lat?: number;
  lng?: number;
};
type Visit = {
  id: string;
  storeName: string;
  date: string;
  result: string;
  note: string;
};
const seed: Store[] = [
  {
    id: "MD001",
    name: "东区防水建材门店001",
    region: "东区",
    dealer: "杭州新材贸易",
    owner: "王晨",
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
    owner: "李杰",
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
    owner: "赵一鸣",
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
    owner: "陈浩",
    level: "A",
    products: ["C产品", "G产品", "J产品", "K产品"],
    visit: "尚未拜访",
    status: "正常",
  },
];

export default function Home() {
  const [stores, setStores] = useState<Store[]>(createRealStores()),
    [visits, setVisits] = useState<Visit[]>([]),
    [activeId, setActiveId] = useState(""),
    [view, setView] = useState<"stores" | "visits">("stores"),
    [q, setQ] = useState(""),
    [editing, setEditing] = useState<Store | null>(null),
    [toast, setToast] = useState("");
  useEffect(() => {
    const s = localStorage.getItem("landun-stores-v3"),
      v = localStorage.getItem("landun-visits-v3");
    if (s) setStores(JSON.parse(s));
    if (v) setVisits(JSON.parse(v));
  }, []);
  useEffect(() => {
    localStorage.setItem("landun-stores-v3", JSON.stringify(stores));
  }, [stores]);
  useEffect(() => {
    localStorage.setItem("landun-visits-v3", JSON.stringify(visits));
  }, [visits]);
  const filtered = useMemo(
    () =>
      stores.filter((s) =>
        `${s.id}${s.name}${s.region}${s.dealer}${s.products.join("")}`
          .toLowerCase()
          .includes(q.toLowerCase()),
      ),
    [stores, q],
  );
  const active =
    stores.find((s) => s.id === activeId) || filtered[0] || stores[0];
  const recs = useMemo(() => buildRoute(stores), [stores]);
  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };
  function importFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" }),
          sheet = wb.SheetNames.includes("出货明细")
            ? "出货明细"
            : wb.SheetNames[0],
          rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
            wb.Sheets[sheet],
            { defval: "" },
          ),
          map = new Map<string, Store>();
        rows.forEach((r) => {
          const id = String(r["门店编号"] || r["门店名称"] || "");
          const s = map.get(id) || {
            id,
            name: String(r["门店名称"] || "未命名门店"),
            region: String(r["区域"] || "待补充"),
            dealer: String(r["代理商"] || "未关联代理商"),
            owner: String(r["业务员"] || "待补充"),
            level: String(r["门店等级"] || "-"),
            products: [],
            visit: "尚未拜访",
            status: "正常",
            address: String(r["地址"] || r["门店地址"] || ""),
            lat: Number(r["纬度"] || r["Latitude"] || 0) || undefined,
            lng: Number(r["经度"] || r["Longitude"] || 0) || undefined,
          };
          const p = String(r["产品名称"] || r["产品代码"] || "");
          if (p && !s.products.includes(p)) s.products.push(p);
          map.set(id, s);
        });
        const next = [...map.values()];
        if (!next.length) throw 0;
        setStores(next);
        setActiveId(next[0].id);
        setView("stores");
        say(`已导入 ${next.length} 家门店`);
      } catch {
        say("导入失败，请确认含有“出货明细”页");
      }
    };
    reader.readAsArrayBuffer(f);
    e.target.value = "";
  }
  function record(s: Store) {
    const result = prompt("本次拜访结果", "已完成拜访");
    if (result === null) return;
    const note = prompt("备注（可选）", "") || "",
      date =
        "今天 " +
        new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        });
    setVisits((v) => [
      { id: String(Date.now()), storeName: s.name, date, result, note },
      ...v,
    ]);
    setStores((v) =>
      v.map((x) =>
        x.id === s.id
          ? {
              ...x,
              visit: date,
              status:
                result.includes("待") || result.includes("报价")
                  ? "待跟进"
                  : "正常",
            }
          : x,
      ),
    );
    say("拜访记录已保存");
  }
  function save() {
    if (!editing) return;
    setStores((v) => v.map((s) => (s.id === editing.id ? editing : s)));
    setEditing(null);
    say("门店资料已保存");
  }
  return (
    <main className="shell-v3">
      <header className="top-v3">
        <div className="brand-v3">
          <span>澜</span>
          <div>
            <b>澜盾防水</b>
            <small>经销商工作台</small>
          </div>
        </div>
        <nav>
          <button
            className={view === "stores" ? "active" : ""}
            onClick={() => setView("stores")}
          >
            门店档案
          </button>
          <button
            className={view === "visits" ? "active" : ""}
            onClick={() => setView("visits")}
          >
            今日推荐拜访 <em>{recs.filter((x) => x.score >= 35).length}</em>
          </button>
          <a href="/map">门店地图</a>
        </nav>
        <div className="top-actions">
          <label className="import-v3">
            ↥ 导入出货表
            <input type="file" accept=".xlsx,.xls,.csv" onChange={importFile} />
          </label>
          <span className="date-v3">2026 年 8 月 19 日　星期三</span>
          <span className="user-v3">林晓峰⌄</span>
        </div>
      </header>
      {view === "visits" ? (
        <section className="visit-v3">
          <div className="visit-intro">
            <div>
              <small>今日工作建议</small>
              <h1>今日推荐拜访</h1>
              <p>优先处理待跟进、从未拜访和产品覆盖偏少的门店。</p>
            </div>
            <strong>
              {Math.min(10, recs.length)}
              <small> 家建议</small>
            </strong>
          </div>
          <div className="visit-columns">
            <div>
              {recs.slice(0, 10).map((x, i) => (
                <div className="rec-v3" key={x.store.id}>
                  <b className="rec-rank">{String(i + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>{x.store.name}</strong>
                    <small>
                      {x.store.id} · {x.store.region} · {x.store.dealer}
                    </small>
                    <div>
                      {x.reasons.map((r) => (
                        <em key={r}>{r}</em>
                      ))}
                    </div>
                  </div>
                  <b className="rec-score">
                    {x.score}
                    <small>优先分</small>
                  </b>
                  <button onClick={() => record(x.store)}>记录拜访</button>
                </div>
              ))}
            </div>
            <div className="history-v3">
              <h3>
                最近拜访记录 <small>{visits.length} 条</small>
              </h3>
              {visits.slice(0, 7).map((v) => (
                <div key={v.id}>
                  <b>✓</b>
                  <span>
                    <strong>{v.storeName}</strong>
                    <small>
                      {v.date} · {v.result}
                    </small>
                  </span>
                </div>
              ))}
              {!visits.length && <p>完成一次拜访后，记录会显示在这里。</p>}
            </div>
          </div>
        </section>
      ) : (
        <section className="workspace-v3">
          <aside className="directory-v3">
            <div className="directory-head">
              <div>
                <small>门店档案</small>
                <h1>门店目录</h1>
              </div>
              <b>{stores.length} 家</b>
            </div>
            <div className="search-v3">
              ⌕
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索门店名称 / 编号 / 代理商"
              />
            </div>
            <div className="directory-list">
              {filtered.map((s) => (
                <button
                  className={active?.id === s.id ? "selected" : ""}
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                >
                  <span className="row-num">{s.id.replace("MD", "")}</span>
                  <div>
                    <strong>{s.name}</strong>
                    <small>
                      {s.region} · {s.owner}
                    </small>
                  </div>
                  <span className="coverage">
                    产品覆盖 <b>{s.products.length}</b>
                  </span>
                  <i>›</i>
                </button>
              ))}
            </div>
            <button
              className="new-store-v3"
              onClick={() => {
                const s = {
                  id: `NEW${stores.length + 1}`,
                  name: "新建门店",
                  region: "待补充",
                  dealer: "待关联代理商",
                  owner: "待填写",
                  level: "A",
                  products: [],
                  visit: "尚未拜访",
                  status: "待跟进" as const,
                };
                setStores([s, ...stores]);
                setActiveId(s.id);
                setEditing(s);
              }}
            >
              ＋ 新建门店
            </button>
          </aside>
          {active && (
            <article className="profile-v3">
              <div className="profile-head">
                <div>
                  <small>门店详情</small>
                  <h1>
                    {active.name} <em>{active.level} 类客户</em>
                  </h1>
                  <p>
                    {active.id}　·　{active.region}　·　{active.dealer}
                  </p>
                </div>
                <button onClick={() => setEditing({ ...active })}>
                  编辑资料
                </button>
              </div>
              <div className="profile-grid">
                <label>
                  门店名称<strong>{active.name}</strong>
                </label>
                <label>
                  客户编码<strong>{active.id}</strong>
                </label>
                <label>
                  负责人<strong>{active.owner}</strong>
                </label>
                <label>
                  最近拜访<strong>{active.visit}</strong>
                </label>
                <label className="location-v3">
                  门店位置<strong>{active.address || "尚未填写地址"}</strong><small>{active.lat && active.lng ? `${active.lat.toFixed(6)}, ${active.lng.toFixed(6)}` : "可在门店地图中拖动标记定位"}</small></label>
              </div>
              <div className="section-v3">
                <div>
                  <h2>
                    产品覆盖 <b>{active.products.length}</b>
                  </h2>
                  <button
                    onClick={() => {
                      const p = prompt("新增产品名称");
                      if (p)
                        setStores((v) =>
                          v.map((s) =>
                            s.id === active.id
                              ? { ...s, products: [...s.products, p] }
                              : s,
                          ),
                        );
                    }}
                  >
                    全部展开＋
                  </button>
                </div>
                <div className="product-grid-v3">
                  {active.products.map((p, i) => (
                    <div key={p}>
                      <input type="checkbox" checked readOnly />
                      <span className={`product-dot d${i % 5}`}>{p[0]}</span>
                      <strong>{p}</strong>
                      <small>已铺货 · 来自出货明细</small>
                    </div>
                  ))}
                  {!active.products.length && (
                    <p>暂无产品记录，可从出货表导入。</p>
                  )}
                </div>
              </div>
              <div className="section-v3 next-plan">
                <h2>下次拜访计划</h2>
                <div>
                  <label>
                    预计拜访日期
                    <input type="date" />
                  </label>
                  <label>
                    拜访类型
                    <select>
                      <option>常规拜访</option>
                      <option>补货跟进</option>
                      <option>新品推荐</option>
                    </select>
                  </label>
                  <label>
                    拜访目标
                    <input placeholder="填写本次拜访目标" />
                  </label>
                </div>
              </div>
              <div className="profile-footer">
                <span>
                  门店状态　
                  <b className={active.status === "正常" ? "ok-v3" : "warn-v3"}>
                    {active.status}
                  </b>
                </span>
                <button className="record-v3" onClick={() => record(active)}>
                  ✓ 记录本次拜访
                </button>
              </div>
            </article>
          )}
        </section>
      )}
      {editing && (
        <div className="modal-v3-bg" onClick={() => setEditing(null)}>
          <div className="modal-v3" onClick={(e) => e.stopPropagation()}>
            <div className="modal-v3-title">
              <div>
                <small>编辑门店详情</small>
                <h2>{editing.name}</h2>
              </div>
              <button onClick={() => setEditing(null)}>×</button>
            </div>
            <label>
              门店名称
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </label>
            <div className="form-v3">
              <label>
                客户编码
                <input
                  value={editing.id}
                  onChange={(e) =>
                    setEditing({ ...editing, id: e.target.value })
                  }
                />
              </label>
              <label>
                区域
                <input
                  value={editing.region}
                  onChange={(e) =>
                    setEditing({ ...editing, region: e.target.value })
                  }
                />
              </label>
              <label>
                代理商
                <input
                  value={editing.dealer}
                  onChange={(e) =>
                    setEditing({ ...editing, dealer: e.target.value })
                  }
                />
              </label>
              <label>
                负责人
                <input
                  value={editing.owner}
                  onChange={(e) =>
                    setEditing({ ...editing, owner: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              在售产品（逗号分隔）
              <textarea
                value={editing.products.join("，")}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    products: e.target.value
                      .split(/[，,]/)
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
              />
            </label>
            <label>
              门店地址
              <input value={editing.address || ""} placeholder="填写详细地址" onChange={(e) => setEditing({ ...editing, address: e.target.value })} />
            </label>
            <div className="form-v3">
              <label>纬度<input type="number" step="0.000001" value={editing.lat ?? ""} onChange={(e) => setEditing({ ...editing, lat: Number(e.target.value) })} /></label>
              <label>经度<input type="number" step="0.000001" value={editing.lng ?? ""} onChange={(e) => setEditing({ ...editing, lng: Number(e.target.value) })} /></label>
            </div>
            <div className="modal-v3-actions">
              <button onClick={() => setEditing(null)}>取消</button>
              <button onClick={save}>保存修改</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="toast-v3">✓　{toast}</div>}
    </main>
  );
}

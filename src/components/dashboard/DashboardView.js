"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Col, Container, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { LuBox, LuIndianRupee, LuRefreshCw, LuTriangleAlert, LuUndo2 } from "react-icons/lu";
import { api } from "@/lib/api";
import { formatCompactINR } from "@/lib/format";
import SummaryCards from "@/components/ui/SummaryCards";
import { ActivityChart, StatusChart, TopIssuedChart } from "@/components/charts/DashboardCharts";

const REFRESH_MS = 60000;
const n0 = (v) => Number(v).toLocaleString("en-IN");

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const ACTIVITY = {
  opening: { text: "Opening balance", sign: "+" },
  purchase: { text: "Purchased", sign: "+" },
  issue: { text: "Issued to", sign: "-" },
  return_good: { text: "Returned (good) by", sign: "+" },
  return_damaged: { text: "Returned damaged by", sign: "" },
  scrap: { text: "Scrap", sign: "-" },
};

/** A titled card used by every block of the dashboard. */
function Block({ title, hint, action, children, className = "" }) {
  return (
    <Card className={`dash-card h-100 ${className}`}>
      <Card.Body>
        <div className="dash-card__head">
          <div>
            <h3 className="dash-card__title">{title}</h3>
            {hint && <div className="dash-card__hint">{hint}</div>}
          </div>
          {action}
        </div>
        {children}
      </Card.Body>
    </Card>
  );
}

const Empty = ({ children }) => <div className="dash-empty">{children}</div>;

export default function DashboardView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    try {
      const res = await api("/dashboard");
      setData(res.data);
      setError("");
    } catch (e) {
      setError(e.message || "Error loading the dashboard");
      if (!quiet) toast.error(e.message || "Error loading the dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const tick = () => document.visibilityState === "visible" && load({ quiet: true });
    const id = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  if (loading) {
    return (
      <Container fluid className="flex-grow-1">
        <div className="dash-empty dash-empty--page">Loading the dashboard...</div>
      </Container>
    );
  }
  if (!data) {
    return (
      <Container fluid className="flex-grow-1">
        <div className="dash-empty dash-empty--page text-danger">
          {error || "The dashboard could not be loaded."}{" "}
          <Button variant="link" className="p-0 align-baseline" onClick={() => load()}>Try again</Button>
        </div>
      </Container>
    );
  }

  const t = data.tiles;
  const cards = [
    { key: "components", Icon: LuBox, badge: "Inventory", title: "Total Components",
      value: n0(t.components), note: `${n0(t.units)} units in stock` },
    { key: "value", Icon: LuIndianRupee, badge: "Valuation", title: "Stock Value",
      value: formatCompactINR(t.stockValue), note: "Quantity x price of everything in stock" },
    { key: "low", Icon: LuTriangleAlert, badge: "Attention", title: "Low Stock Items",
      value: n0(t.lowStock), note: `${n0(t.outOfStock)} component${t.outOfStock === 1 ? "" : "s"} out of stock` },
    { key: "pending", Icon: LuUndo2, badge: "Tracking", title: "Pending Returns",
      value: n0(t.pendingUsers), note: `${n0(t.pendingUnits)} component${t.pendingUnits === 1 ? "" : "s"} still with students` },
  ];

  const q = data.quarter;
  const monthlyHasData = data.monthly && [...data.monthly.purchases, ...data.monthly.issued, ...data.monthly.scrap].some((v) => v > 0);
  const statusTotal = data.status.healthy + data.status.low + data.status.out;

  return (
    <Container fluid className="flex-grow-1 dash">
      <SummaryCards cards={cards} />

      {/* This quarter at a glance */}
      {q && (
        <Card className="dash-quarter mb-3">
          <Card.Body>
            <div className="dash-quarter__title">
              <strong>Q{q.quarter} {q.year}</strong>
              <span>this quarter at a glance</span>
            </div>
            <div className="dash-quarter__figures">
              <div><span>Opening</span><strong>{n0(q.opening)}</strong></div>
              <div><span>Purchases</span><strong className="plus">+{n0(q.addition)}</strong></div>
              <div><span>Utilised</span><strong>{n0(q.utilised)}</strong></div>
              <div><span>Scrap</span><strong className="minus">{n0(q.scrap)}</strong></div>
              <div><span>Closing</span><strong>{n0(q.closing)}</strong></div>
            </div>
            <Link href="/audit-report" className="dash-link">Open Audit Report</Link>
          </Card.Body>
        </Card>
      )}

      <Row className="g-3 mb-3">
        <Col xs={12} lg={8}>
          <Block
            title="Monthly activity"
            hint={data.monthly ? `Purchases, components issued and scrap in ${data.monthly.year}` : undefined}
            action={
              <Button variant="outline-secondary" size="sm" className="dash-refresh" onClick={() => load({ quiet: true })} disabled={refreshing} aria-label="Refresh dashboard">
                <LuRefreshCw className={refreshing ? "spin" : ""} /> Refresh
              </Button>
            }
          >
            {!data.ledgerReady ? (
              <Empty>Monthly activity appears once the stock records are set up (run the latest SQL file in Supabase).</Empty>
            ) : !monthlyHasData ? (
              <Empty>No purchases, issues or scrap recorded this year yet.</Empty>
            ) : (
              <div className="dash-chart dash-chart--tall">
                <ActivityChart {...data.monthly} />
              </div>
            )}
          </Block>
        </Col>
        <Col xs={12} lg={4}>
          <Block title="Stock health" hint={`${n0(statusTotal)} components`}>
            {statusTotal === 0 ? (
              <Empty>No components yet.</Empty>
            ) : (
              <div className="dash-chart dash-chart--tall">
                <StatusChart {...data.status} />
              </div>
            )}
          </Block>
        </Col>
      </Row>

      <Row className="g-3 mb-3">
        <Col xs={12} lg={6}>
          <Block title="Most issued components" hint="Total quantity issued to students">
            {data.mostIssued.length === 0 ? (
              <Empty>Nothing has been issued yet.</Empty>
            ) : (
              <div className="dash-chart">
                <TopIssuedChart items={data.mostIssued} />
              </div>
            )}
          </Block>
        </Col>
        <Col xs={12} lg={6}>
          <Block
            title="Needs attention"
            hint="Components at or below their minimum stock level"
            action={<Link href="/inventory" className="dash-link">Inventory</Link>}
          >
            {data.attention.length === 0 ? (
              <Empty>Nothing is running low. Set a minimum stock level on a component to be warned here.</Empty>
            ) : (
              <ul className="dash-list">
                {data.attention.map((a) => {
                  const pct = a.minimum ? Math.min(100, Math.round((a.quantity / a.minimum) * 100)) : 0;
                  return (
                    <li key={a.id}>
                      <div className="dash-list__row">
                        <span className="dash-list__name">{a.name}</span>
                        <span className={`dash-pill ${a.quantity <= 0 ? "dash-pill--red" : "dash-pill--orange"}`}>
                          {a.quantity <= 0 ? "Out of stock" : `${a.quantity} left`}
                        </span>
                      </div>
                      <div className="dash-meter" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                      <div className="dash-list__meta">{a.minimum !== null ? `Minimum ${a.minimum}` : "Marked low stock"}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>
        </Col>
      </Row>

      <Row className="g-3">
        <Col xs={12} lg={6}>
          <Block
            title="Pending returns"
            hint={data.pendingTotal > 0 ? `${data.pendingTotal} component line${data.pendingTotal === 1 ? "" : "s"} still with students` : undefined}
            action={<Link href="/user-track" className="dash-link">Tracking</Link>}
          >
            {data.pending.length === 0 ? (
              <Empty>Every issued component has been returned.</Empty>
            ) : (
              <ul className="dash-list">
                {data.pending.map((p) => (
                  <li key={p.id}>
                    <div className="dash-list__row">
                      <span className="dash-list__name">{p.student}</span>
                      <span className={`dash-pill ${p.daysLate > 0 ? "dash-pill--red" : "dash-pill--purple"}`}>
                        {p.daysLate > 0 ? `${p.daysLate} day${p.daysLate === 1 ? "" : "s"} overdue` : `Due ${fmtDate(p.dueDate)}`}
                      </span>
                    </div>
                    <div className="dash-list__meta">{p.quantity} x {p.component}</div>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </Col>
        <Col xs={12} lg={6}>
          <Block title="Recent activity" hint="The latest stock movements">
            {data.recent.length === 0 ? (
              <Empty>{data.ledgerReady ? "No stock movements yet." : "Recent activity appears once the stock records are set up."}</Empty>
            ) : (
              <ul className="dash-list">
                {data.recent.map((r) => {
                  const info = ACTIVITY[r.type] || { text: r.type, sign: "" };
                  return (
                    <li key={r.id}>
                      <div className="dash-list__row">
                        <span className="dash-list__name">
                          {info.text}{r.student ? ` ${r.student}` : ""}
                        </span>
                        <span className={`dash-qty ${info.sign === "+" ? "plus" : info.sign === "-" ? "minus" : ""}`}>{info.sign}{r.quantity}</span>
                      </div>
                      <div className="dash-list__meta">{r.component} - {fmtDate(r.date)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Block>
        </Col>
      </Row>
    </Container>
  );
}

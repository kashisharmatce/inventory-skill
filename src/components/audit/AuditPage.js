"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Container, Form, InputGroup, Modal, Pagination, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { FaEye } from "react-icons/fa";
import {
  LuCircleCheck,
  LuClipboardList,
  LuFileSpreadsheet,
  LuLock,
  LuPackageCheck,
  LuRadio,
  LuRefreshCw,
  LuRotateCcw,
  LuShoppingCart,
  LuTrash2,
  LuTrendingDown,
} from "react-icons/lu";
import { TiArrowUnsorted } from "react-icons/ti";
import { api } from "@/lib/api";
import { MONTH_NAMES, QUARTERS } from "@/lib/auditFilters";
import { downloadXlsx } from "@/lib/xlsx";
import Field from "@/components/ui/Field";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SummaryCards from "@/components/ui/SummaryCards";

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth() + 1;
const CURRENT_QUARTER = Math.floor(NOW.getMonth() / 3) + 1;
const pad = (n) => String(n).padStart(2, "0");
const todayInput = () => `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;
const quarterStartInput = () => `${NOW.getFullYear()}-${pad((CURRENT_QUARTER - 1) * 3 + 1)}-01`;

// Same column names as the reference stock register.
const COLUMNS = [
  { key: "productName", label: "Particulars", left: true },
  { key: "opening", label: "OP Bal" },
  { key: "addition", label: "Addition (Purchases)" },
  { key: "utilised", label: "Utilised" },
  { key: "scrap", label: "Scrap" },
  { key: "closing", label: "Closing Stock" },
];

const PAGE_SIZES = [10, 25, 50, 100];
const REFRESH_MS = 30000; // a running period re-reads the latest data on its own

const MOVEMENT_LABELS = {
  opening: { text: "Opening balance", sign: "+" },
  purchase: { text: "Purchase (added to inventory)", sign: "+" },
  issue: { text: "Issued to student", sign: "-" },
  return_good: { text: "Returned - good condition (back in stock)", sign: "+" },
  return_damaged: { text: "Returned - damaged (scrap, not in stock)", sign: "0" },
  scrap: { text: "Scrap / stock reduced", sign: "-" },
};

const EMPTY_ADJUSTMENT = { productId: "", type: "purchase", quantity: "", date: "", reason: "" };

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");
const n0 = (v) => Number(v).toLocaleString("en-IN");

export default function AuditPage() {
  // Report type: "recent" (Open / Recent = the running quarter, latest data) | "quarter" | "month" | "year" | "all"
  const [mode, setMode] = useState("recent");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [quarter, setQuarter] = useState(CURRENT_QUARTER);
  const [month, setMonth] = useState(CURRENT_MONTH);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [viewing, setViewing] = useState(null);
  const [movements, setMovements] = useState(null); // null = loading

  // manual stock adjustment (Add)
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjProducts, setAdjProducts] = useState([]);
  const [adjForm, setAdjForm] = useState(EMPTY_ADJUSTMENT);
  const [adjErrors, setAdjErrors] = useState({});
  const [confirmAdj, setConfirmAdj] = useState(false);
  const [adjSaving, setAdjSaving] = useState(false);

  // ---- load the report (calculated by the database from every purchase, issue, return and scrap) ----
  const fetchReport = useCallback(
    async ({ quiet = false } = {}) => {
      if (quiet) setRefreshing(true);
      else setLoading(true);
      setLoadError("");
      try {
        const qs = new URLSearchParams({ mode });
        if (mode === "quarter") { qs.set("year", year); qs.set("quarter", quarter); }
        if (mode === "month") { qs.set("year", year); qs.set("month", month); }
        if (mode === "year") qs.set("year", year);
        const res = await api(`/audit?${qs}`);
        setReport(res.data);
      } catch (error) {
        if (!quiet) setReport(null);
        setLoadError(error.message || "Error loading the audit report");
        if (!quiet) toast.error(error.message || "Error loading the audit report");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [mode, year, quarter, month]
  );

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // keep a running period up to date: every 30 s while the tab is visible, and when it is focused again
  const live = report && !report.closed;
  useEffect(() => {
    if (!live) return;
    const tick = () => document.visibilityState === "visible" && fetchReport({ quiet: true });
    const id = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [live, fetchReport]);

  // ---- search + sort ----
  const rows = report?.rows ?? [];
  const visible = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let list = term ? rows.filter((r) => r.productName.toLowerCase().includes(term)) : rows;
    if (sort.key) {
      const dir = sort.dir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => {
        const x = a[sort.key];
        const y = b[sort.key];
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
      });
    }
    return list;
  }, [rows, searchTerm, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => setPage(1), [mode, year, quarter, month, searchTerm, pageSize, sort]);

  const totals = useMemo(
    () =>
      visible.reduce(
        (t, r) => ({
          opening: t.opening + r.opening,
          addition: t.addition + r.addition,
          utilised: t.utilised + r.utilised,
          scrap: t.scrap + r.scrap,
          closing: t.closing + r.closing,
        }),
        { opening: 0, addition: 0, utilised: 0, scrap: 0, closing: 0 }
      ),
    [visible]
  );

  // title of the period shown: "Q4 2026", "November 2026", "2026" or "All records"
  const periodLabel = !report
    ? ""
    : report.mode === "all"
      ? "All records"
      : report.mode === "year"
        ? String(report.year)
        : report.mode === "month"
          ? `${MONTH_NAMES[report.month - 1]} ${report.year}`
          : `Q${report.quarter} ${report.year}`;
  const rangeLabel = report ? (report.from ? `${fmtDate(report.from)} - ${fmtDate(report.to)}` : `up to ${fmtDate(report.to)}`) : "";
  const filtersActive = mode !== "recent" || searchTerm.trim() !== "" || sort.key !== null;

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = CURRENT_YEAR + 1; y >= 2020; y--) years.push(y);
    return years;
  }, []);

  const resetFilters = () => {
    setMode("recent");
    setYear(CURRENT_YEAR);
    setQuarter(CURRENT_QUARTER);
    setMonth(CURRENT_MONTH);
    setSearchTerm("");
    setSort({ key: null, dir: "asc" });
    setPageSize(10);
  };

  const toggleSort = (key) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  // ---- details of one component: gross figures + every movement of the period ----
  const openDetails = async (row) => {
    setViewing(row);
    setMovements(null);
    try {
      const qs = new URLSearchParams({ from: report.from || "2000-01-01", to: report.to });
      if (row.productId) qs.set("productId", row.productId);
      else qs.set("productName", row.productName);
      const res = await api(`/audit/movements?${qs}`);
      setMovements(res.data);
    } catch (error) {
      setMovements([]);
      toast.error(error.message || "Could not load the transactions");
    }
  };

  const handleExport = () => {
    if (visible.length === 0) {
      toast.info("There are no records to export for the current filters");
      return;
    }
    try {
      downloadXlsx(`audit-report-${periodLabel.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}.xlsx`, {
        sheetName: periodLabel.slice(0, 31),
        title: `INVENTORY DETAILS - ${periodLabel} (${rangeLabel})`,
        headers: ["Sl.No", "Particulars", "OP Bal", "ADDITION (PURCHASES)", "UTILISED", "SCRAP", "CLOSING STOCK", "Issued", "Returned (Good)", "Returned (Damaged)"],
        rows: visible.map((r, i) => [i + 1, r.productName, r.opening, r.addition, r.utilised, r.scrap, r.closing, r.issued, r.returnedGood, r.returnedDamaged]),
        widths: [8, 42, 10, 22, 12, 10, 16, 10, 16, 18],
      });
      toast.success(`Exported ${visible.length} component${visible.length === 1 ? "" : "s"} to Excel`);
    } catch {
      toast.error("Could not create the Excel file");
    }
  };

  // ---- manual stock adjustment (Add) ----
  const openAdjust = async () => {
    setAdjForm({ ...EMPTY_ADJUSTMENT, date: todayInput() });
    setAdjErrors({});
    setShowAdjust(true);
    try {
      const res = await api("/storage"); // latest stock for the list
      setAdjProducts([...res.data].sort((a, b) => a.productName.localeCompare(b.productName)));
    } catch (error) {
      toast.error(error.message || "Could not load the components");
    }
  };

  const handleAdjChange = (e) => {
    const { name, value } = e.target;
    setAdjForm((prev) => ({ ...prev, [name]: value }));
    setAdjErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const validateAdjustment = () => {
    const errors = {};
    const product = adjProducts.find((p) => p.id === adjForm.productId);
    const qty = Number(adjForm.quantity);
    if (!product) errors.productId = "Choose a component";
    if (adjForm.quantity === "" || !Number.isInteger(qty) || qty < 1) errors.quantity = "Enter a whole number of 1 or more";
    else if (adjForm.type === "scrap" && product && qty > Number(product.quantity))
      errors.quantity = `Only ${product.quantity} in stock - you cannot scrap more than that`;
    if (!adjForm.date) errors.date = "Choose a date";
    else if (adjForm.date > todayInput()) errors.date = "The date cannot be in the future";
    else if (adjForm.date < quarterStartInput()) errors.date = "Earlier quarters are closed - choose a date in the current quarter";
    if (adjForm.reason.length > 200) errors.reason = "Maximum 200 characters";
    return errors;
  };

  const requestAdjustment = () => {
    const found = validateAdjustment();
    setAdjErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setConfirmAdj(true);
  };

  const performAdjustment = async () => {
    setAdjSaving(true);
    try {
      await api("/audit/adjustments", {
        method: "POST",
        body: { productId: adjForm.productId, type: adjForm.type, quantity: Number(adjForm.quantity), date: adjForm.date, reason: adjForm.reason },
      });
      const name = adjProducts.find((p) => p.id === adjForm.productId)?.productName ?? "Component";
      toast.success(
        adjForm.type === "purchase"
          ? `${adjForm.quantity} added to "${name}" (recorded as a purchase)`
          : `${adjForm.quantity} of "${name}" written off (recorded as scrap)`
      );
      setConfirmAdj(false);
      setShowAdjust(false);
      await fetchReport({ quiet: true });
    } catch (error) {
      setConfirmAdj(false);
      toast.error(error.message || "Could not record the adjustment");
    } finally {
      setAdjSaving(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, pageCount]);

  const cards = [
    { key: "addition", Icon: LuShoppingCart, badge: periodLabel || "Period", title: "Addition (Purchases)",
      value: loading ? "…" : n0(totals.addition), note: "Components added to the inventory" },
    { key: "utilised", Icon: LuTrendingDown, badge: "Tracking", title: "Utilised",
      value: loading ? "…" : n0(totals.utilised), note: "Issued to students, net of returns" },
    { key: "scrap", Icon: LuTrash2, badge: "Attention", title: "Scrap",
      value: loading ? "…" : n0(totals.scrap), note: "Damaged and written-off components" },
    { key: "closing", Icon: LuPackageCheck, badge: "Stock", title: "Closing Stock",
      value: loading ? "…" : n0(totals.closing), note: "Opening + Addition - Utilised - Scrap" },
  ];

  const emptyMessage = () => {
    if (loading) return "Loading...";
    if (loadError) return loadError;
    if (rows.length === 0) return "No components were in the inventory in this period.";
    return "No components match your search";
  };

  const adjProduct = adjProducts.find((p) => p.id === adjForm.productId);

  return (
    <>
      {/* Add: manual stock adjustment */}
      <Modal show={showAdjust} onHide={() => !adjSaving && setShowAdjust(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Stock Adjustment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form noValidate onSubmit={(e) => e.preventDefault()}>
            <Field id="adjProduct" label="Component" error={adjErrors.productId}>
              <Form.Select name="productId" value={adjForm.productId} onChange={handleAdjChange} isInvalid={!!adjErrors.productId}>
                <option value="">Select a component</option>
                {adjProducts.map((p) => (
                  <option key={p.id} value={p.id}>{p.productName} (stock: {p.quantity})</option>
                ))}
              </Form.Select>
            </Field>
            <Field id="adjType" label="Type">
              <Form.Select name="type" value={adjForm.type} onChange={handleAdjChange}>
                <option value="purchase">Purchase - stock added to the inventory</option>
                <option value="scrap">Scrap - stock written off (lost / spoiled)</option>
              </Form.Select>
            </Field>
            <Row>
              <Col xs={6}>
                <Field id="adjQty" label="Quantity" type="number" min="1" step="1" name="quantity" placeholder="0"
                  value={adjForm.quantity} onChange={handleAdjChange} error={adjErrors.quantity} />
              </Col>
              <Col xs={6}>
                <Field id="adjDate" label="Date" type="date" name="date" min={quarterStartInput()} max={todayInput()}
                  value={adjForm.date} onChange={handleAdjChange} error={adjErrors.date} />
              </Col>
            </Row>
            <Field id="adjReason" label="Reason (optional)" type="text" name="reason" maxLength={200} placeholder="e.g. delivery received, damaged in lab"
              value={adjForm.reason} onChange={handleAdjChange} error={adjErrors.reason} />
            <Form.Text muted className="d-block">
              This changes the Inventory stock and is recorded in the Audit Report. The date must be in the current quarter - earlier quarters are closed.
              {adjProduct ? ` Current stock of ${adjProduct.productName}: ${adjProduct.quantity}.` : ""}
            </Form.Text>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setShowAdjust(false)} disabled={adjSaving}>Cancel</Button>
          <Button className="save" onClick={requestAdjustment} disabled={adjSaving}>{adjSaving ? "Saving..." : "Save"}</Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={confirmAdj}
        busy={adjSaving}
        title="Record stock adjustment?"
        message={
          adjForm.type === "purchase"
            ? `Add ${adjForm.quantity} to "${adjProduct?.productName ?? ""}"? It is recorded as a purchase on ${fmtDate(adjForm.date)}.`
            : `Write off ${adjForm.quantity} of "${adjProduct?.productName ?? ""}"? It is removed from the inventory and recorded as scrap on ${fmtDate(adjForm.date)}.`
        }
        confirmLabel="Yes, record"
        busyLabel="Saving..."
        onConfirm={performAdjustment}
        onCancel={() => setConfirmAdj(false)}
      />

      {/* Details of one component */}
      <Modal show={!!viewing} onHide={() => setViewing(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{viewing?.productName} - {periodLabel}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewing && (
            <>
              <Row className="audit-detail">
                <Col xs={6} md={3}><span>OP Bal</span><strong>{viewing.opening}</strong></Col>
                <Col xs={6} md={3}><span>Addition (Purchases)</span><strong>{viewing.addition}</strong></Col>
                <Col xs={6} md={3}><span>Utilised</span><strong>{viewing.utilised}</strong></Col>
                <Col xs={6} md={3}><span>Scrap</span><strong>{viewing.scrap}</strong></Col>
                <Col xs={12}><span>Closing Stock</span><strong className="audit-detail__closing">{viewing.closing}</strong></Col>
              </Row>
              <p className="audit-note">
                Utilised = issued {viewing.issued} - returned in good condition {viewing.returnedGood} - returned damaged {viewing.returnedDamaged}
                {" "}= {viewing.utilised}. Damaged returns are counted under Scrap, not back in stock.
              </p>

              <h6 className="audit-subtitle">Transactions in this period</h6>
              {movements === null && <div className="attachment-empty">Loading transactions...</div>}
              {movements && movements.length === 0 && <div className="attachment-empty">No transactions in this period</div>}
              {movements && movements.length > 0 && (
                <div className="table-scroll">
                  <table className="table table-sm table-striped audit-movements">
                    <thead>
                      <tr><th>Date</th><th>What happened</th><th>Qty</th><th>Student</th></tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => {
                        const info = MOVEMENT_LABELS[m.type] || { text: m.type, sign: "" };
                        return (
                          <tr key={m.id}>
                            <td>{fmtDate(m.date)}</td>
                            <td className="text-start">{info.text}{m.note && m.note !== info.text ? <small className="d-block text-muted">{m.note}</small> : null}</td>
                            <td className={info.sign === "+" ? "mv-plus" : info.sign === "-" ? "mv-minus" : ""}>{info.sign === "0" ? "" : info.sign}{m.quantity}</td>
                            <td>{m.userName || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setViewing(null)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Container fluid className="flex-grow-1">
        <SummaryCards cards={cards} />

        {/* Report type */}
        <Card className="mb-3">
          <Card.Body className="audit-filters">
            <Row className="g-2 align-items-end">
              <Col xs={12} sm={6} md={4} lg={3}>
                <Form.Label className="mb-1" htmlFor="auditView">Report type</Form.Label>
                <Form.Select id="auditView" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="recent">Open / Recent (current quarter, live)</option>
                  <option value="quarter">Quarterly</option>
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="all">All records</option>
                </Form.Select>
              </Col>

              {mode === "month" && (
                <Col xs={6} sm={3} md={3} lg={2}>
                  <Form.Label className="mb-1" htmlFor="auditMonth">Month</Form.Label>
                  <Form.Select id="auditMonth" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                    {MONTH_NAMES.map((name, i) => (
                      <option key={name} value={i + 1}>{name}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              {mode === "quarter" && (
                <Col xs={6} sm={3} md={3} lg={2}>
                  <Form.Label className="mb-1" htmlFor="auditQuarter">Quarter</Form.Label>
                  <Form.Select id="auditQuarter" value={quarter} onChange={(e) => setQuarter(Number(e.target.value))}>
                    {QUARTERS.map((q) => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              {(mode === "quarter" || mode === "month" || mode === "year") && (
                <Col xs={6} sm={3} md={2} lg={2}>
                  <Form.Label className="mb-1" htmlFor="auditYear">Year</Form.Label>
                  <Form.Select id="auditYear" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              <Col xs="auto" className="d-flex gap-2">
                <Button variant="outline-secondary" onClick={resetFilters} disabled={!filtersActive}>
                  <LuRotateCcw /> Reset Filters
                </Button>
                <Button variant="outline-secondary" onClick={() => fetchReport({ quiet: true })} disabled={loading || refreshing}>
                  <LuRefreshCw className={refreshing ? "spin" : ""} /> Refresh
                </Button>
              </Col>
            </Row>

            {report && (
              <div className="audit-status">
                <strong>{periodLabel}</strong> <span>({rangeLabel})</span>
                {report.saved ? (
                  <span className="audit-badge audit-badge--saved"><LuCircleCheck /> Saved quarter - never changes</span>
                ) : report.closed ? (
                  <span className="audit-badge audit-badge--saved"><LuLock /> Closed period - from the permanent records</span>
                ) : (
                  <span className="audit-badge audit-badge--live"><LuRadio /> Live - updates with every purchase, issue and return</span>
                )}
                <span className="audit-updated">
                  {report.saved
                    ? report.savedAt ? `Saved on ${fmtDate(report.savedAt)}` : ""
                    : report.closed ? "" : `Last updated ${fmtTime(report.generatedAt)}`}
                </span>
              </div>
            )}
          </Card.Body>
        </Card>

        {/* Search + actions */}
        <Row className="mb-3 g-2">
          <Col xs={12} md={5} lg={4}>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Search by particulars"
                aria-label="Search audit report"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <InputGroup.Text>
                <CiSearch />
              </InputGroup.Text>
            </InputGroup>
          </Col>
          <Col xs={12} md={7} lg={8} className="d-flex justify-content-md-end gap-2">
            <Button variant="outline-secondary" className="audit-export" onClick={handleExport}>
              <LuFileSpreadsheet /> Export to Excel
            </Button>
            <Button onClick={openAdjust} className="button-add-product">
              <BiSolidMessageSquareAdd size={20} /> Add
            </Button>
          </Col>
        </Row>

        <Row>
          <Col xs={12}>
            <Card>
              <Card.Body>
                <Card.Title>Audit Report - {periodLabel || "…"}</Card.Title>
                <div className="audit-count">
                  <LuClipboardList /> {loading ? "Loading..." : `${visible.length} component${visible.length === 1 ? "" : "s"}`}
                </div>

                <div className="table table-scroll">
                  <table className="table table-striped table-bordered table-hover admin-table audit-table">
                    <thead>
                      <tr>
                        <th>Sl.No</th>
                        {COLUMNS.map((c) => (
                          <th
                            key={c.key}
                            role="button"
                            className={`sortable${c.left ? " cell-start" : ""}`}
                            aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                            onClick={() => toggleSort(c.key)}
                          >
                            {c.label} <TiArrowUnsorted />
                          </th>
                        ))}
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 && (
                        <tr>
                          <td colSpan={COLUMNS.length + 2} className={loadError ? "text-danger" : ""}>
                            {emptyMessage()}
                            {loadError && !loading && (
                              <>
                                {" "}
                                <Button variant="link" className="p-0 align-baseline" onClick={() => fetchReport()}>Try again</Button>
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                      {pageRows.map((r, index) => (
                        <tr key={r.productId || r.productName}>
                          <td>{(currentPage - 1) * pageSize + index + 1}</td>
                          <td className="cell-start">{r.productName}</td>
                          <td>{r.opening}</td>
                          <td>{r.addition}</td>
                          <td className={r.utilised < 0 ? "mv-plus" : ""} title={r.utilised < 0 ? "More was returned than issued in this period (items issued earlier came back)" : undefined}>{r.utilised}</td>
                          <td>{r.scrap}</td>
                          <td><strong>{r.closing}</strong></td>
                          <td>
                            <Button className="button-add-product1" onClick={() => openDetails(r)} aria-label="View details">
                              <FaEye size={20} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {visible.length > 0 && (
                      <tfoot>
                        <tr>
                          <td></td>
                          <td className="cell-start"><strong>Total</strong></td>
                          <td><strong>{totals.opening}</strong></td>
                          <td><strong>{totals.addition}</strong></td>
                          <td><strong>{totals.utilised}</strong></td>
                          <td><strong>{totals.scrap}</strong></td>
                          <td><strong>{totals.closing}</strong></td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {visible.length > 0 && (
                  <div className="audit-pagination">
                    <div className="audit-pagination__size">
                      <Form.Label className="mb-0" htmlFor="auditPageSize">Rows per page</Form.Label>
                      <Form.Select id="auditPageSize" size="sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                        {PAGE_SIZES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </Form.Select>
                      <span className="audit-pagination__range">
                        {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, visible.length)} of {visible.length}
                      </span>
                    </div>
                    <Pagination className="mb-0">
                      <Pagination.First onClick={() => setPage(1)} disabled={currentPage === 1} />
                      <Pagination.Prev onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} />
                      {pageNumbers.map((p) => (
                        <Pagination.Item key={p} active={p === currentPage} onClick={() => setPage(p)}>{p}</Pagination.Item>
                      ))}
                      <Pagination.Next onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} />
                      <Pagination.Last onClick={() => setPage(pageCount)} disabled={currentPage === pageCount} />
                    </Pagination>
                  </div>
                )}

                <p className="audit-note audit-note--footer">
                  Closing Stock = OP Bal + Addition (Purchases) - Utilised - Scrap, calculated for every component. OP Bal is the closing stock
                  before the period starts. Everything here is recorded automatically from the Inventory and Tracking pages; use Add for a manual
                  purchase or scrap.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

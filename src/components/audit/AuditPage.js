"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Container, Form, InputGroup, Modal, Pagination, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { FaEye } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { LuClipboardList, LuFileSpreadsheet, LuPackageCheck, LuRotateCcw, LuTrash2, LuTrendingDown } from "react-icons/lu";
import { LuClipboardPen } from "react-icons/lu";
import { TiArrowUnsorted } from "react-icons/ti";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { MONTH_NAMES, QUARTERS, describeFilter, getDateRange } from "@/lib/auditFilters";
import { downloadXlsx } from "@/lib/xlsx";
import Field from "@/components/ui/Field";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SummaryCards from "@/components/ui/SummaryCards";

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const todayInput = () => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;
};

const DEFAULT_FILTER = {
  mode: "all",
  year: CURRENT_YEAR,
  month: NOW.getMonth() + 1,
  quarter: Math.floor(NOW.getMonth() / 3) + 1,
};

const EMPTY_FORM = { auditDate: "", particulars: "", opBalance: "", addition: "", utilised: "", scrap: "" };

// Same column names as the reference stock register.
const COLUMNS = [
  { key: "auditDate", label: "Audit Date" },
  { key: "particulars", label: "Particulars" },
  { key: "opBalance", label: "OP Bal" },
  { key: "addition", label: "Addition (Purchases)" },
  { key: "utilised", label: "Utilised" },
  { key: "scrap", label: "Scrap" },
  { key: "closingStock", label: "Closing Stock" },
];

const PAGE_SIZES = [10, 25, 50, 100];
const num = (v) => Number(v) || 0;
const closingOf = (f) => num(f.opBalance) + num(f.addition) - num(f.utilised) - num(f.scrap);

function validate(form) {
  const errors = {};
  if (!form.auditDate) errors.auditDate = "Audit date is required";
  if (!form.particulars.trim()) errors.particulars = "Particulars is required";
  else if (form.particulars.trim().length > 200) errors.particulars = "Maximum 200 characters";
  for (const [key, label] of [
    ["opBalance", "OP Bal"],
    ["addition", "Addition"],
    ["utilised", "Utilised"],
    ["scrap", "Scrap"],
  ]) {
    const v = form[key];
    if (v === "" || v === null || v === undefined) {
      if (key === "opBalance") errors[key] = "OP Bal is required (enter 0 if none)";
      continue;
    }
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) errors[key] = `${label} must be a whole number (0 or more)`;
  }
  if (Object.keys(errors).length === 0 && closingOf(form) < 0)
    errors.utilised = "Utilised + Scrap cannot be more than OP Bal + Addition";
  return errors;
}

export default function AuditPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [filter, setFilter] = useState(DEFAULT_FILTER);
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [confirmSave, setConfirmSave] = useState(false);
  const [saving, setSaving] = useState(false);

  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [working, setWorking] = useState(false);

  // ---- load records for the selected period (the filter is applied by the database query) ----
  const range = useMemo(() => getDateRange(filter), [filter]);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const qs = new URLSearchParams();
      if (range.from) qs.set("from", range.from);
      if (range.to) qs.set("to", range.to);
      const res = await api(`/audit${qs.toString() ? `?${qs}` : ""}`);
      setRecords(res.data);
    } catch (error) {
      setRecords([]);
      setLoadError(error.message || "Error fetching audit records");
      toast.error(error.message || "Error fetching audit records");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ---- search + sort (client side, on the records of the selected period) ----
  const visible = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    let rows = records;
    if (term) {
      rows = rows.filter(
        (r) =>
          r.particulars.toLowerCase().includes(term) ||
          r.auditDate.includes(term) ||
          formatDate(r.auditDate).toLowerCase().includes(term)
      );
    }
    if (sort.key) {
      const dir = sort.dir === "asc" ? 1 : -1;
      rows = [...rows].sort((a, b) => {
        const x = a[sort.key];
        const y = b[sort.key];
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
      });
    }
    return rows;
  }, [records, searchTerm, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [filter, searchTerm, pageSize, sort]);

  const totals = useMemo(
    () => ({
      closing: visible.reduce((s, r) => s + r.closingStock, 0),
      utilised: visible.reduce((s, r) => s + r.utilised, 0),
      scrap: visible.reduce((s, r) => s + r.scrap, 0),
    }),
    [visible]
  );

  const periodLabel = describeFilter(filter);
  const filtersActive = filter.mode !== "all" || searchTerm.trim() !== "" || sort.key !== null;

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = CURRENT_YEAR + 1; y >= 2020; y--) years.push(y);
    if (!years.includes(Number(filter.year))) years.push(Number(filter.year));
    return years;
  }, [filter.year]);

  // ---- handlers ----
  const setFilterField = (name, value) => setFilter((prev) => ({ ...prev, [name]: value }));

  const resetFilters = () => {
    setFilter(DEFAULT_FILTER);
    setSearchTerm("");
    setSort({ key: null, dir: "asc" });
    setPageSize(10);
  };

  const toggleSort = (key) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, auditDate: todayInput(), addition: "0", utilised: "0", scrap: "0" });
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (r) => {
    setEditingId(r.id);
    setForm({
      auditDate: r.auditDate,
      particulars: r.particulars,
      opBalance: String(r.opBalance),
      addition: String(r.addition),
      utilised: String(r.utilised),
      scrap: String(r.scrap),
    });
    setErrors({});
    setShowForm(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const requestSave = () => {
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setConfirmSave(true);
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const body = {
        auditDate: form.auditDate,
        particulars: form.particulars.trim(),
        opBalance: num(form.opBalance),
        addition: num(form.addition),
        utilised: num(form.utilised),
        scrap: num(form.scrap),
      };
      if (editingId) {
        await api(`/audit/${editingId}`, { method: "PUT", body });
        toast.success(`"${body.particulars}" updated successfully`);
      } else {
        await api("/audit", { method: "POST", body });
        toast.success(`"${body.particulars}" added successfully`);
      }
      setConfirmSave(false);
      setShowForm(false);
      await fetchRecords();
    } catch (error) {
      setConfirmSave(false);
      toast.error(error.message || "Could not save the record");
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async () => {
    setWorking(true);
    try {
      await api(`/audit/${deleting.id}`, { method: "DELETE" });
      toast.success(`"${deleting.particulars}" deleted successfully`);
      setDeleting(null);
      await fetchRecords();
    } catch (error) {
      toast.error(error.message || "Could not delete the record");
    } finally {
      setWorking(false);
    }
  };

  const handleExport = () => {
    if (visible.length === 0) {
      toast.info("There are no records to export for the current filters");
      return;
    }
    try {
      downloadXlsx(`audit-report-${periodLabel.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}.xlsx`, {
        sheetName: "Audit Report",
        title: `INVENTORY DETAILS - ${periodLabel}`,
        headers: ["Sl.No", "Audit Date", "Particulars", "OP Bal", "ADDITION (PURCHASES)", "UTILISED", "SCRAP", "CLOSING STOCK"],
        rows: visible.map((r, i) => [i + 1, r.auditDate, r.particulars, r.opBalance, r.addition, r.utilised, r.scrap, r.closingStock]),
        widths: [8, 14, 42, 10, 22, 12, 10, 16],
      });
      toast.success(`Exported ${visible.length} record${visible.length === 1 ? "" : "s"} to Excel`);
    } catch {
      toast.error("Could not create the Excel file");
    }
  };

  // ---- pagination buttons (window of up to 5 pages) ----
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
    const end = Math.min(pageCount, start + 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [currentPage, pageCount]);

  const cards = [
    { key: "records", Icon: LuClipboardList, badge: periodLabel, title: "Total Records",
      value: loading ? "…" : visible.length.toLocaleString("en-IN"), note: "Records matching the selected filters" },
    { key: "closing", Icon: LuPackageCheck, badge: "Stock", title: "Total Closing Stock",
      value: loading ? "…" : totals.closing.toLocaleString("en-IN"), note: "Closing units across these records" },
    { key: "utilised", Icon: LuTrendingDown, badge: "Usage", title: "Total Utilised",
      value: loading ? "…" : totals.utilised.toLocaleString("en-IN"), note: "Units utilised in this period" },
    { key: "scrap", Icon: LuTrash2, badge: "Attention", title: "Total Scrap",
      value: loading ? "…" : totals.scrap.toLocaleString("en-IN"), note: "Units scrapped in this period" },
  ];

  const emptyMessage = () => {
    if (loading) return "Loading...";
    if (loadError) return loadError;
    if (records.length === 0 && filter.mode === "all") return "No audit records yet. Click Add to create the first one.";
    return "No records match the selected filters";
  };

  return (
    <>
      {/* Add / edit form */}
      <Modal show={showForm} onHide={() => !saving && setShowForm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? "Update Audit Record" : "Add Audit Record"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form noValidate onSubmit={(e) => e.preventDefault()}>
            <Field id="auditDate" label="Audit Date" type="date" name="auditDate" value={form.auditDate}
              onChange={handleChange} error={errors.auditDate} required />
            <Field id="auditParticulars" label="Particulars" type="text" name="particulars" placeholder="Enter item name"
              value={form.particulars} onChange={handleChange} error={errors.particulars} maxLength={200} required />
            <Row>
              <Col xs={6}>
                <Field id="auditOpBal" label="OP Bal" type="number" min="0" step="1" name="opBalance" placeholder="0"
                  value={form.opBalance} onChange={handleChange} error={errors.opBalance} required />
              </Col>
              <Col xs={6}>
                <Field id="auditAddition" label="Addition (Purchases)" type="number" min="0" step="1" name="addition"
                  placeholder="0" value={form.addition} onChange={handleChange} error={errors.addition} />
              </Col>
              <Col xs={6}>
                <Field id="auditUtilised" label="Utilised" type="number" min="0" step="1" name="utilised" placeholder="0"
                  value={form.utilised} onChange={handleChange} error={errors.utilised} />
              </Col>
              <Col xs={6}>
                <Field id="auditScrap" label="Scrap" type="number" min="0" step="1" name="scrap" placeholder="0"
                  value={form.scrap} onChange={handleChange} error={errors.scrap} />
              </Col>
            </Row>
            <Field id="auditClosing" label="Closing Stock (auto)" type="text" readOnly disabled value={closingOf(form)} />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
          <Button className="save" onClick={requestSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </Modal.Footer>
      </Modal>

      {/* View details */}
      <Modal show={!!viewing} onHide={() => setViewing(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Audit Record Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewing && (
            <div>
              <p><strong>Audit Date:</strong> {formatDate(viewing.auditDate)}</p>
              <p><strong>Particulars:</strong> {viewing.particulars}</p>
              <p><strong>OP Bal:</strong> {viewing.opBalance}</p>
              <p><strong>Addition (Purchases):</strong> {viewing.addition}</p>
              <p><strong>Utilised:</strong> {viewing.utilised}</p>
              <p><strong>Scrap:</strong> {viewing.scrap}</p>
              <p><strong>Closing Stock:</strong> {viewing.closingStock}</p>
              <p><strong>Created:</strong> {new Date(viewing.createdAt).toLocaleString()}</p>
              <p><strong>Last updated:</strong> {new Date(viewing.updatedAt).toLocaleString()}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setViewing(null)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Container fluid className="flex-grow-1">
        <SummaryCards cards={cards} />

        {/* Date filters */}
        <Card className="mb-3">
          <Card.Body className="audit-filters">
            <Row className="g-2 align-items-end">
              <Col xs={12} sm={6} md={3} lg={2}>
                <Form.Label className="mb-1" htmlFor="auditMode">Report type</Form.Label>
                <Form.Select id="auditMode" value={filter.mode} onChange={(e) => setFilterField("mode", e.target.value)}>
                  <option value="all">All records</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </Form.Select>
              </Col>

              {filter.mode === "monthly" && (
                <Col xs={6} sm={3} md={3} lg={2}>
                  <Form.Label className="mb-1" htmlFor="auditMonth">Month</Form.Label>
                  <Form.Select id="auditMonth" value={filter.month} onChange={(e) => setFilterField("month", Number(e.target.value))}>
                    {MONTH_NAMES.map((name, i) => (
                      <option key={name} value={i + 1}>{name}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              {filter.mode === "quarterly" && (
                <Col xs={6} sm={3} md={3} lg={2}>
                  <Form.Label className="mb-1" htmlFor="auditQuarter">Quarter</Form.Label>
                  <Form.Select id="auditQuarter" value={filter.quarter} onChange={(e) => setFilterField("quarter", Number(e.target.value))}>
                    {QUARTERS.map((q) => (
                      <option key={q.value} value={q.value}>{q.label}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              {filter.mode !== "all" && (
                <Col xs={6} sm={3} md={2} lg={2}>
                  <Form.Label className="mb-1" htmlFor="auditYear">Year</Form.Label>
                  <Form.Select id="auditYear" value={filter.year} onChange={(e) => setFilterField("year", Number(e.target.value))}>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Form.Select>
                </Col>
              )}

              <Col xs="auto">
                <Button variant="outline-secondary" onClick={resetFilters} disabled={!filtersActive}>
                  <LuRotateCcw /> Reset Filters
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Search + actions */}
        <Row className="mb-3 g-2">
          <Col xs={12} md={5} lg={4}>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Search by particulars or date"
                aria-label="Search audit records"
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
            <Button onClick={openAdd} className="button-add-product">
              <BiSolidMessageSquareAdd size={20} /> Add
            </Button>
          </Col>
        </Row>

        <Row>
          <Col xs={12}>
            <Card>
              <Card.Body>
                <Card.Title>Audit Report - {periodLabel}</Card.Title>
                <div className="audit-count">
                  {loading ? "Loading records..." : `${visible.length} record${visible.length === 1 ? "" : "s"} found`}
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
                            className="sortable"
                            aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                            onClick={() => toggleSort(c.key)}
                          >
                            {c.label} <TiArrowUnsorted />
                          </th>
                        ))}
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 && (
                        <tr>
                          <td colSpan={COLUMNS.length + 2} className={loadError ? "text-danger" : ""}>
                            {emptyMessage()}
                            {!loading && !loadError && records.length > 0 && filtersActive && (
                              <>
                                {" "}
                                <Button variant="link" className="p-0 align-baseline" onClick={resetFilters}>
                                  Reset filters
                                </Button>
                              </>
                            )}
                            {loadError && !loading && (
                              <>
                                {" "}
                                <Button variant="link" className="p-0 align-baseline" onClick={fetchRecords}>
                                  Try again
                                </Button>
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                      {pageRows.map((r, index) => (
                        <tr key={r.id}>
                          <td>{(currentPage - 1) * pageSize + index + 1}</td>
                          <td>{formatDate(r.auditDate)}</td>
                          <td className="text-start">{r.particulars}</td>
                          <td>{r.opBalance}</td>
                          <td>{r.addition}</td>
                          <td>{r.utilised}</td>
                          <td>{r.scrap}</td>
                          <td><strong>{r.closingStock}</strong></td>
                          <td>
                            <Button className="button-add-product1" onClick={() => setViewing(r)} aria-label="View record">
                              <FaEye size={20} />
                            </Button>
                            <Button className="button-add-product3" onClick={() => openEdit(r)} aria-label="Edit record">
                              <LuClipboardPen size={20} />
                            </Button>
                            <Button className="button-add-product1" onClick={() => setDeleting(r)} aria-label="Delete record">
                              <FaTrashCan size={20} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
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
                        <Pagination.Item key={p} active={p === currentPage} onClick={() => setPage(p)}>
                          {p}
                        </Pagination.Item>
                      ))}
                      <Pagination.Next onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} />
                      <Pagination.Last onClick={() => setPage(pageCount)} disabled={currentPage === pageCount} />
                    </Pagination>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Permission popups */}
      <ConfirmModal
        show={confirmSave}
        busy={saving}
        title={editingId ? "Save changes?" : "Add audit record?"}
        message={
          editingId
            ? `Do you want to save the changes to "${form.particulars.trim()}"?`
            : `Do you want to add "${form.particulars.trim()}"?`
        }
        confirmLabel={editingId ? "Yes, save" : "Yes, add"}
        busyLabel="Saving..."
        onConfirm={performSave}
        onCancel={() => setConfirmSave(false)}
      />
      <ConfirmModal
        show={!!deleting}
        danger
        busy={working}
        title="Delete audit record?"
        message={`Are you sure you want to delete "${deleting?.particulars ?? ""}"? This cannot be undone.`}
        confirmLabel="Yes, delete"
        busyLabel="Deleting..."
        onConfirm={performDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

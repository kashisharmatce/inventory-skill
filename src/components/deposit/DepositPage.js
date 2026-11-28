"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Container, Form, InputGroup, Modal, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { FaEye } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { LuBanknote, LuClipboardPen, LuHandCoins, LuUndo2, LuUsers } from "react-icons/lu";
import { TiArrowUnsorted } from "react-icons/ti";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import Field from "@/components/ui/Field";
import ConfirmModal from "@/components/ui/ConfirmModal";
import SummaryCards from "@/components/ui/SummaryCards";

const rupees = (v) => `₹${Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const MODE_LABEL = { cash: "Cash", pay: "Pay" };
const EMPTY_FORM = { userId: "", amount: "", mode: "cash", note: "" };

function validate(form, { needStudent }) {
  const errors = {};
  if (needStudent && !form.userId) errors.userId = "Choose a student";
  const amount = Number(form.amount);
  if (form.amount === "" || !Number.isFinite(amount) || amount <= 0) errors.amount = "Enter the amount (more than 0)";
  if (!["cash", "pay"].includes(form.mode)) errors.mode = "Choose Cash or Pay";
  if (form.note.length > 200) errors.note = "Maximum 200 characters";
  return errors;
}

export default function DepositPage() {
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]); // students from Tracking without a deposit yet
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all"); // all | held | refunded

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // the payment being edited, or null when adding
  const [viewing, setViewing] = useState(null); // the deposit shown in the details popup
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  // Permission popup: { type: "save" } | { type: "refund", payment } | { type: "unrefund", payment } | { type: "delete", payment }
  const [confirm, setConfirm] = useState(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([api("/payment"), api("/payment/students")]);
      setPayments(p.data);
      setStudents(s.data);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message || "Error loading the deposits");
      toast.error(error.message || "Error loading the deposits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ---- tiles ----
  const totals = useMemo(() => {
    const held = payments.filter((p) => !p.refunded);
    const refunded = payments.filter((p) => p.refunded);
    const sum = (list) => list.reduce((s, p) => s + p.amount, 0);
    return { all: sum(payments), held: sum(held), heldCount: held.length, refunded: sum(refunded), refundedCount: refunded.length };
  }, [payments]);

  const cards = [
    { key: "collected", Icon: LuBanknote, badge: "Deposits", title: "Total Collected",
      value: loading ? "…" : rupees(totals.all), note: "All deposits received (cash and pay)" },
    { key: "held", Icon: LuHandCoins, badge: "To refund", title: "Held",
      value: loading ? "…" : rupees(totals.held), note: `${totals.heldCount} deposit${totals.heldCount === 1 ? "" : "s"} not paid back yet` },
    { key: "refunded", Icon: LuUndo2, badge: "Done", title: "Refunded",
      value: loading ? "…" : rupees(totals.refunded), note: `${totals.refundedCount} deposit${totals.refundedCount === 1 ? "" : "s"} paid back` },
    { key: "students", Icon: LuUsers, badge: "Students", title: "Students",
      value: loading ? "…" : String(payments.length), note: `${students.length} student${students.length === 1 ? "" : "s"} in Tracking without a deposit` },
  ];

  // ---- search + filter ----
  const visible = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return payments.filter((p) => {
      if (filter === "held" && p.refunded) return false;
      if (filter === "refunded" && !p.refunded) return false;
      if (!term) return true;
      return [p.studentName, p.branch, p.mobile, p.components].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [payments, searchTerm, filter]);

  // ---- add / edit ----
  const selectedStudent = students.find((s) => s.userId === form.userId) || null;
  const details = editing || selectedStudent; // student details shown in the form (from Tracking)

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setShowForm(true);
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({ userId: p.userId || "", amount: String(p.amount), mode: p.mode, note: p.note });
    setErrors({});
    setShowForm(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const requestSave = () => {
    const found = validate(form, { needStudent: !editing });
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    setConfirm({ type: "save" });
  };

  const body = () => ({ amount: Number(form.amount), mode: form.mode, note: form.note.trim() });

  const performSave = async () => {
    if (editing) {
      await api(`/payment/${editing.id}`, { method: "PUT", body: body() });
      toast.success(`Deposit of "${editing.studentName}" updated successfully`);
    } else {
      await api("/payment", { method: "POST", body: { userId: form.userId, ...body() } });
      toast.success(`Deposit of "${selectedStudent?.studentName ?? "student"}" recorded successfully`);
    }
    setShowForm(false);
  };

  const performRefund = async (payment, refunded) => {
    await api(`/payment/${payment.id}`, { method: "PUT", body: { refunded } });
    toast.success(refunded ? `${rupees(payment.amount)} marked as refunded to ${payment.studentName}` : `Refund of ${payment.studentName} undone`);
  };

  const performDelete = async (payment) => {
    await api(`/payment/${payment.id}`, { method: "DELETE" });
    toast.success(`Deposit of "${payment.studentName}" deleted successfully`);
  };

  const handleConfirm = async () => {
    setWorking(true);
    try {
      if (confirm.type === "save") await performSave();
      else if (confirm.type === "refund") await performRefund(confirm.payment, true);
      else if (confirm.type === "unrefund") await performRefund(confirm.payment, false);
      else if (confirm.type === "delete") await performDelete(confirm.payment);
      await load();
    } catch (error) {
      toast.error(error.message || "Something went wrong");
    } finally {
      setConfirm(null);
      setWorking(false);
    }
  };

  const confirmText = () => {
    if (confirm?.type === "refund")
      return { title: "Mark as refunded?", message: `Has ${rupees(confirm.payment.amount)} been paid back to ${confirm.payment.studentName}? It will show as Refunded.`, label: "Yes, refunded", busy: "Saving...", danger: false };
    if (confirm?.type === "unrefund")
      return { title: "Undo the refund?", message: `Show the deposit of ${confirm.payment.studentName} (${rupees(confirm.payment.amount)}) as not refunded again?`, label: "Yes, undo", busy: "Saving...", danger: false };
    if (confirm?.type === "delete")
      return { title: "Delete this deposit?", message: `Delete the deposit record of "${confirm.payment.studentName}" (${rupees(confirm.payment.amount)})? This cannot be undone.`, label: "Yes, delete", busy: "Deleting...", danger: true };
    return editing
      ? { title: "Save changes?", message: `Save the changes to the deposit of "${editing.studentName}"?`, label: "Yes, save", busy: "Saving...", danger: false }
      : { title: "Record deposit?", message: `Record a deposit of ${rupees(form.amount)} (${MODE_LABEL[form.mode]}) for "${selectedStudent?.studentName ?? ""}"?`, label: "Yes, record", busy: "Saving...", danger: false };
  };
  const ct = confirmText();

  return (
    <>
      {/* Add / edit a deposit */}
      <Modal show={showForm} onHide={() => !working && setShowForm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? "Update Deposit" : "Add Deposit"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form noValidate onSubmit={(e) => e.preventDefault()}>
            {editing ? (
              <Field id="payStudentName" label="Student" type="text" readOnly disabled value={editing.studentName} />
            ) : (
              <Field id="payStudent" label="Student (from Tracking)" error={errors.userId}>
                <Form.Select name="userId" value={form.userId} onChange={handleChange} isInvalid={!!errors.userId}>
                  <option value="">{students.length ? "Select a student" : "No student without a deposit"}</option>
                  {students.map((s) => (
                    <option key={s.userId} value={s.userId}>{s.studentName}{s.branch ? ` - ${s.branch}` : ""}</option>
                  ))}
                </Form.Select>
              </Field>
            )}

            {details && (
              <div className="pay-details">
                <div><span>Branch</span><strong>{details.branch || "-"}</strong></div>
                <div><span>Mobile</span><strong>{details.mobile || "-"}</strong></div>
                <div><span>Issued date</span><strong>{details.issuedOn ? formatDate(details.issuedOn) : "-"}</strong></div>
                <div className="pay-details__wide"><span>Component</span><strong>{details.components || "-"}</strong></div>
                {!editing && selectedStudent && selectedStudent.componentValue > 0 && (
                  <div className="pay-details__wide"><span>Value at inventory price</span><strong>{rupees(selectedStudent.componentValue)}</strong></div>
                )}
              </div>
            )}

            <Field id="payAmount" label="Amount" type="number" min="0" step="0.01" name="amount" placeholder="Enter the amount received"
              value={form.amount} onChange={handleChange} error={errors.amount} />
            <Form.Group className="mb-3">
              <Form.Label className="d-block">Paid by</Form.Label>
              <Form.Check inline type="radio" id="payModeCash" name="mode" value="cash" label="Cash" checked={form.mode === "cash"} onChange={handleChange} />
              <Form.Check inline type="radio" id="payModePay" name="mode" value="pay" label="Pay (online)" checked={form.mode === "pay"} onChange={handleChange} />
            </Form.Group>
            <Field id="payNote" label="Note (optional)" type="text" name="note" maxLength={200} placeholder="Anything to remember" value={form.note} onChange={handleChange} error={errors.note} />
            <Form.Text muted className="d-block">The refund is ticked later, in the table, when the deposit is paid back.</Form.Text>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setShowForm(false)} disabled={working}>Cancel</Button>
          <Button className="save" onClick={requestSave} disabled={working}>Save</Button>
        </Modal.Footer>
      </Modal>

      {/* View a deposit (read-only) */}
      <Modal show={!!viewing} onHide={() => setViewing(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Deposit Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewing && (
            <div>
              <p><strong>Student:</strong> {viewing.studentName}{viewing.studentDeleted ? " (removed from Tracking)" : ""}</p>
              <p><strong>Branch:</strong> {viewing.branch || "-"}</p>
              <p><strong>Mobile No:</strong> {viewing.mobile || "-"}</p>
              <p><strong>Issued date:</strong> {viewing.issuedOn ? formatDate(viewing.issuedOn) : "-"}</p>
              <p><strong>Component:</strong> {viewing.components || "-"}</p>
              <p><strong>Amount:</strong> {rupees(viewing.amount)}</p>
              <p><strong>Paid by:</strong> {viewing.mode === "pay" ? "Pay (online)" : "Cash"}</p>
              <p>
                <strong>Refund:</strong>{" "}
                {viewing.refunded ? (
                  <span className="pay-badge pay-badge--done">Refunded{viewing.refundedOn ? ` on ${formatDate(viewing.refundedOn)}` : ""}</span>
                ) : (
                  <span className="pay-badge pay-badge--held">Held - not refunded yet</span>
                )}
              </p>
              <p><strong>Note:</strong> {viewing.note || "-"}</p>
              <p><strong>Recorded on:</strong> {new Date(viewing.createdAt).toLocaleString()}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setViewing(null)}>Close</Button>
        </Modal.Footer>
      </Modal>

      <Container fluid className="flex-grow-1">
        <SummaryCards cards={cards} />

        <Row className="mb-3 g-2">
          <Col xs={12} md={5} lg={4}>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Search name, branch, mobile, component"
                aria-label="Search deposits"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <InputGroup.Text>
                <CiSearch />
              </InputGroup.Text>
            </InputGroup>
          </Col>
          <Col xs={8} md={4} lg={3}>
            <Form.Select aria-label="Filter by refund" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All deposits</option>
              <option value="held">Held (not refunded)</option>
              <option value="refunded">Refunded</option>
            </Form.Select>
          </Col>
          <Col xs={4} md={3} lg={5} className="d-flex justify-content-end">
            <Button onClick={openAdd} className="button-add-product">
              <BiSolidMessageSquareAdd size={20} /> Add
            </Button>
          </Col>
        </Row>

        <Row>
          <Col xs={12}>
            <Card>
              <Card.Body>
                <Card.Title>Deposits</Card.Title>
                <div className="audit-count">{loading ? "Loading..." : `${visible.length} deposit${visible.length === 1 ? "" : "s"}`}</div>
                <div className="table table-scroll">
                  <table className="table table-striped table-bordered table-hover admin-table pay-table">
                    <thead>
                      <tr>
                        <th>Sl.No</th>
                        <th>Issued date <TiArrowUnsorted /></th>
                        <th className="cell-start">Name <TiArrowUnsorted /></th>
                        <th>Branch</th>
                        <th>Mobile No</th>
                        <th className="cell-start">Component</th>
                        <th>Amount</th>
                        <th>Paid by</th>
                        <th>Refund</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.length === 0 && (
                        <tr>
                          <td colSpan={10} className={loadError ? "text-danger" : ""}>
                            {loading
                              ? "Loading..."
                              : loadError
                                ? loadError
                                : payments.length === 0
                                  ? "No deposits yet. Click Add to record the first one."
                                  : "No deposits match your search"}
                          </td>
                        </tr>
                      )}
                      {visible.map((p, i) => (
                        <tr key={p.id} className={p.refunded ? "pay-row--refunded" : ""}>
                          <td>{i + 1}</td>
                          <td>{p.issuedOn ? formatDate(p.issuedOn) : "-"}</td>
                          <td className="cell-start">
                            {p.studentName}
                            {p.studentDeleted && <small className="d-block text-muted">student removed from Tracking</small>}
                          </td>
                          <td>{p.branch || "-"}</td>
                          <td>{p.mobile || "-"}</td>
                          <td className="cell-start">{p.components || "-"}</td>
                          <td><strong>{rupees(p.amount)}</strong></td>
                          <td>{MODE_LABEL[p.mode]}</td>
                          <td>
                            <label className="pay-refund">
                              <input
                                type="checkbox"
                                checked={p.refunded}
                                onChange={() => setConfirm({ type: p.refunded ? "unrefund" : "refund", payment: p })}
                                aria-label={p.refunded ? `Undo refund for ${p.studentName}` : `Mark ${p.studentName} as refunded`}
                              />
                              {p.refunded ? (
                                <span className="pay-badge pay-badge--done">Refunded{p.refundedOn ? ` ${formatDate(p.refundedOn)}` : ""}</span>
                              ) : (
                                <span className="pay-badge pay-badge--held">Held</span>
                              )}
                            </label>
                          </td>
                          <td>
                            <Button className="button-add-product1" onClick={() => setViewing(p)} aria-label="View deposit">
                              <FaEye size={20} />
                            </Button>
                            <Button className="button-add-product3" onClick={() => openEdit(p)} aria-label="Edit deposit">
                              <LuClipboardPen size={20} />
                            </Button>
                            <Button className="button-add-product1" onClick={() => setConfirm({ type: "delete", payment: p })} aria-label="Delete deposit">
                              <FaTrashCan size={20} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="audit-note audit-note--footer">
                  Name, branch, mobile, component and issue date come from the Tracking page. The amount, Cash / Pay and the refund tick are entered here.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <ConfirmModal
        show={!!confirm}
        danger={ct.danger}
        busy={working}
        title={ct.title}
        message={ct.message}
        confirmLabel={ct.label}
        busyLabel={ct.busy}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

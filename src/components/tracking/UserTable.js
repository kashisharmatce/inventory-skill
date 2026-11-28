"use client";

import { useState } from "react";
import { Button, Col, Form, Modal, Row, Table } from "react-bootstrap";
import { toast } from "react-toastify";
import { FaEye } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { LuUndo2 } from "react-icons/lu";
import { MdOutlineAddReaction } from "react-icons/md";
import { PiList } from "react-icons/pi";
import { TiArrowUnsorted } from "react-icons/ti";
import { api } from "@/lib/api";
import { formatDate, toDateInput } from "@/lib/format";
import Field from "@/components/ui/Field";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ComponentSelect from "./ComponentSelect";

const statusClass = (status) =>
  ({
    active: "status-active",
    inactive: "status-inactive",
    pending: "status-pending",
    returned: "status-returned",
  })[status] || "";

/** "2 good, 1 damaged" for a component, or "-" when nothing came back yet. */
const returnedText = (c) => {
  const parts = [];
  if (c.returnedGood > 0) parts.push(`${c.returnedGood} good`);
  if (c.returnedDamaged > 0) parts.push(`${c.returnedDamaged} damaged`);
  return parts.length ? parts.join(", ") : "-";
};

export default function UserTable({ users = [], products = [], loading, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  // Return popup: { user, rows: [{ componentId, name, outstanding, quantity, condition }] }
  const [returning, setReturning] = useState(null);
  // Permission popup: { type: "edit" } | { type: "delete", user } | { type: "return" }
  const [confirm, setConfirm] = useState(null);
  const [working, setWorking] = useState(false);

  // ---------- edit ----------
  const handleEdit = (user) =>
    setEditing({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      branch: user.branch,
      status: user.status,
      origStatus: user.status,
      components: user.components.map((c) => ({
        id: c.id,
        productId: c.productId,
        origProductId: c.productId,
        productName: c.productName,
        origProductName: c.productName,
        origQuantity: c.quantity,
        quantity: c.quantity,
        returned: c.returnedGood + c.returnedDamaged,
        returnedGood: c.returnedGood,
        returnedDamaged: c.returnedDamaged,
        issueAt: toDateInput(c.issueAt),
        returnDate: toDateInput(c.returnDate),
      })),
    });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditing((prev) => ({ ...prev, [name]: value }));
  };

  const handleComponentChange = (index, field, value) =>
    setEditing((prev) => ({
      ...prev,
      components: prev.components.map((c, i) => (i === index ? { ...c, [field]: value } : c)),
    }));

  // every component can be chosen; what is available for the current one includes the quantity this line already holds
  const editableProducts = (comp) =>
    products.map((p) => ({
      ...p,
      // what this line could take from the component (a good return that already came back is carried over, so it counts too)
      available: (Number(p.quantity) || 0) + (p.id === comp.origProductId ? comp.origQuantity - comp.returnedGood : comp.returnedGood),
      low: false,
    }));

  const changeComponent = (index, product) =>
    setEditing((prev) => ({
      ...prev,
      components: prev.components.map((c, i) =>
        i !== index
          ? c
          : product
            ? { ...c, productId: product.id, productName: product.productName }
            : { ...c, productId: c.origProductId, productName: c.origProductName }
      ),
    }));

  const performSave = async () => {
    setSaving(true);
    try {
      const { id, origStatus, components, ...rest } = editing;
      const body = {
        ...rest,
        components: components.map((c) => ({ id: c.id, productId: c.productId, quantity: c.quantity, issueAt: c.issueAt, returnDate: c.returnDate })),
      };
      await api(`/user/${id}`, { method: "PUT", body });
      toast.success(`"${editing.name}" updated successfully`);
      setEditing(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- delete ----------
  const performDelete = async (user) => {
    setWorking(true);
    try {
      await api(`/user/${user.id}`, { method: "DELETE" });
      toast.success(`"${user.name}" deleted successfully`);
      setConfirm(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Could not delete the user");
      setConfirm(null);
    } finally {
      setWorking(false);
    }
  };

  // ---------- return ----------
  const openReturn = (user) =>
    setReturning({
      user,
      rows: user.components.map((c) => ({
        componentId: c.id,
        name: c.productName,
        quantity: c.quantity,
        returned: c.returnedGood + c.returnedDamaged,
        outstanding: c.outstanding,
        returnQty: String(c.outstanding), // by default the whole outstanding quantity comes back
        condition: "good",
      })),
    });

  const setReturnRow = (index, patch) =>
    setReturning((prev) => ({ ...prev, rows: prev.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)) }));

  // what the user typed, as a clean list of items to send (rows with 0 are skipped)
  const returnItems = () =>
    (returning?.rows || [])
      .filter((r) => r.outstanding > 0 && Number(r.returnQty) > 0)
      .map((r) => ({ componentId: r.componentId, quantity: Number(r.returnQty), condition: r.condition, name: r.name }));

  const returnProblem = () => {
    for (const r of returning.rows) {
      if (r.outstanding <= 0) continue;
      const q = r.returnQty === "" ? 0 : Number(r.returnQty);
      if (!Number.isInteger(q) || q < 0) return `Enter a whole number for "${r.name}"`;
      if (q > r.outstanding) return `Only ${r.outstanding} of "${r.name}" can still be returned`;
    }
    if (returnItems().length === 0) return "Enter the quantity that is being returned";
    return "";
  };

  const requestReturn = () => {
    const problem = returnProblem();
    if (problem) {
      toast.error(problem);
      return;
    }
    setConfirm({ type: "return" });
  };

  const performReturn = async () => {
    setWorking(true);
    try {
      const items = returnItems();
      await api(`/user/${returning.user.id}/return`, {
        method: "POST",
        body: { items: items.map(({ componentId, quantity, condition }) => ({ componentId, quantity, condition })) },
      });
      const good = items.filter((i) => i.condition === "good").reduce((s, i) => s + i.quantity, 0);
      const bad = items.filter((i) => i.condition === "damaged").reduce((s, i) => s + i.quantity, 0);
      if (good > 0) toast.success(`${good} component${good === 1 ? "" : "s"} added back to the inventory`);
      if (bad > 0) toast.info(`${bad} damaged component${bad === 1 ? "" : "s"} recorded as scrap`);
      setConfirm(null);
      setReturning(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Could not process the return");
      setConfirm(null);
    } finally {
      setWorking(false);
    }
  };

  const handleConfirm = async () => {
    if (confirm?.type === "delete") return performDelete(confirm.user);
    if (confirm?.type === "return") return performReturn();
    if (confirm?.type === "edit") {
      setWorking(true);
      try {
        await performSave();
      } finally {
        setWorking(false);
        setConfirm(null);
      }
    }
  };

  const confirmText = () => {
    if (confirm?.type === "delete")
      return {
        title: "Delete user?",
        message: `Are you sure you want to delete "${confirm.user.name}"? Their return history stays in the Audit Report. This cannot be undone.`,
        label: "Yes, delete",
        busy: "Deleting...",
        danger: true,
      };
    if (confirm?.type === "return") {
      const items = returnItems();
      const good = items.filter((i) => i.condition === "good").reduce((s, i) => s + i.quantity, 0);
      const bad = items.filter((i) => i.condition === "damaged").reduce((s, i) => s + i.quantity, 0);
      const parts = [];
      if (good > 0) parts.push(`${good} in good condition (added back to the inventory)`);
      if (bad > 0) parts.push(`${bad} damaged (not added back - recorded as scrap)`);
      return {
        title: "Process return?",
        message: `${returning?.user.name} is returning ${parts.join(" and ")}. This cannot be undone.`,
        label: "Yes, return",
        busy: "Processing...",
        danger: false,
      };
    }
    return {
      title: "Save changes?",
      message: `Do you want to save the changes to "${editing?.name ?? ""}"?`,
      label: "Yes, save",
      busy: "Saving...",
      danger: false,
    };
  };
  const ct = confirmText();

  const COLS = 11;

  return (
    <>
      <Table striped bordered hover className="admin-table">
        <thead>
          <tr>
            <th><PiList size={20} /></th>
            <th>Name <TiArrowUnsorted /></th>
            <th>Email <TiArrowUnsorted /></th>
            <th>Mobile <TiArrowUnsorted /></th>
            <th>Branch <TiArrowUnsorted /></th>
            <th>Component Name <TiArrowUnsorted /></th>
            <th>Quantity <TiArrowUnsorted /></th>
            <th>Returned</th>
            <th>Issued At <TiArrowUnsorted /></th>
            <th>Status <TiArrowUnsorted /></th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={COLS}>Loading...</td></tr>
          )}
          {!loading && users.length === 0 && (
            <tr><td colSpan={COLS}>No users found</td></tr>
          )}
          {users.map((user, index) => (
            <tr key={user.id}>
              <td>{index + 1}</td>
              <td>{user.name}</td>
              <td>{user.email || "-"}</td>
              <td>{user.mobile}</td>
              <td>{user.branch || "-"}</td>
              <td>{user.components.map((c) => <div key={c.id}>{c.productName || "N/A"}</div>)}</td>
              <td>{user.components.map((c) => <div key={c.id}>{c.quantity || "N/A"}</div>)}</td>
              <td>{user.components.map((c) => <div key={c.id}>{returnedText(c)}</div>)}</td>
              <td>{user.components.map((c) => <div key={c.id}>{formatDate(c.issueAt) || "N/A"}</div>)}</td>
              <td className={statusClass(user.status)}>{user.status}</td>
              <td>
                <Button className="button-add-product1" onClick={() => setViewing(user)} aria-label="View user">
                  <FaEye size={20} />
                </Button>
                {user.outstanding > 0 && (
                  <Button className="button-return" onClick={() => openReturn(user)} aria-label="Return components" title="Return components">
                    <LuUndo2 size={20} />
                  </Button>
                )}
                <Button className="button-add-product" onClick={() => handleEdit(user)} aria-label="Edit user">
                  <MdOutlineAddReaction size={20} />
                </Button>
                <Button className="button-add-product1" onClick={() => setConfirm({ type: "delete", user })} aria-label="Delete user">
                  <FaTrashCan size={20} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Return modal */}
      <Modal show={!!returning} onHide={() => !working && setReturning(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Return Components{returning ? ` - ${returning.user.name}` : ""}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {returning && (
            <>
              <p className="return-help">
                Choose how many are coming back and their condition. <strong>Good</strong> condition goes back into the inventory.
                {" "}<strong>Damaged</strong> does not: it is recorded as scrap in the Audit Report.
              </p>
              {returning.rows.map((r, i) => (
                <Row key={r.componentId} className={`return-row${r.outstanding <= 0 ? " is-done" : ""}`}>
                  <Col xs={12} md={5} className="return-row__name">
                    <strong>{r.name}</strong>
                    <small>
                      Issued {r.quantity}
                      {r.returned > 0 ? `, returned ${r.returned}` : ""}
                      {r.outstanding > 0 ? ` - ${r.outstanding} still with the student` : " - fully returned"}
                    </small>
                  </Col>
                  {r.outstanding > 0 ? (
                    <>
                      <Col xs={5} md={3}>
                        <Form.Label htmlFor={`ret-qty-${i}`} className="mb-1">Returning</Form.Label>
                        <Form.Control
                          id={`ret-qty-${i}`}
                          type="number"
                          min="0"
                          max={r.outstanding}
                          value={r.returnQty}
                          isInvalid={Number(r.returnQty) > r.outstanding}
                          onChange={(e) => setReturnRow(i, { returnQty: e.target.value })}
                        />
                      </Col>
                      <Col xs={7} md={4}>
                        <Form.Label htmlFor={`ret-cond-${i}`} className="mb-1">Condition</Form.Label>
                        <Form.Select id={`ret-cond-${i}`} value={r.condition} onChange={(e) => setReturnRow(i, { condition: e.target.value })}>
                          <option value="good">Good condition</option>
                          <option value="damaged">Damaged / Spoiled</option>
                        </Form.Select>
                      </Col>
                    </>
                  ) : (
                    <Col xs={12} md={7} className="return-row__done">Nothing left to return</Col>
                  )}
                </Row>
              ))}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setReturning(null)} disabled={working}>Cancel</Button>
          <Button className="save" onClick={requestReturn} disabled={working}>Return</Button>
        </Modal.Footer>
      </Modal>

      {/* Edit modal */}
      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Update User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={(e) => e.preventDefault()}>
            <Field id="editName" label="Name" type="text" name="name" value={editing?.name ?? ""} onChange={handleChange} />
            <Field id="editEmail" label="Email (optional)" type="text" name="email" placeholder="No email" value={editing?.email ?? ""} onChange={handleChange} />
            <Field id="editMobile" label="Mobile" type="text" name="mobile" value={editing?.mobile ?? ""} onChange={handleChange} />
            <Field id="editBranch" label="Branch" type="text" name="branch" value={editing?.branch ?? ""} onChange={handleChange} />

            {editing?.components.map((comp, idx) => (
              <div key={comp.id}>
                <Form.Group className="mb-2">
                  <Form.Label htmlFor={`editComponent-${idx}`}>Component Name</Form.Label>
                  <ComponentSelect
                    id={`editComponent-${idx}`}
                    products={editableProducts(comp)}
                    value={comp.productId}
                    onSelect={(p) => changeComponent(idx, p)}
                  />
                  {comp.productId !== comp.origProductId && (
                    <Form.Text className="d-block text-warning-emphasis">
                      On save, {comp.origProductName} goes back into the inventory with its previous count and {comp.productName} takes this line.
                      {comp.returned > 0
                        ? ` What was already returned (${comp.returnedGood} good, ${comp.returnedDamaged} damaged) carries over to ${comp.productName}.`
                        : ""}
                      {" "}The Audit Report keeps its earlier entries and adds the correction.
                    </Form.Text>
                  )}
                </Form.Group>
                <Field id={`editQuantity-${idx}`} label="Quantity" type="number" min={Math.max(1, comp.returned)}
                  value={comp.quantity ?? ""} onChange={(e) => handleComponentChange(idx, "quantity", e.target.value)} />
                {comp.returned > 0 && <Form.Text muted>{comp.returned} already returned, so the quantity cannot be lower than that.</Form.Text>}
                <Field id={`editIssueAt-${idx}`} label="Issue Date" type="date"
                  value={comp.issueAt ?? ""} onChange={(e) => handleComponentChange(idx, "issueAt", e.target.value)} />
                <Field id={`editReturnDate-${idx}`} label="Return Date" type="date"
                  value={comp.returnDate ?? ""} onChange={(e) => handleComponentChange(idx, "returnDate", e.target.value)} />
              </div>
            ))}

            <Form.Group controlId="editStatus">
              <Form.Label>Status</Form.Label>
              <Form.Control as="select" name="status" value={editing?.status ?? ""} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                {editing?.origStatus === "returned" && <option value="returned">Returned</option>}
              </Form.Control>
              <Form.Text muted>
                To mark components as returned, close this form and use the Return button - it asks for the condition of each component.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setEditing(null)}>Cancel</Button>
          <Button className="save" onClick={() => setConfirm({ type: "edit" })} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View modal */}
      <Modal show={!!viewing} onHide={() => setViewing(null)}>
        <Modal.Header closeButton>
          <Modal.Title>User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewing && (
            <div>
              <p><strong>Name:</strong> {viewing.name}</p>
              <p><strong>Email:</strong> {viewing.email || "-"}</p>
              <p><strong>Mobile:</strong> {viewing.mobile}</p>
              <p><strong>Branch:</strong> {viewing.branch || "-"}</p>
              {viewing.components.map((c) => (
                <div key={c.id}>
                  <p><strong>Component Name:</strong> {c.productName || "N/A"}</p>
                  <p><strong>Quantity issued:</strong> {c.quantity || "N/A"}</p>
                  <p><strong>Returned in good condition:</strong> {c.returnedGood}</p>
                  <p><strong>Returned damaged (scrap):</strong> {c.returnedDamaged}</p>
                  <p><strong>Still with the student:</strong> {c.outstanding}</p>
                  <p><strong>Issued Date:</strong> {formatDate(c.issueAt) || "N/A"}</p>
                  <p><strong>Return Date:</strong> {formatDate(c.returnDate) || "N/A"}</p>
                </div>
              ))}
              <p><strong>Status:</strong> {viewing.status}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setViewing(null)}>Close</Button>
        </Modal.Footer>
      </Modal>

      {/* Permission popup for delete / edit / return */}
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

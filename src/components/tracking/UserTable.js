"use client";

import { useState } from "react";
import { Button, Form, Modal, Table } from "react-bootstrap";
import { toast } from "react-toastify";
import { FaEye } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { MdOutlineAddReaction } from "react-icons/md";
import { PiList } from "react-icons/pi";
import { TiArrowUnsorted } from "react-icons/ti";
import { api } from "@/lib/api";
import { formatDate, toDateInput } from "@/lib/format";
import Field from "@/components/ui/Field";
import ConfirmModal from "@/components/ui/ConfirmModal";

const statusClass = (status) =>
  ({
    active: "status-active",
    inactive: "status-inactive",
    pending: "status-pending",
    returned: "status-returned",
  })[status] || "";

export default function UserTable({ users = [], loading, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  // Permission popup: { type: "edit" } or { type: "delete", user }
  const [confirm, setConfirm] = useState(null);
  const [working, setWorking] = useState(false);

  const handleEdit = (user) =>
    setEditing({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      USN: user.USN,
      status: user.status,
      components: user.components.map((c) => ({
        productId: c.productId,
        productName: c.productName,
        quantity: c.quantity,
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

  const performSave = async () => {
    setSaving(true);
    try {
      const { id, ...body } = editing;
      const before = users.find((u) => u.id === id)?.status;
      await api(`/user/${id}`, { method: "PUT", body });
      toast.success(`"${editing.name}" updated successfully`);
      // stock follows the status: Returned puts the items back, leaving Returned takes them out again
      if (body.status === "returned" && before !== "returned") toast.info("Components returned to the inventory");
      else if (before === "returned" && body.status !== "returned") toast.info("Components taken out of the inventory again");
      setEditing(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (user) => {
    setWorking(true);
    try {
      await api(`/user/${user.id}`, { method: "DELETE" });
      toast.success(`"${user.name}" deleted successfully`);
      setConfirm(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Could not delete the user");
    } finally {
      setWorking(false);
    }
  };

  const handleConfirm = async () => {
    if (confirm?.type === "delete") return performDelete(confirm.user);
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

  return (
    <>
      <Table striped bordered hover className="admin-table">
        <thead>
          <tr>
            <th><PiList size={20} /></th>
            <th>Name <TiArrowUnsorted /></th>
            <th>Email <TiArrowUnsorted /></th>
            <th>Mobile <TiArrowUnsorted /></th>
            <th>USN <TiArrowUnsorted /></th>
            <th>Component Name <TiArrowUnsorted /></th>
            <th>Quantity <TiArrowUnsorted /></th>
            <th>Issued At <TiArrowUnsorted /></th>
            <th>Status <TiArrowUnsorted /></th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={10}>Loading...</td></tr>
          )}
          {!loading && users.length === 0 && (
            <tr><td colSpan={10}>No users found</td></tr>
          )}
          {users.map((user, index) => (
            <tr key={user.id}>
              <td>{index + 1}</td>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.mobile}</td>
              <td>{user.USN}</td>
              <td>{user.components.map((c) => <div key={c.id}>{c.productName || "N/A"}</div>)}</td>
              <td>{user.components.map((c) => <div key={c.id}>{c.quantity || "N/A"}</div>)}</td>
              <td>{user.components.map((c) => <div key={c.id}>{formatDate(c.issueAt) || "N/A"}</div>)}</td>
              <td className={statusClass(user.status)}>{user.status}</td>
              <td>
                <Button className="button-add-product1" onClick={() => setViewing(user)} aria-label="View user">
                  <FaEye size={20} />
                </Button>
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

      {/* Edit modal */}
      <Modal show={!!editing} onHide={() => setEditing(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Update User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Field id="editName" label="Name" type="text" name="name" value={editing?.name ?? ""} onChange={handleChange} />
            <Field id="editEmail" label="Email" type="email" name="email" value={editing?.email ?? ""} onChange={handleChange} />
            <Field id="editMobile" label="Mobile" type="text" name="mobile" value={editing?.mobile ?? ""} onChange={handleChange} />
            <Field id="editUSN" label="USN" type="text" name="USN" value={editing?.USN ?? ""} onChange={handleChange} />

            {editing?.components.map((comp, idx) => (
              <div key={idx}>
                <Field id={`editProductName-${idx}`} label="Component Name" type="text"
                  value={comp.productName ?? ""} onChange={(e) => handleComponentChange(idx, "productName", e.target.value)} />
                <Field id={`editQuantity-${idx}`} label="Quantity" type="number" min="1"
                  value={comp.quantity ?? ""} onChange={(e) => handleComponentChange(idx, "quantity", e.target.value)} />
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
                <option value="returned">Returned</option>
              </Form.Control>
              <Form.Text muted>Choosing Returned puts the issued components back into the inventory.</Form.Text>
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
              <p><strong>Email:</strong> {viewing.email}</p>
              <p><strong>Mobile:</strong> {viewing.mobile}</p>
              <p><strong>USN:</strong> {viewing.USN}</p>
              {viewing.components.map((c) => (
                <div key={c.id}>
                  <p><strong>Component Name:</strong> {c.productName || "N/A"}</p>
                  <p><strong>Quantity:</strong> {c.quantity || "N/A"}</p>
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

      {/* Permission popup for delete / edit */}
      <ConfirmModal
        show={!!confirm}
        danger={confirm?.type === "delete"}
        busy={working}
        title={confirm?.type === "delete" ? "Delete user?" : "Save changes?"}
        message={
          confirm?.type === "delete"
            ? `Are you sure you want to delete "${confirm.user.name}" and their issued components? This cannot be undone.`
            : `Do you want to save the changes to "${editing?.name ?? ""}"?`
        }
        confirmLabel={confirm?.type === "delete" ? "Yes, delete" : "Yes, save"}
        busyLabel={confirm?.type === "delete" ? "Deleting..." : "Saving..."}
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

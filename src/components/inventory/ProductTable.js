"use client";

import { useState } from "react";
import { Button, Form, Modal, Table } from "react-bootstrap";
import { toast } from "react-toastify";
import { FaEye } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { LuClipboardPen } from "react-icons/lu";
import { PiList } from "react-icons/pi";
import { TiArrowUnsorted } from "react-icons/ti";
import { api, uploadProductFiles } from "@/lib/api";
import { formatDate, toDateInput } from "@/lib/format";
import { isLowStock, stockStatus } from "@/lib/stock";
import Field from "@/components/ui/Field";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AttachmentPicker from "@/components/ui/AttachmentPicker";
import AttachmentList from "./AttachmentList";

// "" = Auto (worked out from quantity and minimum stock level)
const STATUS_OPTIONS = [
  { value: "", label: "Auto (based on stock level)" },
  { value: "in-stock", label: "In-Stock" },
  { value: "low-stock", label: "Low-Stock" },
];

export default function ProductTable({ products, loading, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);
  // Attachments in the edit form: files chosen to upload, how many already exist, list refresh counter
  const [newFiles, setNewFiles] = useState([]);
  const [existingCount, setExistingCount] = useState(0);
  const [filesVersion, setFilesVersion] = useState(0);
  // Permission popup: { type: "edit" } | { type: "delete", product } | { type: "deleteFile", file }
  const [confirm, setConfirm] = useState(null);
  const [working, setWorking] = useState(false);

  const openEdit = (product) => {
    setEditing({ ...product, status: product.status ?? "", origStatus: product.status ?? "", origQuantity: product.quantity });
    setNewFiles([]);
    setExistingCount(0);
  };

  const closeEdit = () => {
    setEditing(null);
    setNewFiles([]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditing((prev) => ({ ...prev, [name]: value }));
  };

  const performSave = async () => {
    setSaving(true);
    try {
      const body = {
        productName: editing.productName,
        description: editing.description ?? "",
        quantity: editing.quantity,
        price: editing.price,
        purchaseDate: toDateInput(editing.purchaseDate),
        minimumStockLevel: editing.minimumStockLevel ?? "",
        warrantyCheck: editing.warrantyCheck ?? "",
      };
      // only sent when changed, so saving other details never touches the status
      if ((editing.status || "") !== (editing.origStatus || "")) body.status = editing.status || null;

      await api(`/storage/${editing.id}`, { method: "PUT", body });
      toast.success(`"${editing.productName}" updated successfully`);

      if (newFiles.length > 0) {
        const failed = await uploadProductFiles(editing.id, newFiles);
        if (failed.length === 0) {
          toast.success(`${newFiles.length} attachment${newFiles.length === 1 ? "" : "s"} uploaded`);
        } else {
          failed.forEach((f) => toast.error(`Could not upload "${f.name}": ${f.message}`));
        }
      }
      closeEdit();
      await onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const performDelete = async (product) => {
    setWorking(true);
    try {
      await api(`/storage/${product.id}`, { method: "DELETE" });
      toast.success(`"${product.productName}" deleted successfully`);
      setConfirm(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Could not delete the product");
    } finally {
      setWorking(false);
    }
  };

  const performDeleteFile = async (file) => {
    setWorking(true);
    try {
      await api(`/storage/${file.productId}/files/${file.id}`, { method: "DELETE" });
      toast.success(`"${file.fileName}" removed`);
      setConfirm(null);
      setFilesVersion((v) => v + 1);
    } catch (error) {
      toast.error(error.message || "Could not delete the file");
    } finally {
      setWorking(false);
    }
  };

  const handleConfirm = async () => {
    if (confirm?.type === "delete") return performDelete(confirm.product);
    if (confirm?.type === "deleteFile") return performDeleteFile(confirm.file);
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
        title: "Delete product?",
        message: `Are you sure you want to delete "${confirm.product.productName}"? Its attachments will be deleted too. This cannot be undone.`,
        label: "Yes, delete",
        busy: "Deleting...",
        danger: true,
      };
    if (confirm?.type === "deleteFile")
      return {
        title: "Delete attachment?",
        message: `Are you sure you want to delete "${confirm.file.fileName}"? This cannot be undone.`,
        label: "Yes, delete",
        busy: "Deleting...",
        danger: true,
      };
    return {
      title: "Save changes?",
      message: `Do you want to save the changes to "${editing?.productName ?? ""}"?`,
      label: "Yes, save",
      busy: "Saving...",
      danger: false,
    };
  };
  const ct = confirmText();

  return (
    <>
      <Table striped bordered hover className="admin-table">
        <thead>
          <tr>
            <th><PiList size={20} /></th>
            <th className="cell-start">Name <TiArrowUnsorted /></th>
            <th>Description <TiArrowUnsorted /></th>
            <th>Purchase Date <TiArrowUnsorted /></th>
            <th>Stock <TiArrowUnsorted /></th>
            <th>Price <TiArrowUnsorted /></th>
            <th>Status <TiArrowUnsorted /></th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={8}>Loading...</td></tr>
          )}
          {!loading && products.length === 0 && (
            <tr><td colSpan={8}>No products found</td></tr>
          )}
          {products.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td className="cell-start">{product.productName}</td>
              <td>{product.description}</td>
              <td>{formatDate(product.purchaseDate)}</td>
              <td>{product.quantity}</td>
              <td>{product.price}</td>
              <td style={{ color: isLowStock(product) ? "red" : "green", fontWeight: "bold" }}>
                {stockStatus(product)}
              </td>
              <td>
                <Button className="button-add-product1" onClick={() => setViewing(product)} aria-label="View product">
                  <FaEye size={20} />
                </Button>
                <Button className="button-add-product3" onClick={() => openEdit(product)} aria-label="Edit product">
                  <LuClipboardPen size={20} />
                </Button>
                <Button className="button-add-product1" onClick={() => setConfirm({ type: "delete", product })} aria-label="Delete product">
                  <FaTrashCan size={20} />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Edit modal */}
      <Modal show={!!editing} onHide={() => !saving && closeEdit()}>
        <Modal.Header closeButton>
          <Modal.Title>Update Inventory Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={(e) => e.preventDefault()}>
            <Field id="editProductName" className="mb-3" label="Product Name" type="text" name="productName"
              value={editing?.productName ?? ""} onChange={handleChange} />
            <Field id="editDescription" className="mb-3" label="Description" type="text" name="description"
              value={editing?.description ?? ""} onChange={handleChange} />
            <Field id="editQuantity" className="mb-3" label="Quantity" type="number" min="0" name="quantity"
              value={editing?.quantity ?? ""} onChange={handleChange} />
            {(() => {
              const diff = Number(editing?.quantity) - Number(editing?.origQuantity);
              if (!editing || !Number.isFinite(diff) || diff === 0) return null;
              return (
                <Form.Text className={`d-block mb-2 ${diff > 0 ? "text-success" : "text-danger"}`}>
                  {diff > 0
                    ? `Adding ${diff} will be recorded as a purchase (Addition) in the Audit Report.`
                    : `Reducing by ${-diff} will be recorded as scrap in the Audit Report.`}
                </Form.Text>
              );
            })()}
            <Field id="editPrice" className="mb-3" label="Price" type="number" min="0" step="any" name="price"
              value={editing?.price ?? ""} onChange={handleChange} />
            <Field id="editPurchaseDate" className="mb-3" label="Purchase Date" type="date" name="purchaseDate"
              value={toDateInput(editing?.purchaseDate)} onChange={handleChange} />
            <Field id="editWarranty" className="mb-3" label="Warranty Time" type="text" name="warrantyCheck"
              placeholder="Enter warranty timeline" value={editing?.warrantyCheck ?? ""} onChange={handleChange} />
            <Field id="editMinStock" className="mb-3" label="Minimum Stock Level" type="number" min="0" name="minimumStockLevel"
              placeholder="Enter minimum stock level" value={editing?.minimumStockLevel ?? ""} onChange={handleChange} />
            <Field id="editStatus" className="mb-3" label="Status">
              <Form.Select name="status" value={editing?.status ?? ""} onChange={handleChange}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Form.Select>
            </Field>

            <Form.Label>Current attachments</Form.Label>
            {editing && (
              <AttachmentList
                productId={editing.id}
                refreshKey={filesVersion}
                onLoaded={(list) => setExistingCount(list.length)}
                onDelete={(file) => setConfirm({ type: "deleteFile", file })}
              />
            )}
            <div className="mt-3" />
            <AttachmentPicker files={newFiles} onChange={setNewFiles} existingCount={existingCount} disabled={saving} />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={closeEdit} disabled={saving}>Cancel</Button>
          <Button className="save" onClick={() => setConfirm({ type: "edit" })} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View modal */}
      <Modal show={!!viewing} onHide={() => setViewing(null)}>
        <Modal.Header closeButton>
          <Modal.Title>Product Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {viewing && (
            <div>
              <p><strong>Product Name:</strong> {viewing.productName}</p>
              <p><strong>Description:</strong> {viewing.description}</p>
              <p><strong>Price:</strong> {viewing.price}</p>
              <p><strong>Purchase Date:</strong> {formatDate(viewing.purchaseDate)}</p>
              <p><strong>Quantity:</strong> {viewing.quantity}</p>
              <p><strong>Minimum Stock Level:</strong> {viewing.minimumStockLevel}</p>
              <p><strong>Warranty Period:</strong> {viewing.warrantyCheck}</p>
              <p><strong>Status:</strong> {stockStatus(viewing)}{viewing.status ? " (set manually)" : ""}</p>
              <p className="mb-1"><strong>Attachments:</strong></p>
              <AttachmentList productId={viewing.id} />
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

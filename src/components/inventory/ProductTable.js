"use client";

import { useState } from "react";
import { Button, Form, Modal, Table } from "react-bootstrap";
import { toast } from "react-toastify";
import { FaEye } from "react-icons/fa";
import { FaTrashCan } from "react-icons/fa6";
import { LuClipboardPen } from "react-icons/lu";
import { PiList } from "react-icons/pi";
import { TiArrowUnsorted } from "react-icons/ti";
import { api } from "@/lib/api";
import { formatDate, toDateInput } from "@/lib/format";
import { isLowStock, stockStatus } from "@/lib/stock";
import Field from "@/components/ui/Field";

export default function ProductTable({ products, loading, onChanged }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditing((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api(`/storage/${editing.id}`, {
        method: "PUT",
        body: {
          productName: editing.productName,
          category: editing.category,
          description: editing.description ?? "",
          quantity: editing.quantity,
          price: editing.price,
          purchaseDate: toDateInput(editing.purchaseDate),
        },
      });
      toast.success("Product updated successfully");
      setEditing(null);
      await onChanged();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api(`/storage/${id}`, { method: "DELETE" });
      toast.success("Product deleted successfully");
      await onChanged();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <>
      <Table striped bordered hover className="admin-table">
        <thead>
          <tr>
            <th><PiList size={20} /></th>
            <th>Name <TiArrowUnsorted /></th>
            <th>Category <TiArrowUnsorted /></th>
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
            <tr><td colSpan={9}>Loading...</td></tr>
          )}
          {!loading && products.length === 0 && (
            <tr><td colSpan={9}>No products found</td></tr>
          )}
          {products.map((product, index) => (
            <tr key={product.id}>
              <td>{index + 1}</td>
              <td>{product.productName}</td>
              <td>{product.category}</td>
              <td>{product.description}</td>
              <td>{formatDate(product.purchaseDate)}</td>
              <td>{product.quantity}</td>
              <td>{product.price}</td>
              <td style={{ color: isLowStock(product) ? "red" : "green", fontWeight: "bold" }}>
                {stockStatus(product)}
              </td>
              <td>
                <Button className="button-add-product1" onClick={() => setViewing(product)} aria-label="View product">
                  <FaEye size={25} />
                </Button>
                <Button className="button-add-product3" onClick={() => setEditing({ ...product })} aria-label="Edit product">
                  <LuClipboardPen size={25} />
                </Button>
                <Button className="button-add-product1" onClick={() => handleDelete(product.id)} aria-label="Delete product">
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
          <Modal.Title>Update Inventory Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Field id="editProductName" className="mb-3" label="Product Name" type="text" name="productName"
              value={editing?.productName ?? ""} onChange={handleChange} />
            <Field id="editCategory" className="mb-3" label="Category" type="text" name="category"
              value={editing?.category ?? ""} onChange={handleChange} />
            <Field id="editDescription" className="mb-3" label="Description" type="text" name="description"
              value={editing?.description ?? ""} onChange={handleChange} />
            <Field id="editQuantity" className="mb-3" label="Quantity" type="number" min="0" name="quantity"
              value={editing?.quantity ?? ""} onChange={handleChange} />
            <Field id="editPrice" className="mb-3" label="Price" type="number" min="0" step="any" name="price"
              value={editing?.price ?? ""} onChange={handleChange} />
            <Field id="editPurchaseDate" className="mb-3" label="Purchase Date" type="date" name="purchaseDate"
              value={toDateInput(editing?.purchaseDate)} onChange={handleChange} />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setEditing(null)}>Cancel</Button>
          <Button className="save" onClick={handleSave} disabled={saving}>
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
              <p><strong>Category:</strong> {viewing.category}</p>
              <p><strong>Description:</strong> {viewing.description}</p>
              <p><strong>Price:</strong> {viewing.price}</p>
              <p><strong>Purchase Date:</strong> {formatDate(viewing.purchaseDate)}</p>
              <p><strong>Quantity:</strong> {viewing.quantity}</p>
              <p><strong>Minimum Stock Level:</strong> {viewing.minimumStockLevel}</p>
              <p><strong>Warranty Period:</strong> {viewing.warrantyCheck}</p>
              <p><strong>Status:</strong> {stockStatus(viewing)}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setViewing(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

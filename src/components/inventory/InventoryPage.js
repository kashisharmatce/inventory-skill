"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Container, Form, InputGroup, Modal, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { api, uploadProductFiles } from "@/lib/api";
import { isLowStock } from "@/lib/stock";
import Field from "@/components/ui/Field";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AttachmentPicker from "@/components/ui/AttachmentPicker";
import InventoryStats from "./InventoryStats";
import ProductTable from "./ProductTable";

const EMPTY_PRODUCT = {
  productName: "",
  description: "",
  quantity: "",
  price: "",
  purchaseDate: "",
  warrantyCheck: "",
  minimumStockLevel: "",
};

export default function InventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [confirmAdd, setConfirmAdd] = useState(false);
  const [newFiles, setNewFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("");

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api("/storage");
      setProducts(res.data);
    } catch (error) {
      toast.error(error.message || "Error fetching products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openModal = () => {
    setForm(EMPTY_PRODUCT);
    setNewFiles([]);
    setShowModal(true);
  };

  const handleAddProduct = async () => {
    setSaving(true);
    try {
      const res = await api("/storage", { method: "POST", body: form });
      toast.success(`"${form.productName}" added successfully`);
      setShowModal(false);
      if (newFiles.length > 0) {
        // The product is saved first, then each file is uploaded to it.
        const failed = await uploadProductFiles(res.data.id, newFiles);
        if (failed.length === 0) {
          toast.success(`${newFiles.length} attachment${newFiles.length === 1 ? "" : "s"} uploaded`);
        } else {
          failed.forEach((f) => toast.error(`Could not upload "${f.name}": ${f.message}`));
        }
      }
      await fetchProducts();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        if (filter === "inStock") return !isLowStock(product);
        if (filter === "lowStock") return isLowStock(product);
        const term = searchTerm.toLowerCase();
        return product.productName.toLowerCase().includes(term);
      }),
    [products, filter, searchTerm]
  );

  return (
    <>
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add Inventory Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Field id="formProductName" label="Product Name" type="text" name="productName"
              placeholder="Enter product name" value={form.productName} onChange={handleChange} required />
            <Field id="formDescription" label="Description" as="textarea" rows={3} name="description"
              placeholder="Enter description" value={form.description} onChange={handleChange} />
            <Field id="formQuantity" label="Quantity" type="number" min="0" name="quantity"
              placeholder="Enter quantity" value={form.quantity} onChange={handleChange} required />
            <Field id="formPrice" label="Price" type="text" name="price"
              placeholder="Enter price" value={form.price} onChange={handleChange} />
            <Field id="formPurchaseDate" label="Purchase Date" type="date" name="purchaseDate"
              value={form.purchaseDate} onChange={handleChange} />
            <Field id="formWarrantyCheck" label="Warranty Time" type="text" name="warrantyCheck"
              placeholder="Enter Warranty Timeline" value={form.warrantyCheck} onChange={handleChange} />
            <Field id="formMinimumStockLevel" label="Minimum Stock Level" type="number" min="0" name="minimumStockLevel"
              placeholder="Enter minimum stock level" value={form.minimumStockLevel} onChange={handleChange} />
            <AttachmentPicker files={newFiles} onChange={setNewFiles} disabled={saving} />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button className="save" onClick={() => setConfirmAdd(true)} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Container fluid className="flex-grow-1">
        <InventoryStats products={products} loading={loading} />

        {/* Search and filter controls */}
        <Row className="my-3">
          <Col xs={12} md={4} className="mb-2 mb-md-0">
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Type here to search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <InputGroup.Text>
                <CiSearch />
              </InputGroup.Text>
            </InputGroup>
          </Col>
          <Col xs={8} md={4}>
            <Form.Control as="select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Filter by stock level</option>
              <option value="inStock">In Stock</option>
              <option value="lowStock">Low Stock</option>
            </Form.Control>
          </Col>
          <Col xs={4} className="d-flex justify-content-end">
            <Button onClick={openModal} className="button-add-product">
              <BiSolidMessageSquareAdd size={20} /> Add
            </Button>
          </Col>
        </Row>

        <Row>
          <Col xs={12}>
            <Card>
              <Card.Body>
                <Card.Title>Inventory Details</Card.Title>
                <div className="table table-scroll">
                  <ProductTable products={filteredProducts} loading={loading} onChanged={fetchProducts} />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
      <ConfirmModal
        show={confirmAdd}
        busy={saving}
        title="Add product?"
        message={`Do you want to add "${form.productName}"?`}
        confirmLabel="Yes, add"
        busyLabel="Saving..."
        onConfirm={async () => {
          await handleAddProduct();
          setConfirmAdd(false);
        }}
        onCancel={() => setConfirmAdd(false)}
      />
    </>
  );
}

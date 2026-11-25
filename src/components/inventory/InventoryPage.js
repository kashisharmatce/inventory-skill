"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Container, Form, InputGroup, Modal, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { api } from "@/lib/api";
import { isLowStock } from "@/lib/stock";
import Field from "@/components/ui/Field";
import StatCards from "@/components/ui/StatCards";
import ProductTable from "./ProductTable";

const EMPTY_PRODUCT = {
  productName: "",
  category: "",
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
    setShowModal(true);
  };

  const handleAddProduct = async () => {
    setSaving(true);
    try {
      await api("/storage", { method: "POST", body: form });
      toast.success("Product created successfully");
      setShowModal(false);
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
        return (
          product.productName.toLowerCase().includes(term) ||
          product.category.toLowerCase().includes(term)
        );
      }),
    [products, filter, searchTerm]
  );

  const cards = [
    { title: "Categories", text: `Total (${new Set(products.map((p) => p.category.trim().toLowerCase())).size} items)` },
    { title: "Total Products", text: `Total (${products.length} items)` },
    { title: "Low Stock", text: `Total (${products.filter(isLowStock).length} items)` },
    { title: "Component 4", text: "Total (x items)" },
  ];

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
            <Field id="formCategory" label="Category" type="text" name="category"
              placeholder="Enter category" value={form.category} onChange={handleChange} required />
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
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button className="save" onClick={handleAddProduct} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Container fluid className="flex-grow-1">
        <StatCards cards={cards} />

        {/* Search and filter controls */}
        <Row className="my-3">
          <Col xs={4}>
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
          <Col xs={4}>
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
                <div className="table">
                  <ProductTable products={filteredProducts} loading={loading} onChanged={fetchProducts} />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

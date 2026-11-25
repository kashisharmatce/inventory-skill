"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Container, Form, InputGroup, Modal, Row } from "react-bootstrap";
import { toast } from "react-toastify";
import { CiSearch } from "react-icons/ci";
import { BiSolidMessageSquareAdd } from "react-icons/bi";
import { api } from "@/lib/api";
import { isIssuable } from "@/lib/stock";
import { getTrackingCards } from "@/services/dashboard";
import Field from "@/components/ui/Field";
import StatCards from "@/components/ui/StatCards";
import ComponentRows, { EMPTY_COMPONENT } from "./ComponentRows";
import UserTable from "./UserTable";

const EMPTY_USER = { name: "", email: "", mobile: "", USN: "", status: "active" };

export default function UserTrackPage() {
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_USER);
  const [components, setComponents] = useState([]);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api("/user");
      setUsers(res.data);
    } catch (error) {
      toast.error(error.message || "Error fetching user data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await api("/storage");
      setProducts(res.data);
    } catch (error) {
      toast.error(error.message || "Error fetching products");
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchProducts();
  }, [fetchUsers, fetchProducts]);

  const issuableProducts = useMemo(() => products.filter(isIssuable), [products]);

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
          (filterStatus ? user.status === filterStatus : true)
      ),
    [users, searchTerm, filterStatus]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const openModal = () => {
    setForm(EMPTY_USER);
    setComponents([]);
    setShowModal(true);
  };

  const handleComponentChange = (index, patch) =>
    setComponents((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const handleSave = async () => {
    setSaving(true);
    try {
      // The server creates the user and deducts stock in one transaction.
      await api("/user", { method: "POST", body: { ...form, components } });
      toast.success("User created and stock updated");
      setShowModal(false);
      await Promise.all([fetchUsers(), fetchProducts()]);
    } catch (error) {
      toast.error(error.message || "Error while saving user and updating stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Fill User Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Field id="formName" label="Name" type="text" name="name" placeholder="Enter User Name"
              value={form.name} onChange={handleChange} required />
            <Field id="formEmail" label="Email" type="text" name="email" placeholder="Enter Email"
              value={form.email} onChange={handleChange} required />
            <Field id="formMobile" label="Contact" type="text" name="mobile" placeholder="Enter mobile number"
              value={form.mobile} onChange={handleChange} required />
            <Field id="formUSN" label="USN" type="text" name="USN" placeholder="Enter USN number"
              value={form.USN} onChange={handleChange} required />

            {components.length === 0 && (
              <Button className="save" onClick={() => setComponents([{ ...EMPTY_COMPONENT }])}>
                +product
              </Button>
            )}
            <ComponentRows
              components={components}
              products={issuableProducts}
              onChange={handleComponentChange}
              onAdd={() => setComponents((prev) => [...prev, { ...EMPTY_COMPONENT }])}
              onRemove={(index) => setComponents((prev) => prev.filter((_, i) => i !== index))}
            />

            <Form.Group controlId="formStatus">
              <Form.Label>Status</Form.Label>
              <Form.Control as="select" name="status" value={form.status} onChange={handleChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
                <option value="returned">Returned</option>
              </Form.Control>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button className="cancel" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button className="save" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Container fluid className="flex-grow-1">
        <StatCards cards={getTrackingCards()} className="mb-3" />

        <Row className="mb-3">
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
            <Form.Control as="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">Filter by status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="returned">Returned</option>
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
                <Card.Title>User Details</Card.Title>
                <div className="table-container">
                  <UserTable users={filteredUsers} loading={loading} onChanged={fetchUsers} />
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
}

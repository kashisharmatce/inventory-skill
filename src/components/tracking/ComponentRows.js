"use client";

import { Button, Col, Form, Row } from "react-bootstrap";

export const EMPTY_COMPONENT = { productId: "", productName: "", quantity: "", issueAt: "", returnDate: "" };

/**
 * Editable list of issued components used by the "Fill User Details" modal.
 * `products` are the issuable products for the dropdown.
 */
export default function ComponentRows({ components, products, onChange, onAdd, onRemove }) {
  const handleProductChange = (index, productId) => {
    const product = products.find((p) => p.id === productId);
    onChange(index, { productId, productName: product ? product.productName : "" });
  };

  return components.map((component, index) => (
    <Row key={index} className="form-row align-items-center">
      <Col md={4} className="form-col">
        <Form.Label>Component </Form.Label>
        <Form.Select
          value={component.productId}
          onChange={(e) => handleProductChange(index, e.target.value)}
          required
        >
          <option value="">Select</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.productName}
            </option>
          ))}
        </Form.Select>
      </Col>
      <Col md={2} className="form-col">
        <Form.Label>Quantity</Form.Label>
        <Form.Control
          type="number"
          min="1"
          value={component.quantity}
          onChange={(e) => onChange(index, { quantity: e.target.value })}
          required
        />
      </Col>
      <Col md={3} className="form-col">
        <Form.Label>Issued At</Form.Label>
        <Form.Control
          type="date"
          value={component.issueAt}
          onChange={(e) => onChange(index, { issueAt: e.target.value })}
          required
        />
      </Col>
      <Col md={3} className="form-col">
        <Form.Label>Return Date</Form.Label>
        <Form.Control
          type="date"
          value={component.returnDate}
          onChange={(e) => onChange(index, { returnDate: e.target.value })}
          required
        />
      </Col>
      <Col md={2} className="form-button-col">
        {index === 0 ? (
          <Button className="save" onClick={onAdd}>Add</Button>
        ) : (
          <Button variant="outline-danger" onClick={() => onRemove(index)}>Remove</Button>
        )}
      </Col>
    </Row>
  ));
}

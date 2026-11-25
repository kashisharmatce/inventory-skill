"use client";

import { Button, Col, Form, Row } from "react-bootstrap";
import ComponentSelect from "./ComponentSelect";

export const EMPTY_COMPONENT = { productId: "", productName: "", quantity: "", issueAt: "", returnDate: "" };

const num = (v) => Number(v) || 0;

/** True when the product is at / below its minimum stock level (a manual Low-Stock status counts too). */
const isLow = (product, available) => {
  if (product.status === "low-stock") return true;
  if (product.status === "in-stock") return false;
  const min = product.minimumStockLevel;
  return min !== null && min !== undefined && available <= Number(min);
};

/**
 * How many units of `product` can still be issued in this row: the stock in the inventory minus what the
 * OTHER rows of the same form have already taken.
 */
export function availableFor(product, components, rowIndex) {
  const takenElsewhere = components.reduce(
    (sum, c, i) => (i !== rowIndex && c.productId === product.id ? sum + num(c.quantity) : sum),
    0
  );
  return Math.max(0, num(product.quantity) - takenElsewhere);
}

/**
 * Checks the component rows against the current stock. Returns an error message, or "" when all is fine.
 * Used before saving; the database enforces the same rule again.
 */
export function validateComponents(components, products) {
  if (components.length === 0) return "Please add at least one component";
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    const row = components.length > 1 ? ` (row ${i + 1})` : "";
    const product = products.find((p) => p.id === c.productId);
    if (!product) return `Please choose a component${row}`;
    const qty = Number(c.quantity);
    if (!Number.isInteger(qty) || qty < 1) return `Enter a quantity of 1 or more for "${product.productName}"`;
    const available = availableFor(product, components, i);
    if (available <= 0) return `"${product.productName}" is out of stock${row}`;
    if (qty > available) return `Only ${available} of "${product.productName}" available${row}`;
  }
  return "";
}

/**
 * Editable list of issued components used by the "Fill User Details" modal.
 * `products` are all inventory products; each row shows what is still available for it.
 */
export default function ComponentRows({ components, products, onChange, onAdd, onRemove }) {
  const handleSelect = (index, product) => {
    onChange(index, {
      productId: product ? product.id : "",
      productName: product ? product.productName : "",
      quantity: "",
    });
  };

  return components.map((component, index) => {
    const rowProducts = products.map((p) => {
      const available = availableFor(p, components, index);
      return { ...p, available, low: isLow(p, available) };
    });
    const product = rowProducts.find((p) => p.id === component.productId);
    const available = product ? product.available : null;
    const tooMany = product && Number(component.quantity) > available;

    return (
      <Row key={index} className="form-row align-items-start">
        <Col xs={12} className="form-col">
          <Form.Label htmlFor={`component-${index}`}>Component </Form.Label>
          <ComponentSelect
            id={`component-${index}`}
            products={rowProducts}
            value={component.productId}
            onSelect={(p) => handleSelect(index, p)}
          />
          {product && !tooMany && (
            <div className={`combo__hint${product.low ? " is-low" : ""}`}>
              {product.available} available{product.low ? " - low stock" : ""}
            </div>
          )}
        </Col>
        <Col xs={6} md={3} className="form-col">
          <Form.Label htmlFor={`quantity-${index}`}>Quantity</Form.Label>
          <Form.Control
            id={`quantity-${index}`}
            type="number"
            min="1"
            max={available ?? undefined}
            value={component.quantity}
            isInvalid={!!tooMany}
            disabled={!!product && available <= 0}
            onChange={(e) => onChange(index, { quantity: e.target.value })}
            required
          />
          {tooMany && <div className="combo__warn">Only {available} available</div>}
        </Col>
        <Col xs={6} md={3} className="form-col">
          <Form.Label>Issued At</Form.Label>
          <Form.Control
            type="date"
            value={component.issueAt}
            onChange={(e) => onChange(index, { issueAt: e.target.value })}
            required
          />
        </Col>
        <Col xs={6} md={3} className="form-col">
          <Form.Label>Return Date</Form.Label>
          <Form.Control
            type="date"
            value={component.returnDate}
            onChange={(e) => onChange(index, { returnDate: e.target.value })}
            required
          />
        </Col>
        <Col xs={6} md={3} className="form-button-col">
          {index === 0 ? (
            <Button className="save" onClick={onAdd}>Add</Button>
          ) : (
            <Button variant="outline-danger" onClick={() => onRemove(index)}>Remove</Button>
          )}
        </Col>
      </Row>
    );
  });
}

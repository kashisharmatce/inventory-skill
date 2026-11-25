"use client";

import { Card, Col, Row } from "react-bootstrap";

/**
 * Row of four summary cards.
 * cards: [{ title, text? }]. `titleColor` is applied to the title (original used purple on most pages).
 */
export default function StatCards({ cards, titleColor = "purple", className }) {
  return (
    <Row className={className}>
      {cards.map((card) => (
        <Col xs={3} key={card.title}>
          <Card>
            <Card.Body>
              <Card.Title style={titleColor ? { color: titleColor } : undefined}>{card.title}</Card.Title>
              {card.text ? <Card.Text style={{ color: "#f77f5b" }}>{card.text}</Card.Text> : null}
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

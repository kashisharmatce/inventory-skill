"use client";

import { Card, Col, Container, Row } from "react-bootstrap";
import StatCards from "@/components/ui/StatCards";
import BarChart from "@/components/charts/BarChart";

export default function DashboardView({ cards, chart }) {
  return (
    <Container fluid className="flex-grow-1">
      <StatCards cards={cards} className="mb-3" />

      <Row>
        <Col xs={12}>
          <Card>
            <Card.Body>
              <Card.Title>Graph</Card.Title>
              <div>
                <BarChart label={chart.label} labels={chart.labels} values={chart.values} />
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

"use client";

import { Bar, Doughnut } from "react-chartjs-2";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// Colours of the app: purple, orange, red
export const COLORS = { purple: "#8b3e9c", purpleSoft: "#c27bd2", orange: "#f77f5b", red: "#d9534f", green: "#2e9e6b", grey: "#d7d2db" };

const FONT = { size: 11 };

/** Purchases / issued / scrap for each month of the year. */
export function ActivityChart({ labels, purchases, issued, scrap }) {
  const data = {
    labels,
    datasets: [
      { label: "Purchases", data: purchases, backgroundColor: COLORS.purple, borderRadius: 3 },
      { label: "Issued", data: issued, backgroundColor: COLORS.orange, borderRadius: 3 },
      { label: "Scrap", data: scrap, backgroundColor: COLORS.red, borderRadius: 3 },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: FONT } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: FONT } },
      y: { beginAtZero: true, ticks: { precision: 0, font: FONT } },
    },
  };
  return <Bar data={data} options={options} />;
}

/** How many components are in stock / low / out of stock. */
export function StatusChart({ healthy, low, out }) {
  const data = {
    labels: ["In stock", "Low stock", "Out of stock"],
    datasets: [{ data: [healthy, low, out], backgroundColor: [COLORS.green, COLORS.orange, COLORS.grey], borderWidth: 0 }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "62%",
    plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: FONT } } },
  };
  return <Doughnut data={data} options={options} />;
}

/** The components that were issued the most (horizontal bars). */
export function TopIssuedChart({ items }) {
  const data = {
    labels: items.map((i) => i.name),
    datasets: [{ label: "Issued", data: items.map((i) => i.quantity), backgroundColor: COLORS.purple, borderRadius: 3 }],
  };
  const options = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0, font: FONT } },
      y: { grid: { display: false }, ticks: { font: FONT } },
    },
  };
  return <Bar data={data} options={options} />;
}

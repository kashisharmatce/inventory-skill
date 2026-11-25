"use client";

import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const options = {
  responsive: true,
  plugins: {
    legend: { position: "top" },
    title: { display: true, text: "Monthly Data" },
  },
  scales: {
    y: { beginAtZero: true, ticks: { stepSize: 2 } },
  },
};

export default function BarChart({ label, labels, values }) {
  const data = {
    labels,
    datasets: [
      {
        label,
        data: values,
        backgroundColor: "rgba(194, 123, 210, 1)",
        borderColor: "rgba(100, 35, 115, 1)",
        borderWidth: 1,
      },
    ],
  };

  return <Bar data={data} options={options} />;
}

"use client";

import { useEffect, useState } from "react";
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

const baseOptions = {
  responsive: true,
  plugins: {
    legend: { position: "top" },
    title: { display: true, text: "Monthly Data" },
  },
  scales: {
    y: { beginAtZero: true, ticks: { stepSize: 2 } },
  },
};

// On narrow screens the default 2:1 aspect ratio makes the chart too short to read,
// so it switches to a fixed-height box there. Desktop rendering is unchanged.
const SMALL_SCREEN = "(max-width: 575.98px)";

export default function BarChart({ label, labels, values }) {
  const [small, setSmall] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(SMALL_SCREEN);
    const update = () => setSmall(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

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

  const options = small ? { ...baseOptions, maintainAspectRatio: false } : baseOptions;

  return (
    <div className="chart-box" style={small ? { position: "relative", height: 300 } : undefined}>
      <Bar data={data} options={options} />
    </div>
  );
}

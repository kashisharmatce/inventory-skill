// TEMPORARY placeholder data for the summary cards and the bar chart.
// These mirror the placeholders in the original app and will be replaced by real queries
// (see src/services/dashboard.js) in a later step.

export const DASHBOARD_CARDS = [
  { title: "Most issued item", text: "Total (4 items)" },
  { title: "Top users", text: "Total (4)" },
  { title: "Total Products", text: "Total (40 items)" },
  { title: "Component 4", text: "" },
];

export const TRACKING_CARDS = [
  { title: "Most issued item", text: "Total (20 items)" },
  { title: "Top users", text: "Total (20 items)" },
  { title: "Component 3", text: "Total (20 items)" },
  { title: "Component 4", text: "Total (20 items)" },
];

export const CHART_DATA = {
  label: "Sample Data",
  labels: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  values: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24],
};

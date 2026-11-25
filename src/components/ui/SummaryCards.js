"use client";

/**
 * Summary tiles used on the Inventory, Tracking and Dashboard pages.
 * cards: [{ key, Icon, badge, title, value, note }]
 */
export default function SummaryCards({ cards }) {
  return (
    <div className="inv-stats">
      {cards.map(({ key, Icon, badge, title, value, note }) => (
        <div key={key} className="inv-stat">
          <div className="inv-stat__top">
            <Icon size={22} className="inv-stat__icon" aria-hidden="true" />
            <span className="inv-stat__badge">{badge}</span>
          </div>
          <div className="inv-stat__title">{title}</div>
          <div className="inv-stat__value">{value}</div>
          <div className="inv-stat__note">{note}</div>
        </div>
      ))}
    </div>
  );
}

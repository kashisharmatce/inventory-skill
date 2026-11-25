// Stock rules used by the Inventory and Tracking screens.

const hasMin = (p) => p.minimumStockLevel !== null && p.minimumStockLevel !== undefined;

/** Low stock: quantity at or below the configured minimum (never low when no minimum is set). */
export const isLowStock = (p) => hasMin(p) && Number(p.quantity) <= Number(p.minimumStockLevel);

export const stockStatus = (p) => (isLowStock(p) ? "Low-Stock" : "In-Stock");

/** Only products above their minimum level can be issued (as in the original dropdown). */
export const isIssuable = (p) => !hasMin(p) ? Number(p.quantity) > 0 : Number(p.quantity) > Number(p.minimumStockLevel);

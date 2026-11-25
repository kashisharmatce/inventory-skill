"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuChevronDown, LuX } from "react-icons/lu";

/**
 * Searchable dropdown: type to filter the list, or open it and pick.
 * products: [{ id, productName, available, low }]
 *   available = units that can still be issued (stock minus what is already chosen elsewhere in the form)
 *   low       = true when the product is at / below its minimum stock level (still selectable)
 * Products with nothing available are shown but cannot be chosen.
 * value: selected product id ("" for none); onSelect(product | null) is called when the choice changes.
 */
export default function ComponentSelect({ id, products, value, onSelect, placeholder = "Search or select component" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);

  const selected = products.find((p) => p.id === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter((p) => p.productName.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const enabled = (p) => !!p && p.available > 0;

  // close when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  // keep the highlighted option visible while using the arrow keys
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const firstEnabled = (list) => Math.max(0, list.findIndex(enabled));

  const openList = () => {
    setQuery("");
    const i = products.findIndex((p) => p.id === value);
    setActive(i >= 0 ? i : firstEnabled(products));
    setOpen(true);
  };

  const choose = (product) => {
    if (!enabled(product)) return; // out of stock: not allowed
    onSelect(product);
    setOpen(false);
    setQuery("");
  };

  const move = (dir) => {
    let i = active + dir;
    while (i >= 0 && i < filtered.length && !enabled(filtered[i])) i += dir;
    if (i >= 0 && i < filtered.length) setActive(i);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) return openList();
      move(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault();
        choose(filtered[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation(); // do not close the surrounding modal
        setOpen(false);
      }
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const listId = `${id}-list`;

  return (
    <div className="combo" ref={rootRef}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        className="form-control combo__input"
        placeholder={placeholder}
        value={open ? query : selected?.productName ?? ""}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          const text = e.target.value;
          setQuery(text);
          const q = text.trim().toLowerCase();
          const list = q ? products.filter((p) => p.productName.toLowerCase().includes(q)) : products;
          setActive(firstEnabled(list));
          if (!open) setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      {selected && !open ? (
        <button type="button" className="combo__icon combo__clear" aria-label="Clear component" onClick={() => onSelect(null)}>
          <LuX />
        </button>
      ) : (
        <LuChevronDown className="combo__icon" aria-hidden="true" />
      )}

      {open && (
        <ul className="combo__list" id={listId} role="listbox" ref={listRef}>
          {filtered.length === 0 && <li className="combo__empty">No components found</li>}
          {filtered.map((p, i) => {
            const out = !enabled(p);
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={p.id === value}
                aria-disabled={out}
                data-index={i}
                title={out ? "No stock available" : undefined}
                className={`combo__option${i === active && !out ? " is-active" : ""}${p.id === value ? " is-selected" : ""}${out ? " is-disabled" : ""}`}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                onClick={() => choose(p)}
                onMouseEnter={() => !out && setActive(i)}
              >
                <span className="combo__name">{p.productName}</span>
                <span className="combo__tags">
                  {!out && p.low && <span className="combo__low">Low stock</span>}
                  <span className={`combo__stock${out ? " is-out" : ""}`}>{out ? "Out of stock" : `Available: ${p.available}`}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

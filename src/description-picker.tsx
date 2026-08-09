import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type DescriptionPickerOption = {
  value: string;
  label: string;
  meta?: string;
  description?: string;
};

type DescriptionPickerProps = {
  ariaLabel: string;
  value: string;
  placeholder: string;
  options: DescriptionPickerOption[];
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function DescriptionPicker({
  ariaLabel,
  value,
  placeholder,
  options,
  onChange,
  className = "",
  disabled = false,
}: DescriptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeValue, setActiveValue] = useState(value);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const previewId = useId();
  const searchable = options.length > 10;
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.meta ?? ""} ${option.description ?? ""}`.toLowerCase().includes(needle));
  }, [options, query]);
  const active = filteredOptions.find((option) => option.value === activeValue) ?? filteredOptions[0] ?? selected;

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveValue(value);
    } else if (!activeValue && options[0]) {
      setActiveValue(options[0].value);
    }
  }, [activeValue, open, options, value]);

  function openPicker() {
    if (disabled) return;
    setActiveValue(value || options[0]?.value || "");
    setOpen((current) => !current);
  }

  function choose(option: DescriptionPickerOption) {
    onChange(option.value);
    setOpen(false);
  }

  function moveActive(direction: 1 | -1) {
    if (!filteredOptions.length) return;
    const currentIndex = Math.max(0, filteredOptions.findIndex((option) => option.value === active?.value));
    const nextIndex = (currentIndex + direction + filteredOptions.length) % filteredOptions.length;
    setActiveValue(filteredOptions[nextIndex].value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" && open && filteredOptions[0]) {
      event.preventDefault();
      setActiveValue(filteredOptions[0].value);
      return;
    }
    if (event.key === "End" && open && filteredOptions.at(-1)) {
      event.preventDefault();
      setActiveValue(filteredOptions.at(-1)!.value);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open && active) {
      event.preventDefault();
      choose(active);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className={`description-picker ${open ? "is-open" : ""} ${className}`.trim()}>
      <button
        type="button"
        className="description-picker-trigger"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && active ? `${listboxId}-${active.value}` : undefined}
        disabled={disabled}
        onClick={openPicker}
        onKeyDown={handleKeyDown}
      >
        <span className={selected ? "" : "placeholder"}>{selected?.label ?? (value || placeholder)}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>

      {open && (
        <div className="description-picker-popover">
          <div className="description-picker-options-panel">
            {searchable && (
              <label className="description-picker-search">
                <Search size={15} aria-hidden="true" />
                <input
                  aria-label={`Search ${ariaLabel.toLowerCase()}`}
                  value={query}
                  placeholder="Search options"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    const firstMatch = options.find((option) => `${option.label} ${option.meta ?? ""} ${option.description ?? ""}`.toLowerCase().includes(event.target.value.trim().toLowerCase()));
                    setActiveValue(firstMatch?.value ?? "");
                  }}
                />
              </label>
            )}
            <div id={listboxId} className="description-picker-options" role="listbox" aria-label={ariaLabel}>
              {filteredOptions.map((option) => (
                <button
                  type="button"
                  id={`${listboxId}-${option.value}`}
                  role="option"
                  aria-selected={option.value === value}
                  aria-describedby={previewId}
                  className={option.value === active?.value ? "active" : ""}
                  key={option.value}
                  onMouseEnter={() => setActiveValue(option.value)}
                  onFocus={() => setActiveValue(option.value)}
                  onClick={() => choose(option)}
                >
                  <span><strong>{option.label}</strong>{option.meta && <small>{option.meta}</small>}</span>
                  {option.value === value && <Check size={15} aria-hidden="true" />}
                </button>
              ))}
              {!filteredOptions.length && <p className="description-picker-empty">No matching options</p>}
            </div>
          </div>
          <aside id={previewId} className="description-picker-preview" aria-live="polite">
            {active ? (
              <>
                <span>Option details</span>
                <h3>{active.label}</h3>
                {active.meta && <strong>{active.meta}</strong>}
                <p>{active.description || "No description was supplied by this content pack."}</p>
              </>
            ) : (
              <p>Hover or focus an option to preview its description.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

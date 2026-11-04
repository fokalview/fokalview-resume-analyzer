import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type Suggestion = string | { value: string; label: string; aliases?: string[] };

/** Editable, manual-selection combobox: never replaces a custom value on blur. */
export function SearchableSelect({ label, value, onChange, options, required = false, error = "", autoComplete, help = "Choose a suggestion or enter your own value.", placeholder = "Search or enter a value", className = "" }: {
  label: string; value: string; onChange: (value: string) => void; options: Suggestion[];
  required?: boolean; error?: string; autoComplete?: string; help?: string; placeholder?: string; className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const previousValue = useRef(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [above, setAbove] = useState(false);
  const normalized = options.map(option => typeof option === "string" ? { value: option, label: option, aliases: [] } : option);
  const query = value.trim().toLocaleLowerCase();
  const matches = normalized.filter(option => [option.value, option.label, ...(option.aliases || [])].some(text => text.toLocaleLowerCase().includes(query)));
  const visible = matches.slice(0, 30);
  const resultSummary = matches.length > visible.length
    ? `Showing first ${visible.length} of ${matches.length} suggestions. Type to narrow the results.`
    : `${matches.length} ${matches.length === 1 ? "suggestion" : "suggestions"}.`;
  const custom = value.trim() && !normalized.some(option => option.value.toLocaleLowerCase() === query);
  const optionCount = visible.length + (custom ? 1 : 0);
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, open, id]);
  function show() {
    const bounds = input.current?.getBoundingClientRect();
    setAbove(Boolean(bounds && window.innerHeight - bounds.bottom < 180 && bounds.top > 180));
    setOpen(true);
  }
  function choose(index: number) {
    const selected = index === visible.length ? value.trim() : visible[index]?.value;
    if (selected !== undefined) { onChange(selected); previousValue.current = selected; }
    setOpen(false); setActive(-1); input.current?.focus();
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); show();
      setActive(current => !optionCount ? -1 : event.key === "ArrowDown" ? Math.min(current + 1, optionCount - 1) : Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault(); choose(active);
    } else if (event.key === "Escape" && open) {
      event.preventDefault(); onChange(previousValue.current); setOpen(false); setActive(-1);
    } else if (event.key === "Tab") { setOpen(false); setActive(-1); }
  }
  return <div className={`searchable-field ${error ? "field-error" : ""} ${className}`}>
    <label htmlFor={id}>{label}{required && <span className="required-mark" aria-hidden="true"> *</span>}</label>
    <div className="searchable-control">
      <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
        aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined}
        aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
        required={required} aria-required={required || undefined} autoComplete={autoComplete}
        value={value} placeholder={placeholder}
        onFocus={() => { previousValue.current = value; }}
        onClick={show}
        onChange={event => { onChange(event.target.value); setActive(-1); show(); }}
        onKeyDown={keyDown} onBlur={() => { setOpen(false); setActive(-1); }} />
      <button type="button" className="suggestion-toggle" aria-label={`Show ${label.toLowerCase()} suggestions`} aria-expanded={open}
        onMouseDown={event => event.preventDefault()} onClick={() => { input.current?.focus(); if (open) setOpen(false); else show(); }}>⌄</button>
      {open && <ul id={`${id}-list`} role="listbox" aria-label={`${label} suggestions`} className={`suggestion-list ${above ? "above" : ""}`}>
        {matches.length > visible.length && <li role="presentation" className="suggestion-result-count">{resultSummary}</li>}
        {visible.map((option, index) => <li id={`${id}-option-${index}`} key={option.value} role="option" aria-selected={active === index}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}>{option.label}</li>)}
        {custom && <li id={`${id}-option-${visible.length}`} role="option" aria-selected={active === visible.length}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(visible.length)}>Use “{value.trim()}” as entered</li>}
        {!optionCount && <li role="presentation">Enter a value to use it.</li>}
      </ul>}
    </div>
    <small id={`${id}-help`} className="field-help">{help}</small>
    {error && <small id={`${id}-error`} className="field-error-text">{error}</small>}
    <span className="sr-only" role="status">{open ? `${resultSummary} Use arrow keys to navigate and Enter to select. Custom text is accepted. Escape restores your previous value.` : ""}</span>
  </div>;
}

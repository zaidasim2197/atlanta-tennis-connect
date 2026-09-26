import React, { useState, useRef, useEffect } from "react";
import { APPROVED_ATLANTA_ZIPS } from "@/lib/tennis";
import { Check, ChevronDown, MapPin } from "lucide-react";

interface ZipCodeInputProps {
  id?: string;
  value: string;
  onChange: (zip: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  onValidChange?: (isValid: boolean) => void;
}

export function ZipCodeInput({
  id = "zipCode",
  value,
  onChange,
  required = false,
  disabled = false,
  className = "",
  placeholder = "30309",
  onValidChange,
}: ZipCodeInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only allow digits up to 5 characters
  const cleanInput = (value || "").replace(/\D/g, "").slice(0, 5);
  const isValid = APPROVED_ATLANTA_ZIPS.includes(cleanInput as any);

  useEffect(() => {
    onValidChange?.(isValid);
  }, [isValid, onValidChange]);

  // Filter approved list: start with input prefix, or contain it if typed
  const matchingZips = React.useMemo(() => {
    if (!cleanInput) return APPROVED_ATLANTA_ZIPS.slice(0, 8);
    const prefixMatches = APPROVED_ATLANTA_ZIPS.filter((z) => z.startsWith(cleanInput));
    if (prefixMatches.length > 0) return prefixMatches;
    return APPROVED_ATLANTA_ZIPS.filter((z) => z.includes(cleanInput));
  }, [cleanInput]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (zip: string) => {
    onChange(zip);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "Enter")) {
      setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < matchingZips.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : matchingZips.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = matchingZips[highlightedIndex];
      if (target) {
        handleSelect(target);
      } else if (matchingZips[0]) {
        handleSelect(matchingZips[0]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={5}
          value={cleanInput}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 5);
            onChange(val);
            setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className={`block w-full rounded-lg border bg-background px-3 py-2 pr-9 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${
            cleanInput.length === 5 && !isValid
              ? "border-destructive focus:border-destructive text-destructive"
              : isValid
              ? "border-emerald-500/60 focus:border-emerald-500"
              : "border-input focus:border-primary"
          } ${className}`}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground flex items-center gap-1">
          {isValid ? (
            <Check className="size-4 text-emerald-600" />
          ) : (
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
          )}
        </div>
      </div>

      {cleanInput.length === 5 && !isValid && (
        <p className="mt-1 text-[11px] text-destructive">
          ZIP {cleanInput} is outside the approved 38 Atlanta metro ZIP codes.
        </p>
      )}

      {isOpen && !disabled && matchingZips.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1 border-b border-border/50 mb-1">
            <MapPin className="size-3 text-primary" />
            <span>Approved Atlanta ZIP Codes ({matchingZips.length})</span>
          </div>
          {matchingZips.map((zip, idx) => {
            const isSelected = zip === cleanInput;
            const isHighlighted = idx === highlightedIndex;
            return (
              <button
                key={zip}
                type="button"
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => handleSelect(zip)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors font-mono ${
                  isHighlighted || isSelected
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <span>{zip}</span>
                {isSelected && <Check className="size-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

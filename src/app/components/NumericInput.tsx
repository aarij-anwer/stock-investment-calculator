'use client';

import React from 'react';

type NumericInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'min' | 'max'
> & {
  value: number | string;
  onValueChange?: (value: string) => void;
  onNumberChange?: (value: number) => void;
  allowDecimal?: boolean;
  selectOnFocus?: boolean;
  min?: number;
  max?: number;
};

const NAV_KEYS = new Set([
  'Backspace',
  'Tab',
  'Delete',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'Enter',
  'Escape',
]);

function sanitizeNumeric(raw: string, allowDecimal: boolean) {
  const cleaned = raw.replace(/[^\d.]/g, '');
  if (!allowDecimal) {
    const dotIndex = cleaned.indexOf('.');
    return dotIndex === -1 ? cleaned : cleaned.slice(0, dotIndex);
  }
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const before = cleaned.slice(0, firstDot + 1);
  const after = cleaned.slice(firstDot + 1).replace(/\./g, '');
  return before + after;
}

function clampNumber(value: number, min?: number, max?: number) {
  let next = value;
  if (typeof min === 'number') next = Math.max(min, next);
  if (typeof max === 'number') next = Math.min(max, next);
  return next;
}

export default function NumericInput({
  value,
  onValueChange,
  onNumberChange,
  allowDecimal = false,
  selectOnFocus = true,
  min,
  max,
  inputMode,
  onFocus,
  onBlur,
  onMouseUp,
  onKeyDown,
  ...rest
}: NumericInputProps) {
  const [draftValue, setDraftValue] = React.useState<string | null>(null);
  const displayValue =
    draftValue ?? (typeof value === 'number' ? String(value) : value);
  const resolvedInputMode = inputMode ?? (allowDecimal ? 'decimal' : 'numeric');
  const selectOnMouseUpRef = React.useRef(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleaned = sanitizeNumeric(e.target.value, allowDecimal);
    const next = allowDecimal && cleaned === '.' ? '0.' : cleaned;

    setDraftValue(next);
    onValueChange?.(next);

    if (!onNumberChange || next === '' || next === '0.') return;

    const parsed = Number(next);
    if (!Number.isFinite(parsed)) return;
    const normalized = allowDecimal ? parsed : Math.round(parsed);
    onNumberChange(clampNumber(normalized, min, max));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) {
      onKeyDown(e);
      if (e.defaultPrevented) return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (NAV_KEYS.has(e.key)) return;

    const isDecimalKey = e.key === '.' || e.key === 'Decimal';

    if (!/[\d.]/.test(e.key) && !isDecimalKey) {
      e.preventDefault();
      return;
    }

    if (isDecimalKey) {
      if (!allowDecimal || displayValue.includes('.')) {
        e.preventDefault();
      }
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    onFocus?.(e);
    if (e.defaultPrevented || !selectOnFocus) return;
    selectOnMouseUpRef.current = true;
    setDraftValue(displayValue);
    e.currentTarget.select();
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    onMouseUp?.(e);
    if (e.defaultPrevented || !selectOnFocus) return;
    if (!selectOnMouseUpRef.current) return;
    e.preventDefault();
    e.currentTarget.select();
    selectOnMouseUpRef.current = false;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(e);
    setDraftValue(null);
    selectOnMouseUpRef.current = false;
  };

  return (
    <input
      {...rest}
      type="text"
      inputMode={resolvedInputMode}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onMouseUp={handleMouseUp}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}

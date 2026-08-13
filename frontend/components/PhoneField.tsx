"use client";

import { useState } from "react";

import { formatPhoneInput } from "@/lib/phone";

/**
 * A phone input that formats itself as you type: 6191234567 becomes
 * (619) 123-4567 under the cursor.
 *
 * Just the `<input>` — each form supplies its own label and wrapper, since the
 * booking form stacks a label above a full-width field while the lookup form
 * sits inline beside a button.
 *
 * `type="tel"` + `inputMode="tel"` + `autoComplete="tel"` is the trio that
 * matters: the first two get a numeric keypad instead of a full keyboard, and
 * the third offers the phone's own number in one tap. With ~90% of traffic on
 * a phone, that is most of the value of this component.
 *
 * Nothing here is validation. Whatever ends up in the field is normalized
 * server-side by `normalizePhone`, so a client who ignores the formatting —
 * or has JS fail entirely — still books successfully.
 */
export function PhoneField({
  id,
  name,
  defaultValue = "",
  required = false,
  placeholder = "(619) 123-4567",
  className = "",
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(() => formatPhoneInput(defaultValue));

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target;

    // Reformatting rewrites the whole value, which would throw the caret to the
    // end mid-edit. Only reformat while typing at the end — an edit in the
    // middle is left exactly as-is and tidied on blur instead.
    const atEnd = input.selectionStart === input.value.length;
    setValue(atEnd ? formatPhoneInput(input.value) : input.value);
  }

  return (
    <input
      id={id}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      required={required}
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      onBlur={() => setValue(formatPhoneInput(value))}
      className={className}
    />
  );
}

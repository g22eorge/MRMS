"use client";

import { useRef } from "react";

type MonthOption = {
  value: string;
  label: string;
};

export function MonthSelectForm({
  value,
  options,
  className,
  selectClassName,
}: {
  value: string;
  options: MonthOption[];
  className?: string;
  selectClassName?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} className={className}>
      <select
        name="month"
        defaultValue={value}
        onChange={() => formRef.current?.requestSubmit()}
        className={selectClassName}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <noscript>
        <button className="btn-premium-secondary ml-2 rounded-md px-3 py-1 text-sm">Go</button>
      </noscript>
    </form>
  );
}

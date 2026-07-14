"use client";

import { useCallback, useState } from "react";

import { createLineItemKey } from "@/lib/forms/line-items";

export type LineWithKey<T> = T & { key: number };

type UseLineItemsStateOptions = {
  minLines?: number;
};

export function useLineItemsState<T extends Record<string, unknown>>(
  createEmpty: () => T,
  options: UseLineItemsStateOptions = {},
) {
  const minLines = options.minLines ?? 1;

  const [lines, setLines] = useState<LineWithKey<T>[]>(() => [
    { ...createEmpty(), key: createLineItemKey() },
  ]);

  const addLine = useCallback(() => {
    setLines((prev) => [...prev, { ...createEmpty(), key: createLineItemKey() }]);
  }, [createEmpty]);

  const removeLine = useCallback(
    (key: number) => {
      setLines((prev) => (prev.length > minLines ? prev.filter((line) => line.key !== key) : prev));
    },
    [minLines],
  );

  const updateLine = useCallback((key: number, patch: Partial<T>) => {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }, []);

  const replaceLines = useCallback((next: T[]) => {
    setLines(next.map((line) => ({ ...line, key: createLineItemKey() })));
  }, []);

  const serialize = useCallback(
    <R,>(mapper: (line: T) => R): R[] => {
      return lines.map(({ key: _key, ...rest }) => mapper(rest as unknown as T));
    },
    [lines],
  );

  const appendToFormData = useCallback(
    (formData: FormData, fieldName: string, mapper: (line: T) => unknown) => {
      formData.set(fieldName, JSON.stringify(serialize(mapper)));
    },
    [serialize],
  );

  return {
    lines,
    setLines,
    addLine,
    removeLine,
    updateLine,
    replaceLines,
    serialize,
    appendToFormData,
  };
}

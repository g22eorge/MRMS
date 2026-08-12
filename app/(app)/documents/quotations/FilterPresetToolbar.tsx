"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Preset {
  name: string;
  query: string;
}

export function FilterPresetToolbar({ currentQuery }: { currentQuery: string }) {
  const router = useRouter();
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("quotation-filter-presets");
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch {
        setPresets([]);
      }
    }
  }, []);

  const handleSave = () => {
    const name = prompt("Name this filter preset:");
    if (!name?.trim()) return;
    const newPreset = { name: name.trim(), query: currentQuery };
    setPresets((prev) => {
      const filtered = prev.filter((p) => p.name !== name);
      return [...filtered, newPreset];
    });
  };

  const handleLoad = (query: string) => {
    router.push(`/documents/quotations?${query}`);
  };

  const handleClear = () => {
    setPresets([]);
    localStorage.removeItem("quotation-filter-presets");
  };

  return (
    <div className="flex items-center gap-2">
      <select
        onChange={(e) => {
          const preset = presets.find((p) => p.name === e.target.value);
          if (preset) handleLoad(preset.query);
        }}
        defaultValue=""
        className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel-strong)] px-2 text-[0.8125rem]"
      >
        <option value="" disabled>
          Load preset…
        </option>
        {presets.map((p) => (
          <option key={p.name} value={p.name}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleSave}
        className="h-8 rounded-lg border border-[var(--line)] px-2 text-[0.8125rem] hover:bg-[var(--panel-strong)]"
      >
        Save current
      </button>
      {presets.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className="h-8 rounded-lg border border-[var(--line)] px-2 text-[0.8125rem] hover:bg-red-500/10 hover:text-red-600"
        >
          Clear
        </button>
      )}
    </div>
  );
}

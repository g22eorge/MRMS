export type CommandPaletteAction = {
  id: string;
  label: string;
  description?: string;
  href: string;
  group: "Quick actions" | "Go to";
  keywords?: string[];
};

export type CommandPaletteSearchHit = {
  id: string;
  kind: "job" | "client" | "invoice" | "quotation" | "product" | "supplier";
  label: string;
  description: string;
  href: string;
};

export type CommandPaletteResponse = {
  actions: CommandPaletteAction[];
  results: CommandPaletteSearchHit[];
};

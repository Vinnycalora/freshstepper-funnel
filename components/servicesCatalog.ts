export const SERVICE_OPTIONS = [
    { id: "deep_clean", label: "Deep clean", hint: "Full exterior clean + inside wipe-down" },
    { id: "colour_restore", label: "Colour restoration", hint: "Revive faded areas / touch-up" },
    { id: "sole_repaint", label: "Sole repaint", hint: "Repaint midsole / edges" },
    { id: "heel_repair", label: "Heel repair", hint: "Heels, tips, taps (heels only)" },
    { id: "stitch_repair", label: "Stitch repair", hint: "Minor stitch fixes where possible" },
    { id: "suede_renewal", label: "Suede renewal", hint: "Brush + restore suede finish" },
    { id: "odour_treatment", label: "Odour treatment", hint: "Deodorise + refresh inside" },
    { id: "fabric_refresh", label: "Fabric refresh", hint: "Canvas / fabric deep refresh" },
    { id: "lace_replacement", label: "Lace replacement", hint: "Fresh laces (when needed)" },
] as const;

export type ServiceId = (typeof SERVICE_OPTIONS)[number]["id"];

import { useState } from "react";
import { Alert, Button, Chip, Progress, Switch, Tabs } from "components-ui";

// Overriding the tokens on an element re-colors everything inside it.
// In an app do it once in CSS: @theme { --color-primary-500: …; }
const palettes = {
  blue: {},
  violet: {
    "--color-primary-50": "oklch(96.9% 0.016 293.756)",
    "--color-primary-100": "oklch(94.3% 0.029 294.588)",
    "--color-primary-300": "oklch(81.1% 0.111 293.571)",
    "--color-primary-400": "oklch(70.2% 0.183 293.541)",
    "--color-primary-500": "oklch(60.6% 0.25 292.717)",
    "--color-primary-600": "oklch(54.1% 0.281 293.009)",
    "--color-primary-700": "oklch(49.1% 0.27 292.581)",
  },
  emerald: {
    "--color-primary-50": "oklch(97.9% 0.021 166.113)",
    "--color-primary-100": "oklch(95% 0.052 163.051)",
    "--color-primary-300": "oklch(84.5% 0.143 164.978)",
    "--color-primary-400": "oklch(76.5% 0.177 163.223)",
    "--color-primary-500": "oklch(69.6% 0.17 162.48)",
    "--color-primary-600": "oklch(59.6% 0.145 163.225)",
    "--color-primary-700": "oklch(50.8% 0.118 165.612)",
  },
  rose: {
    "--color-primary-50": "oklch(96.9% 0.015 12.422)",
    "--color-primary-100": "oklch(94.1% 0.03 12.58)",
    "--color-primary-300": "oklch(81% 0.117 11.638)",
    "--color-primary-400": "oklch(71.2% 0.194 13.428)",
    "--color-primary-500": "oklch(64.5% 0.246 16.439)",
    "--color-primary-600": "oklch(58.6% 0.253 17.585)",
    "--color-primary-700": "oklch(51.4% 0.222 16.935)",
  },
};

type Palette = keyof typeof palettes;

export default function Palettes() {
  const [palette, setPalette] = useState<Palette>("violet");

  return (
    <div className="space-y-5">
      <Tabs
        items={Object.keys(palettes).map((name) => ({
          label: name,
          value: name,
        }))}
        onChange={(value) => setPalette(value as Palette)}
        value={palette}
      />
      <div
        className="space-y-4"
        style={palettes[palette] as React.CSSProperties}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Chip color="primary">Chip</Chip>
          <Chip color="primary" variant="solid">
            Solid chip
          </Chip>
          <Switch defaultChecked label="Switch" />
        </div>
        <Progress aria-label="Upload" value={65} />
        <Alert type="info">Info alerts use the primary color as well.</Alert>
      </div>
    </div>
  );
}

import CodeBlock from "../components/code-block";
import DocPage, { Callout, Prose, Section } from "../components/doc-page";
import Example from "../components/example";
import PropsTable from "../components/props-table";

const overrideCss = `@import "tailwindcss";
@import "components-ui/styles.css";

/* Later @theme declarations win - override any token */
@theme {
  --color-primary-50: oklch(96.9% 0.016 293.756);
  --color-primary-100: oklch(94.3% 0.029 294.588);
  --color-primary-200: oklch(89.4% 0.057 293.283);
  --color-primary-300: oklch(81.1% 0.111 293.571);
  --color-primary-400: oklch(70.2% 0.183 293.541);
  --color-primary-500: oklch(60.6% 0.25 292.717);
  --color-primary-600: oklch(54.1% 0.281 293.009);
  --color-primary-700: oklch(49.1% 0.27 292.581);
  --color-primary-800: oklch(43.2% 0.232 292.759);
  --color-primary-900: oklch(38% 0.189 293.745);
  --color-primary-950: oklch(28.3% 0.141 291.089);

  /* Page background and the surface of cards, dialogs and popovers */
  --color-background: #f8fafc;
  --color-surface: #ffffff;
}`;

const reuseTailwind = `@theme {
  /* Or simply map the scale onto one of Tailwind's palettes */
  --color-primary-500: var(--color-violet-500);
  --color-primary-600: var(--color-violet-600);
  /* … and the other shades */
}`;

const darkClass = `/* Dark mode by a class on <html> instead of the system setting */
@custom-variant dark (&:where(.dark, .dark *));`;

const colorSchemeHook = `import { ColorSchemeToggle, useColorScheme } from "components-ui";

// Somewhere always mounted - the app layout - e.g. in the navbar
<Navbar actions={<ColorSchemeToggle size="sm" />} />

// Or a control of your own
const { colorScheme, resolvedColorScheme, setColorScheme } = useColorScheme();
<Switch
  checked={resolvedColorScheme === "dark"}
  label="Dark mode"
  onChange={(event) => setColorScheme(event.target.checked ? "dark" : "light")}
/>`;

const viteScript = `// vite.config.ts - puts the script into the <head> of index.html
import { getColorSchemeScript } from "components-ui";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "color-scheme",
      transformIndexHtml: () => [
        { tag: "script", children: getColorSchemeScript(), injectTo: "head-prepend" },
      ],
    },
  ],
});`;

const nextScript = `// app/layout.tsx (Next.js) - the script changes <html> before React hydrates it
import { ColorSchemeScript } from "components-ui";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ColorSchemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}`;

const helpers = `<a className="btn" href="/signup">Sign up</a>   /* a link styled as the primary button */
<div className="btn-group">…</div>              /* joins adjacent buttons / fields - ButtonGroup in React */
<div className="rich-text" />                   /* renders the HTML of RichTextEditor */
<input className="form-control" />              /* the look of the library's fields */`;

export default function Theming() {
  return (
    <DocPage
      description="The components are styled with Tailwind classes that read a small set of color tokens. Change the tokens and every component follows."
      title="Theming"
    >
      <Section title="Color tokens">
        <Prose>
          <p>
            Seven scales from 50 to 950 - <code>primary</code> (buttons, focus
            rings, selection), <code>secondary</code>, <code>success</code>,{" "}
            <code>danger</code>, <code>warning</code>, <code>info</code> and{" "}
            <code>neutral</code> - plus <code>background</code> /{" "}
            <code>surface</code> and their <code>-dark</code> variants. They are
            Tailwind theme variables, so they also work in your own classes:{" "}
            <code>bg-primary-500</code>, <code>text-danger-600</code>, …
          </p>
        </Prose>
        <Example collapsed name="theming/tokens" title="The default palette" />
      </Section>

      <Section title="Your brand colors">
        <Prose>
          <p>
            Override the tokens after importing the library's stylesheet. The
            example below does the same on a single element to preview a few
            palettes.
          </p>
        </Prose>
        <CodeBlock code={overrideCss} />
        <CodeBlock className="mt-4" code={reuseTailwind} />
        <Callout>
          <p>
            With the default tokens every text of the components reaches the
            contrast of WCAG AA - 4.5:1 - and focus rings and the parts of
            graphics 3:1: white text sits on shades 600 and darker (500 and
            darker of <code>secondary</code> and <code>neutral</code>), dark
            text on the yellow of <code>warning</code>. A palette of your own
            keeps that when its shades are about as light as the ones they
            replace.
          </p>
        </Callout>
        <Example
          collapsed
          name="theming/palettes"
          title="Previewing palettes"
        />
      </Section>

      <Section title="Dark mode">
        <Prose>
          <p>
            Every component has <code>dark:</code> styles. By default Tailwind
            applies them by the system setting (
            <code>prefers-color-scheme</code>). To switch it in the app - as
            these docs do - use a class:
          </p>
        </Prose>
        <CodeBlock code={darkClass} />
        <Callout>
          <p>
            The <code>dark:</code> classes of the components are generated by
            your Tailwind build, so the variant you configure applies to them
            too.
          </p>
        </Callout>
      </Section>

      <Section title="Color scheme">
        <Prose>
          <p>
            <code>useColorScheme()</code> lets the user choose the scheme -{" "}
            <code>"light"</code>, <code>"dark"</code> or <code>"system"</code> -
            and applies it as the <code>dark</code> class of{" "}
            <code>&lt;html&gt;</code> (with the class variant above) and its{" "}
            <code>color-scheme</code>, which the scrollbars and native controls
            follow. The choice is remembered in <code>localStorage</code> (
            <code>storageKey</code>, <code>"color-scheme"</code> by default) and
            shared by every component using the hook, also across browser tabs;
            while it is <code>"system"</code>, the page follows the system
            setting as it changes. <code>ColorSchemeToggle</code> is the control
            for it - a radio group of three buttons, one tab stop, chosen with
            the arrow keys.
          </p>
        </Prose>
        <Example
          description={
            <p>
              Try it - it switches these docs, like the button in the navbar.
            </p>
          }
          name="theming/color-scheme"
          title="Choosing the scheme"
        />
        <CodeBlock code={colorSchemeHook} />
        <Callout>
          <p>
            Keep a component with the hook mounted all the time - the toggle in
            the navbar - so the page follows the system while the choice is{" "}
            <code>"system"</code>. The value of the hook is the default one
            during server rendering and until the page hydrates.
          </p>
        </Callout>

        <h3 className="mt-8 mb-2 text-lg font-semibold">
          No flash of the wrong scheme
        </h3>
        <Prose>
          <p>
            The hook applies the scheme once the app runs - until then a dark
            page would show light. A small script in the{" "}
            <code>&lt;head&gt;</code> applies the remembered choice before the
            first paint: <code>getColorSchemeScript(options)</code> returns its
            source, and <code>ColorSchemeScript</code> renders it into a
            server-rendered page. Pass them the options of the hook. These docs
            have it in their <code>index.html</code>.
          </p>
        </Prose>
        <CodeBlock code={viteScript} />
        <CodeBlock className="mt-4" code={nextScript} />
        <PropsTable of="ColorSchemeToggle" />
        <PropsTable of="UseColorSchemeResult" title="useColorScheme result" />
      </Section>

      <Section title="Sizes of the app layout">
        <Prose>
          <p>
            The drawer width comes from CSS variables:{" "}
            <code>--drawer-width</code> (240px) and{" "}
            <code>--drawer-collapsed-width</code> (64px).
          </p>
        </Prose>
      </Section>

      <Section title="Helper classes">
        <Prose>
          <p>The stylesheet also defines a few classes for your own markup:</p>
        </Prose>
        <CodeBlock code={helpers} plain />
      </Section>

      <Section title="Adjusting a single component">
        <Prose>
          <p>
            Every component that renders an element of its own accepts{" "}
            <code>className</code>, merged after its own classes - only the
            providers and <code>ErrorBoundary</code>, which wrap your content,
            take none. Where a conflicting utility does not win by the cascade,
            use Tailwind's important modifier (<code>bg-red-500!</code>).
          </p>
        </Prose>
      </Section>
    </DocPage>
  );
}

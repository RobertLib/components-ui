import { Link } from "react-router";
import CodeBlock from "../components/code-block";
import DocPage, { Callout, Prose, Section } from "../components/doc-page";
import Example from "../components/example";
import PropsTable from "../components/props-table";
import routerLinkSource from "../lib/router-link.tsx?raw";
import adapterSource from "../lib/use-react-router-adapter.ts?raw";

const reactRouterUsage = `import { UIProvider } from "components-ui";
import useReactRouterAdapter from "./use-react-router-adapter";

// Inside <BrowserRouter> (or a data router's layout route)
export function Providers({ children }: { children: React.ReactNode }) {
  const router = useReactRouterAdapter();
  return <UIProvider router={router}>{children}</UIProvider>;
}`;

const nextJs = `"use client";
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UIProvider, type LinkComponentProps } from "components-ui";

function Link({ href, ...props }: LinkComponentProps) {
  return <NextLink href={href} {...props} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams(); // needs a <Suspense> above it
  const router = useRouter();
  const search = searchParams.size ? \`?\${searchParams}\` : "";

  return (
    <UIProvider
      router={{
        Link,
        pathname,
        search,
        navigate: (href, options) => {
          // Next.js scrolls to the top on every navigation - but not when
          // only the query changes (the URL state of DataTable)
          const path = href.split(/[?#]/)[0];
          const scroll = path !== "" && path !== pathname;

          if (options?.replace) router.replace(href, { scroll });
          else router.push(href, { scroll });
        },
        back: () => router.back(),
      }}
    >
      {children}
    </UIProvider>
  );
}`;

const nextLayout = `import { Suspense } from "react";
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Suspense>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}`;

const nextSearchProvider = `"use client";
// app/search-params-provider.tsx - the root provider then leaves out search
import { useSearchParams } from "next/navigation";
import { UIProvider } from "components-ui";

// Adds \`search\` to the adapter of the root provider
export function SearchParamsProvider({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const search = searchParams.size ? \`?\${searchParams}\` : "";

  return <UIProvider router={{ search }}>{children}</UIProvider>;
}

// In a page with a DataTable in the URL:
<Suspense>
  <SearchParamsProvider>
    <CustomersTable />
  </SearchParamsProvider>
</Suspense>`;

const tanstack = `// TanStack Router
import { Link as RouterLink, useLocation, useRouter } from "@tanstack/react-router";
import { UIProvider, type LinkComponentProps } from "components-ui";

function Link({ href, ...props }: LinkComponentProps) {
  const router = useRouter();
  // The components pass whole URLs - TanStack's Link takes them apart
  const url = new URL(href, "http://localhost");

  return (
    <RouterLink
      {...props}
      hash={url.hash.slice(1)}
      search={router.options.parseSearch(url.search)}
      to={url.pathname}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const { pathname, searchStr } = useLocation();
  const router = useRouter();

  return (
    <UIProvider
      router={{
        Link,
        pathname,
        search: searchStr,
        navigate: (href, options) => {
          // TanStack Router scrolls to the top on every navigation - but not
          // when only the query changes (the URL state of DataTable)
          const path = href.split(/[?#]/)[0];

          router.navigate({
            href, // a whole URL - \`to\` would take it for a path
            replace: options?.replace,
            resetScroll: path !== "" && path !== pathname,
          });
        },
        back: () => router.history.back(),
      }}
    >
      {children}
    </UIProvider>
  );
}`;

export default function Routing() {
  return (
    <DocPage
      description="The components that link or navigate do it through a small router adapter, so the library works with React Router, Next.js, TanStack Router - or no router at all."
      title="Routing"
    >
      <Section title="Where it is used">
        <Prose>
          <ul>
            <li>
              <strong>Links</strong> - <code>Button link</code>,{" "}
              <code>Breadcrumbs</code>, <code>Tabs</code>, <code>Drawer</code>{" "}
              and <code>Dropdown</code> items render the adapter's{" "}
              <code>Link</code>.
            </li>
            <li>
              <strong>The current location</strong> - <code>Drawer</code>,{" "}
              <code>Tabs</code> and <code>TreeView</code> mark the active item
              by <code>pathname</code> / <code>search</code> (the rule is{" "}
              <code>isActivePath</code>, see{" "}
              <Link to="/guides/utilities">Hooks &amp; utilities</Link>).
            </li>
            <li>
              <strong>Navigation</strong> - the back arrow of{" "}
              <code>Header</code> calls <code>back()</code>; the URL state of{" "}
              <code>DataTable</code> calls <code>navigate()</code>.
            </li>
          </ul>
        </Prose>
        <Example name="routing/demo" title="Everything through one adapter" />
      </Section>

      <Section title="The adapter">
        <PropsTable of="RouterAdapter" />
        <Callout title="Without a router">
          <p>
            Leave <code>router</code> out: links are plain{" "}
            <code>&lt;a&gt;</code> elements (a full page load) and{" "}
            <code>navigate()</code> uses the History API. That is enough for
            server-rendered apps or pages without client routing.
          </p>
        </Callout>
        <Callout title="Pass the location with navigate">
          <p>
            Give <code>pathname</code> and <code>search</code> of your router
            together with <code>navigate</code>. Without them the components
            read the browser URL: they re-read it after each{" "}
            <code>navigate()</code> call and on back / forward, but a URL your
            router changes on its own is noticed only in browsers with the
            Navigation API.
          </p>
        </Callout>
      </Section>

      <Section title="React Router">
        <Prose>
          <p>
            These docs are a React Router app and connect it with these two
            files - copy them into your project:
          </p>
        </Prose>
        <CodeBlock code={routerLinkSource} title="router-link.tsx" />
        <CodeBlock
          className="mt-4"
          code={adapterSource}
          title="use-react-router-adapter.ts"
        />
        <CodeBlock className="mt-4" code={reactRouterUsage} />
        <Callout type="warning">
          <p>
            Define the <code>Link</code> component at module level, never inside
            a component: a component created during render is a new type on
            every render, and React would remount every link.
          </p>
        </Callout>
      </Section>

      <Section title="Next.js">
        <Prose>
          <p>
            For the App Router - a client component with the adapter, rendered
            by the root layout:
          </p>
        </Prose>
        <CodeBlock code={nextJs} title="app/providers.tsx" />
        <CodeBlock className="mt-4" code={nextLayout} title="app/layout.tsx" />
        <Callout title="useSearchParams and static pages" type="warning">
          <p>
            Next.js requires a <code>&lt;Suspense&gt;</code> boundary above a
            component that calls <code>useSearchParams()</code>, and on a
            statically prerendered page everything below that boundary renders
            only in the browser - the prerendered HTML holds just the fallback.
            Around the root providers that is the whole page. Pages rendered on
            request (dynamic ones) are not affected.
          </p>
          <p>
            If your app has static pages, leave <code>search</code> (and{" "}
            <code>useSearchParams</code>) out of the root providers - the
            components then read the query from the browser URL, see{" "}
            <em>Pass the location with navigate</em> above - and add it with a
            nested <code>UIProvider</code> only around the parts that depend on
            the query:
          </p>
        </Callout>
        <CodeBlock code={nextSearchProvider} />
      </Section>

      <Section title="TanStack Router">
        <CodeBlock code={tanstack} />
      </Section>
    </DocPage>
  );
}

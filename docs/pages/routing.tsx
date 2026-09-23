import CodeBlock from "../components/code-block";
import DocPage, { Callout, Prose, Section } from "../components/doc-page";
import Example from "../components/example";
import PropsTable from "../components/props-table";
import routerLinkSource from "../lib/router-link.tsx?raw";
import adapterSource from "../lib/use-react-router-adapter.ts?raw";

const reactRouterUsage = `// Inside <BrowserRouter> (or a data router's layout route)
function Providers({ children }: { children: React.ReactNode }) {
  const router = useReactRouterAdapter();
  return <UIProvider router={router}>{children}</UIProvider>;
}`;

const nextJs = `"use client";
// app/providers.tsx - Next.js App Router
import NextLink from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { UIProvider, type LinkComponentProps } from "components-ui";

function Link({ href, ...props }: LinkComponentProps) {
  return <NextLink href={href} {...props} />;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams(); // wrap <Providers> in <Suspense>
  const router = useRouter();
  const search = searchParams.size ? \`?\${searchParams}\` : "";

  return (
    <UIProvider
      router={{
        Link,
        pathname,
        search,
        navigate: (href, options) =>
          options?.replace ? router.replace(href) : router.push(href),
        back: () => router.back(),
      }}
    >
      {children}
    </UIProvider>
  );
}`;

const tanstack = `// TanStack Router
import { Link as RouterLink, useLocation, useRouter } from "@tanstack/react-router";

function Link({ href, ...props }: LinkComponentProps) {
  return <RouterLink to={href} {...props} />;
}

function Providers({ children }) {
  const { pathname, searchStr } = useLocation();
  const router = useRouter();

  return (
    <UIProvider
      router={{
        Link,
        pathname,
        search: searchStr,
        navigate: (href, options) => router.navigate({ to: href, replace: options?.replace }),
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
              <strong>The current location</strong> - <code>Drawer</code> and{" "}
              <code>Tabs</code> mark the active item by <code>pathname</code> /{" "}
              <code>search</code>.
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
        <CodeBlock code={nextJs} />
      </Section>

      <Section title="TanStack Router">
        <CodeBlock code={tanstack} />
      </Section>
    </DocPage>
  );
}

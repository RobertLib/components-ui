/**
 * Text with `backtick` spans rendered as code - for the JSDoc descriptions
 * coming from the library source.
 */
export default function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);

  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1 ? (
          <code
            className="rounded bg-neutral-200/60 px-1 py-0.5 font-mono text-[0.85em] dark:bg-neutral-800"
            key={index}
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </>
  );
}

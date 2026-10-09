import { Button, ImageViewer, type ImageViewerImage } from "components-ui";
import { useState } from "react";

const TOTAL = 24;
const PAGE_SIZE = 6;
const colors = ["#0f766e", "#1d4ed8", "#b45309", "#7c3aed", "#be123c"];

const photo = (number: number): ImageViewerImage => ({
  alt: `Photo ${number} of the summer camp`,
  src: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><rect width="900" height="600" fill="${colors[number % colors.length]}"/><text x="50%" y="50%" fill="white" font-family="sans-serif" font-size="96" text-anchor="middle" dominant-baseline="middle">${number}</text></svg>`,
  )}`,
});

// A page of the photos of an event - the rest load as the viewer gets to
// them, like the pages of an infinite query
export default function Paged() {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState(() =>
    Array.from({ length: PAGE_SIZE }, (_, index) => photo(index + 1)),
  );

  const loadMore = async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    setPhotos((current) => [
      ...current,
      ...Array.from({ length: PAGE_SIZE }, (_, index) =>
        photo(current.length + index + 1),
      ),
    ]);
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        Open the photos ({photos.length} of {TOTAL} loaded)
      </Button>
      <ImageViewer
        images={photos}
        onLoadMore={loadMore}
        onOpenChange={setOpen}
        open={open}
        thumbnails={false}
        title="Summer camp 2026"
        total={TOTAL}
      />
    </>
  );
}

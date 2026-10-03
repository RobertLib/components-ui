import { Button, ImageViewer } from "components-ui";
import { useState } from "react";

const picture = (color: string, title: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="650" viewBox="0 0 1000 650"><rect width="1000" height="650" fill="${color}"/><path d="M0 650L280 160L560 650M360 650L760 80L1000 650" fill="#ffffff" opacity=".4"/><text x="50" y="90" fill="white" font-family="sans-serif" font-size="48">${title}</text></svg>`)}`;
const images = [
  {
    src: picture("#0f766e", "Mountain"),
    alt: "Two pale mountain peaks on a teal background",
    caption: "Mountain illustration",
  },
  {
    src: picture("#1d4ed8", "Evening"),
    alt: "Two mountain peaks on a blue evening sky",
    caption: "Evening illustration",
  },
  {
    src: picture("#b45309", "Desert"),
    alt: "Two dunes on a warm brown background",
    caption: "Desert illustration",
  },
];

export default function Basic() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open image gallery</Button>
      <ImageViewer
        images={images}
        onOpenChange={setOpen}
        open={open}
        title="Landscapes"
      />
    </>
  );
}

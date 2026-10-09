import { ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { Select } from "components-ui";

// Filters and sorting of a list - the caption inside the field
export default function Prefix() {
  const [sort, setSort] = useState("name");
  const [club, setClub] = useState("");

  return (
    <div className="flex flex-wrap gap-3">
      <Select
        aria-label="Club"
        className="w-44"
        onChange={(event) => setClub(event.target.value)}
        options={[
          { label: "All clubs", value: "" },
          { label: "Karate Beroun", value: "beroun" },
          { label: "Shotokan Hořovice", value: "horovice" },
        ]}
        prefix="Club:"
        value={club}
      />
      <Select
        aria-label="Sort by"
        className="w-40"
        dim="sm"
        onChange={(event) => setSort(event.target.value)}
        options={[
          { label: "Name A–Z", value: "name" },
          { label: "Name Z–A", value: "-name" },
          { label: "Newest", value: "-created" },
        ]}
        prefix={<ArrowDownUp aria-hidden="true" size={14} />}
        value={sort}
      />
    </div>
  );
}

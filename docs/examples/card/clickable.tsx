import { Plus, Star } from "lucide-react";
import { useState } from "react";
import { Card, Chip, IconButton, useSnackbar } from "components-ui";

const projects = [
  { id: 1, name: "Website", status: "On track", tasks: 12 },
  { id: 2, name: "Mobile app", status: "At risk", tasks: 31 },
  { id: 3, name: "Billing", status: "On track", tasks: 4 },
];

export default function Clickable() {
  const { enqueueSnackbar } = useSnackbar();
  const [starred, setStarred] = useState<number[]>([1]);

  return (
    <div className="space-y-6">
      {/* Links - the title is the link, stretched over the card. The star
          stays a button of its own. */}
      <div className="grid gap-4 sm:grid-cols-3">
        {projects.map((project) => {
          const isStarred = starred.includes(project.id);
          return (
            <Card
              actions={
                <IconButton
                  aria-label="Star"
                  aria-pressed={isStarred}
                  color={isStarred ? "primary" : "default"}
                  onClick={() =>
                    setStarred(
                      isStarred
                        ? starred.filter((id) => id !== project.id)
                        : [...starred, project.id],
                    )
                  }
                  size="sm"
                >
                  <Star fill={isStarred ? "currentColor" : "none"} />
                </IconButton>
              }
              description={`${project.tasks} open tasks`}
              href={`#project-${project.id}`}
              key={project.id}
              title={project.name}
            >
              <Chip
                color={project.status === "At risk" ? "warning" : "success"}
                size="sm"
              >
                {project.status}
              </Chip>
            </Card>
          );
        })}
      </div>

      {/* A button - it opens something, here a snackbar */}
      <Card
        border="neutral"
        className="max-w-xs border-dashed shadow-none"
        description="Start from a template or from scratch"
        onClick={() => enqueueSnackbar("New project")}
        title={
          <span className="inline-flex items-center gap-2">
            <Plus aria-hidden="true" size={16} /> New project
          </span>
        }
      />
    </div>
  );
}

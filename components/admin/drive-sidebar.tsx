"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  HardDrive,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

type SidebarItem = { id: string; name: string };

export function DriveSidebar({
  clients,
  projects,
  activeSection,
  activeSectionId,
}: {
  clients: SidebarItem[];
  projects: SidebarItem[];
  activeSection: string | null;
  activeSectionId: string | null;
}) {
  const [clientsOpen, setClientsOpen] = useState(
    activeSection === "client" || clients.length <= 8,
  );
  const [projectsOpen, setProjectsOpen] = useState(
    activeSection === "project" || projects.length <= 8,
  );

  const isRoot = !activeSection;
  const isActiveClient = (id: string) =>
    activeSection === "client" && activeSectionId === id;
  const isActiveProject = (id: string) =>
    activeSection === "project" && activeSectionId === id;

  return (
    <nav className="hidden w-48 shrink-0 space-y-0.5 md:block">
      <Link
        href="/admin/drive"
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          isRoot
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        <HardDrive className="size-4 shrink-0" />
        <span className="truncate">Mi Drive</span>
      </Link>

      <div>
        <button
          type="button"
          onClick={() => setClientsOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Users className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">Clientes</span>
          {clientsOpen ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
        </button>
        {clientsOpen ? (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2.5">
            {clients.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground/60">
                Sin archivos
              </p>
            ) : (
              clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/admin/drive?section=client&id=${client.id}`}
                  className={cn(
                    "block truncate rounded-md px-2 py-1 text-sm transition-colors",
                    isActiveClient(client.id)
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {client.name}
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setProjectsOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <FolderOpen className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">Proyectos</span>
          {projectsOpen ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
        </button>
        {projectsOpen ? (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l pl-2.5">
            {projects.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground/60">
                Sin archivos
              </p>
            ) : (
              projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/drive?section=project&id=${project.id}`}
                  className={cn(
                    "block truncate rounded-md px-2 py-1 text-sm transition-colors",
                    isActiveProject(project.id)
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                >
                  {project.name}
                </Link>
              ))
            )}
          </div>
        ) : null}
      </div>
    </nav>
  );
}

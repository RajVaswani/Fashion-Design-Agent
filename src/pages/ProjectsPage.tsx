import { useState, useEffect, useCallback } from "react";
import AiImproveButton from "@/components/AiImproveButton";
import { Plus, FolderKanban, Loader2, Trash2, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { projectsApi, type Project } from "@/lib/projectsApi";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  concept: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  design: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  realistic: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  complete: "bg-primary/15 text-primary border-primary/30",
};

const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = useCallback(async () => {
    try {
      setProjects(await projectsApi.list());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const p = await projectsApi.create(name.trim(), desc.trim() || undefined);
      setProjects((prev) => [p, ...prev]);
      setName("");
      setDesc("");
      setShowCreate(false);
      toast.success(`Project "${p.name}" created`);
      navigate(`/projects/${p.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await projectsApi.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success("Project deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container py-10 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Design <span className="text-gradient-gold">Projects</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1 font-body">
              Manage your design pipeline from concept to production
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg gradient-gold text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity glow-gold"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {showCreate && (
          <div className="mb-6 p-5 rounded-lg border border-border bg-card animate-fade-in">
            <p className="text-sm font-medium text-foreground mb-3 font-body">Create a new project</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Project name (e.g. SS26 Collection)"
              className="w-full bg-secondary text-foreground text-sm px-4 py-2.5 rounded-lg border border-border outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors font-body mb-2"
            />
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Description (optional)"
              className="w-full bg-secondary text-foreground text-sm px-4 py-2.5 rounded-lg border border-border outline-none placeholder:text-muted-foreground focus:border-primary/50 transition-colors font-body mb-3"
            />
            <div className="flex gap-2">
              <button onClick={handleCreate} disabled={!name.trim()} className="px-4 py-2 rounded-lg gradient-gold text-primary-foreground text-sm font-medium disabled:opacity-50">Create</button>
              <button onClick={() => { setShowCreate(false); setName(""); setDesc(""); }} className="px-4 py-2 rounded-lg border border-border text-foreground text-sm hover:bg-secondary transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {projects.length === 0 && !showCreate ? (
          <div
            onClick={() => setShowCreate(true)}
            className="border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center py-24 cursor-pointer hover:border-primary/40 transition-colors group"
          >
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
              <FolderKanban className="w-7 h-7 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <p className="text-foreground font-medium font-body">Create your first project</p>
            <p className="text-muted-foreground text-sm mt-1 font-body">Go from concept → design → production</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const conceptCount = p.designs.filter((d) => d.stage === "concept").length;
              const designCount = p.designs.filter((d) => d.stage === "design").length;
              const realisticCount = p.designs.filter((d) => d.stage === "realistic").length;
              const previewImgs = p.designs.slice(0, 4);

              return (
                <div
                  key={p.id}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="group relative rounded-lg border border-border bg-card p-5 cursor-pointer hover:border-primary/40 transition-all"
                >
                  {/* Preview grid */}
                  <div className="grid grid-cols-2 gap-1 mb-4 aspect-video rounded-md overflow-hidden bg-secondary">
                    {previewImgs.map((d) => (
                      <img key={d.id} src={d.url} alt={d.prompt} className="w-full h-full object-cover" />
                    ))}
                    {previewImgs.length === 0 && (
                      <div className="col-span-2 flex items-center justify-center">
                        <FolderKanban className="w-8 h-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <h3 className="text-foreground font-medium text-sm font-body truncate">{p.name}</h3>
                      {p.description && (
                        <p className="text-muted-foreground text-xs mt-0.5 font-body truncate">{p.description}</p>
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-body capitalize flex-shrink-0 ml-2 ${statusColors[p.status] || statusColors.concept}`}>
                      {p.status}
                    </span>
                  </div>

                  <div className="flex gap-3 mt-3 text-xs text-muted-foreground font-body">
                    <span>{conceptCount} concepts</span>
                    <span>{designCount} designs</span>
                    <span>{realisticCount} renders</span>
                  </div>

                  <ChevronRight className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />

                  <button
                    onClick={(e) => handleDelete(e, p.id)}
                    className="absolute top-3 right-3 p-1.5 rounded-md text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectsPage;

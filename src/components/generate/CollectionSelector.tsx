import { useState } from "react";
import { Loader2, FolderOpen, Plus, Check } from "lucide-react";
import type { Collection } from "@/types/gallery";
import { collectionsApi } from "@/lib/collectionsApi";
import { toast } from "sonner";

interface CollectionSelectorProps {
  collections: Collection[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  loading: boolean;
  onCollectionCreated: (col: Collection) => void;
}

const CollectionSelector = ({
  collections,
  selectedIds,
  onToggle,
  loading,
  onCollectionCreated,
}: CollectionSelectorProps) => {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const col = await collectionsApi.create(name.trim());
      onCollectionCreated(col);
      setName("");
      setShowCreate(false);
      toast.success(`Collection "${col.name}" created`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create collection");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading collections…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {collections.length === 0 && !showCreate ? (
        <div className="border border-dashed border-border rounded-lg p-4 text-center">
          <FolderOpen className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
          <p className="text-xs text-muted-foreground font-body">No collections yet</p>
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs text-primary mt-1 font-body hover:underline"
          >
            Create one
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {collections.map((col) => {
              const isSelected = selectedIds.includes(col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => onToggle(col.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body transition-all ${
                    isSelected
                      ? "bg-primary/15 border border-primary text-primary"
                      : "border border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  {col.name}
                  <span className="opacity-60">({col.images.length})</span>
                </button>
              );
            })}
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors font-body"
            >
              <Plus className="w-3 h-3" />
              New
            </button>
          </div>
        </>
      )}

      {showCreate && (
        <div className="flex items-center gap-2 animate-fade-in">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Collection name"
            className="flex-1 bg-secondary text-foreground text-xs px-3 py-2 rounded-lg border border-border outline-none placeholder:text-muted-foreground focus:border-primary/50 font-body"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className="px-3 py-2 rounded-lg gradient-gold text-primary-foreground text-xs font-medium disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Create"}
          </button>
          <button
            onClick={() => { setShowCreate(false); setName(""); }}
            className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default CollectionSelector;

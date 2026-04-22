import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Github, Loader2 } from "lucide-react";

type PushStatus = {
  busy: boolean;
  lastResult: { ok: boolean; output: string; finishedAt: string } | null;
};

export function AdminPushButton() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const status = useQuery<PushStatus>({
    queryKey: ["admin-push-status"],
    queryFn: async () => {
      const res = await fetch("/tg-api/admin/push/status", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load push status");
      return res.json();
    },
    refetchInterval: open ? 1500 : false,
  });

  const trigger = useMutation({
    mutationFn: async () => {
      const res = await fetch("/tg-api/admin/push", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Push failed to start");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Push started", description: "Pushing repository to GitHub…" });
      qc.invalidateQueries({ queryKey: ["admin-push-status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Push failed", description: err.message, variant: "destructive" });
    },
  });

  const busy = status.data?.busy || trigger.isPending;
  const last = status.data?.lastResult;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl gap-2"
          data-testid="button-admin-push"
        >
          <Github className="w-4 h-4" />
          <span className="hidden sm:inline">Push to GitHub</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            Push monorepo to GitHub
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Runs <code className="text-xs bg-muted px-1.5 py-0.5 rounded">scripts/push-to-github.sh</code> on
          the server. This force-pushes the entire workspace to{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Noob4udev/Telegram-</code> on
          the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">main</code> branch.
        </p>

        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/40 rounded-lg">
            <Loader2 className="w-4 h-4 animate-spin" />
            Push in progress…
          </div>
        )}

        {last && !busy && (
          <div
            className={`text-xs font-mono p-3 rounded-lg max-h-72 overflow-auto whitespace-pre-wrap border ${
              last.ok
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-destructive/10 border-destructive/30"
            }`}
            data-testid="push-output"
          >
            <div className="mb-2 font-semibold not-italic">
              {last.ok ? "Last push: success" : "Last push: failed"} ·{" "}
              {new Date(last.finishedAt).toLocaleString()}
            </div>
            {last.output || "(no output)"}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => trigger.mutate()}
            disabled={busy}
            className="gap-2"
            data-testid="button-confirm-push"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
            {busy ? "Pushing…" : "Run push now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

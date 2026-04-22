import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, buildUrl } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, CheckCircle, MessageSquare } from "lucide-react";
import type { ReportTemplate } from "@shared/schema";

export default function TemplatesPage() {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [content, setContent] = useState("");

  const { data: templates, isLoading } = useQuery<ReportTemplate[]>({
    queryKey: [api.templates.list.path],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(api.templates.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, content, isDefault: templates?.length === 0 }),
      });
      if (!response.ok) throw new Error("Failed to create template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.templates.list.path] });
      setName("");
      setContent("");
      toast({ title: "Success", description: "Template created successfully" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildUrl(api.templates.setDefault.path, { id }), {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to set default template");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.templates.list.path] });
      toast({ title: "Success", description: "Default template updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(buildUrl(api.templates.delete.path, { id }), {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete template");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.templates.list.path] });
      toast({ title: "Success", description: "Template deleted" });
    },
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Report Templates</h1>
        <p className="text-muted-foreground mt-2">
          Manage message templates used when reporting content.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-primary/10 shadow-lg bg-card/50 backdrop-blur-sm h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              New Template
            </CardTitle>
            <CardDescription>Create a custom message for your reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Anti-Spam"
                value={name}
                onChange={(e) => setName(e.target.value)}
                data-testid="input-template-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-content">Message Content</Label>
              <Textarea
                id="template-content"
                placeholder="The message to send with the report..."
                className="min-height-[150px] resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                data-testid="input-template-content"
              />
            </div>
            <Button
              className="w-full"
              disabled={!name || !content || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              data-testid="button-create-template"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Create Template
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-primary" />
            Saved Templates
          </h2>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
            </div>
          ) : templates?.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No templates found. Create one to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {templates?.map((template) => (
                <Card key={template.id} className={`transition-all ${template.isDefault ? 'border-primary/50 bg-primary/5 shadow-md' : 'hover:border-primary/20'}`}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-lg">{template.name}</h3>
                          {template.isDefault && (
                            <span className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3 italic">
                          "{template.content}"
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!template.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDefaultMutation.mutate(template.id)}
                            disabled={setDefaultMutation.isPending}
                            data-testid={`button-set-default-${template.id}`}
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => deleteMutation.mutate(template.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

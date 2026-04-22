import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, KeyRound, Save, AlertCircle, Fingerprint } from "lucide-react";
import { z } from "zod";

import { useAccounts, useCreateAccount, useDeleteAccount } from "@/hooks/use-accounts";
import { insertTelegramAccountSchema, type InsertTelegramAccount } from "@shared/schema";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const createAccount = useCreateAccount();
  const deleteAccount = useDeleteAccount();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<InsertTelegramAccount>({
    resolver: zodResolver(insertTelegramAccountSchema),
    defaultValues: {
      apiId: "",
      apiHash: "",
      sessionString: "",
    },
  });

  function onSubmit(data: InsertTelegramAccount) {
    createAccount.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false);
        form.reset();
      }
    });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Telegram Accounts</h1>
          <p className="text-muted-foreground mt-1">Manage connected accounts used for reporting.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-semibold shadow-sm hover:shadow-md transition-all gap-2 rounded-xl">
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl border-border/50 shadow-2xl">
            <DialogHeader className="p-6 bg-secondary/30 border-b border-border/50">
              <DialogTitle className="font-display text-xl">Connect Telegram Account</DialogTitle>
              <DialogDescription>
                Enter your API credentials. If the API ID matches an existing account, it will be updated.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField
                    control={form.control}
                    name="apiId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80 font-semibold">API ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 123456" className="rounded-xl bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="apiHash"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80 font-semibold">API Hash</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. a1b2c3d4..." className="rounded-xl bg-background" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="sessionString"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground/80 font-semibold">Session String</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Paste your Pyrogram/Telethon session string here..." 
                          className="min-h-[100px] rounded-xl resize-none bg-background"
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Keep this secure. This grants full access to the Telegram account.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="pt-4 flex justify-end">
                  <Button 
                    type="submit" 
                    disabled={createAccount.isPending}
                    className="w-full sm:w-auto rounded-xl gap-2 font-semibold shadow-sm"
                  >
                    {createAccount.isPending ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {createAccount.isPending ? "Saving..." : "Save Account"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="rounded-2xl border-border/50 shadow-sm p-6 space-y-4">
              <Skeleton className="h-6 w-1/3 rounded-md" />
              <Skeleton className="h-4 w-2/3 rounded-md" />
              <Skeleton className="h-10 w-full rounded-xl mt-4" />
            </Card>
          ))}
        </div>
      ) : accounts?.length === 0 ? (
        <Card className="rounded-3xl border-dashed border-2 border-border bg-secondary/20 shadow-none text-center p-12 hover:bg-secondary/40 transition-colors">
          <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-border/50">
            <KeyRound className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="font-display text-xl mb-2">No Accounts Found</CardTitle>
          <CardDescription className="max-w-sm mx-auto mb-6">
            You haven't connected any Telegram accounts yet. Add an account to start submitting reports.
          </CardDescription>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="rounded-xl shadow-sm bg-background">
            <Plus className="w-4 h-4 mr-2" />
            Connect First Account
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts?.map((account) => (
            <Card 
              key={account.id} 
              className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden bg-card"
            >
              <CardHeader className="bg-secondary/30 border-b border-border/50 pb-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                      <Fingerprint className="w-5 h-5 text-primary/70" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-display">Account #{account.id}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-0.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                        Active
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API ID</p>
                  <p className="text-sm font-medium font-mono bg-secondary/50 py-1.5 px-2.5 rounded-lg border border-border/30 truncate">
                    {account.apiId}
                  </p>
                </div>
                <Button 
                  variant="destructive" 
                  className="w-full rounded-xl gap-2 font-semibold opacity-90 group-hover:opacity-100 transition-opacity"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this account?")) {
                      deleteAccount.mutate(account.id);
                    }
                  }}
                  disabled={deleteAccount.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Account
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

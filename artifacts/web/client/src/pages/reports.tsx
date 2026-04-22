import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ShieldAlert, Send, Activity, Link as LinkIcon, Hash, CheckCircle2, Clock, XCircle, Gauge, Zap } from "lucide-react";
import { z } from "zod";

import { useReports, useCreateReport } from "@/hooks/use-reports";
import { useAccounts } from "@/hooks/use-accounts";
import { insertReportSchema, type InsertReport } from "@shared/schema";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableBody
} from "@/components/ui/table";

const REPORT_TYPES = [
  { value: "spam", label: "Spam" },
  { value: "fake", label: "Fake Account" },
  { value: "violence", label: "Violence" },
  { value: "child_abuse", label: "Child Abuse" },
  { value: "copyright", label: "Copyright" },
  { value: "pornography", label: "Pornography" },
  { value: "personal_details", label: "Personal Details" },
  { value: "illegal_drugs", label: "Illegal Drugs" },
  { value: "other", label: "Other" },
];

export default function ReportsPage() {
  const { data: reports, isLoading: reportsLoading } = useReports();
  const { data: accounts } = useAccounts();
  const createReport = useCreateReport();

  // Extend schema to ensure volume is parsed to a number
  const formSchema = insertReportSchema.extend({
    reportCount: z.coerce.number().min(1, "Must be at least 1"),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetLink: "",
      reportType: "spam",
      reportCount: 1,
      speed: "normal",
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    createReport.mutate(data, {
      onSuccess: () => {
        form.reset({
          ...form.getValues(),
          targetLink: "", // clear only the link after success
        });
      }
    });
  }

  const activeAccountsCount = accounts?.filter(a => a.status === 'active').length || 0;
  const totalVolumePotential = activeAccountsCount * (form.watch("reportCount") || 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-200/50 gap-1 rounded-md px-2 py-0.5"><CheckCircle2 className="w-3 h-3" /> Completed</Badge>;
      case "in_progress":
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-200/50 gap-1 rounded-md px-2 py-0.5"><Activity className="w-3 h-3 animate-pulse" /> Running</Badge>;
      case "failed":
        return <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-200/50 gap-1 rounded-md px-2 py-0.5"><XCircle className="w-3 h-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline" className="gap-1 rounded-md px-2 py-0.5"><Clock className="w-3 h-3 text-muted-foreground" /> Pending</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Report Jobs</h1>
        <p className="text-muted-foreground mt-1">Submit mass reports utilizing all connected accounts.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Form Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-2xl border-border/50 shadow-lg shadow-black/5 overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-primary/90 p-1"></div>
            <CardHeader className="bg-secondary/30 border-b border-border/50">
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                New Report Job
              </CardTitle>
              <CardDescription>
                Configure the target and reporting parameters.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="targetLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80 font-semibold flex items-center gap-2">
                          <LinkIcon className="w-4 h-4 text-muted-foreground" />
                          Target Link or Username
                        </FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. t.me/channel, t.me/channel/123, or @username" 
                            className="rounded-xl bg-background" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription className="text-[10px] text-muted-foreground px-1">
                          Supports channel links, specific message links, and usernames.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reportType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80 font-semibold flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 text-muted-foreground" />
                          Reason
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger className="rounded-xl bg-background">
                              <SelectValue placeholder="Select reason" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border-border/50 shadow-xl">
                            {REPORT_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value} className="rounded-lg cursor-pointer">
                                {type.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="reportCount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80 font-semibold flex items-center gap-2">
                          <Hash className="w-4 h-4 text-muted-foreground" />
                          Reports per Account
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1"
                            className="rounded-xl bg-background" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription className="text-xs mt-2 flex items-start gap-2 bg-secondary/50 p-3 rounded-lg border border-border/50">
                          <Activity className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                          <span>
                            With <strong>{activeAccountsCount}</strong> active accounts, this will generate 
                            a total of <strong>{totalVolumePotential}</strong> reports.
                          </span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="speed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-foreground/80 font-semibold">Speed Mode</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => field.onChange("normal")}
                              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                field.value === "normal"
                                  ? "border-primary bg-primary/5 text-primary"
                                  : "border-border bg-background text-muted-foreground hover:border-border/80"
                              }`}
                            >
                              <Gauge className="w-5 h-5" />
                              <div className="text-center">
                                <p className="text-sm font-semibold">Normal</p>
                                <p className="text-[10px] leading-tight opacity-70">Sequential, 2s delay</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => field.onChange("fast")}
                              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                field.value === "fast"
                                  ? "border-amber-500 bg-amber-500/5 text-amber-600"
                                  : "border-border bg-background text-muted-foreground hover:border-border/80"
                              }`}
                            >
                              <Zap className="w-5 h-5" />
                              <div className="text-center">
                                <p className="text-sm font-semibold">Fast</p>
                                <p className="text-[10px] leading-tight opacity-70">Parallel, no delay</p>
                              </div>
                            </button>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button 
                    type="submit" 
                    disabled={createReport.isPending || activeAccountsCount === 0}
                    className="w-full rounded-xl py-6 text-base font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5 transition-all gap-2"
                  >
                    {createReport.isPending ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {activeAccountsCount === 0 ? "No Active Accounts" : createReport.isPending ? "Starting Job..." : "Launch Report Job"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* History Column */}
        <div className="lg:col-span-7">
          <Card className="rounded-2xl border-border/50 shadow-sm h-full flex flex-col">
            <CardHeader className="bg-secondary/30 border-b border-border/50 pb-4">
              <CardTitle className="font-display text-xl">Job History</CardTitle>
              <CardDescription>Recent report actions and their status.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              {reportsLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : reports?.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-12 h-full min-h-[300px] text-muted-foreground">
                  <Activity className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium text-foreground">No jobs yet</p>
                  <p className="text-sm">Submit your first report job to see it here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold">Target</TableHead>
                        <TableHead className="font-semibold">Reason</TableHead>
                        <TableHead className="font-semibold text-center">Vol.</TableHead>
                        <TableHead className="font-semibold text-center">Progress</TableHead>
                        <TableHead className="font-semibold text-center">Status</TableHead>
                        <TableHead className="font-semibold text-right">Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports?.slice().reverse().map((report) => (
                        <TableRow key={report.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-medium max-w-[150px] truncate" title={report.targetLink}>
                            {report.targetLink}
                          </TableCell>
                          <TableCell className="text-muted-foreground capitalize text-sm">
                            {report.reportType.replace('_', ' ')}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            {report.reportCount}
                          </TableCell>
                          <TableCell className="text-center font-mono text-sm">
                            <span className="text-emerald-500" title="Successful">{report.successfulCount || 0}</span> / <span className="text-destructive" title="Failed">{report.failedCount || 0}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            {getStatusBadge(report.status)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                            {report.createdAt ? format(new Date(report.createdAt), 'MMM d, HH:mm') : 'N/A'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}

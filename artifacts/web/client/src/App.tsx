import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Menu, LogOut, ShieldCheck } from "lucide-react";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import AccountsPage from "@/pages/accounts";
import ReportsPage from "@/pages/reports";
import TemplatesPage from "@/pages/templates";
import SessionStringPage from "@/pages/session-string";
import LoginPage from "@/pages/login";
import { AppSidebar } from "@/components/app-sidebar";
import { useMe, useLogout } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { AdminPushButton } from "@/components/admin-push-button";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AccountsPage}/>
      <Route path="/reports" component={ReportsPage}/>
      <Route path="/templates" component={TemplatesPage}/>
      <Route path="/session-string" component={SessionStringPage}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function Shell() {
  const { data, isLoading } = useMe();
  const logout = useLogout();

  if (isLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const user = data?.user;
  if (!user) return <LoginPage />;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    (user.username ? `@${user.username}` : `User ${user.telegramUserId}`);

  const style = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20">
        <AppSidebar />
        <div className="flex flex-col flex-1 relative z-10 w-full overflow-hidden">
          <header className="h-16 flex items-center justify-between px-4 sm:px-8 border-b border-border/50 bg-background/80 backdrop-blur-lg sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="md:hidden">
                <div className="p-2 bg-secondary rounded-lg text-foreground hover:bg-secondary/80 transition-colors cursor-pointer">
                  <Menu className="w-5 h-5" />
                </div>
              </SidebarTrigger>
            </div>
            <div className="flex items-center gap-3">
              {user.isAdmin && (
                <>
                  <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest bg-primary/10 text-primary px-2 py-1 rounded-full inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Admin
                  </span>
                  <AdminPushButton />
                </>
              )}
              <div className="hidden sm:flex flex-col text-right leading-tight">
                <span className="text-sm font-semibold text-foreground">{displayName}</span>
                {user.username && (
                  <span className="text-xs text-muted-foreground">@{user.username}</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl gap-2"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Log out</span>
              </Button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-8">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Shell />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

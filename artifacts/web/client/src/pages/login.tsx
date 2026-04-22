import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, Activity, ExternalLink, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useStartVerify, pollVerify } from "@/hooks/use-auth";
import { api } from "@shared/routes";

type Phase = "idle" | "waiting" | "success" | "error";

export default function LoginPage() {
  const startVerify = useStartVerify();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [deepLink, setDeepLink] = useState<string>("");
  const [error, setError] = useState<string>("");
  const tokenRef = useRef<string>("");
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  function stopPolling() {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }

  async function startFlow() {
    setError("");
    setPhase("waiting");
    try {
      const r = await startVerify.mutateAsync();
      tokenRef.current = r.token;
      setDeepLink(r.deepLink);
      // Open the bot deep link in a new tab
      window.open(r.deepLink, "_blank", "noopener,noreferrer");
      // Begin polling
      stopPolling();
      pollTimer.current = setInterval(async () => {
        try {
          const result = await pollVerify(tokenRef.current);
          if (!result.pending) {
            stopPolling();
            setPhase("success");
            await qc.invalidateQueries({ queryKey: [api.auth.me.path] });
          }
        } catch (e: any) {
          stopPolling();
          setPhase("error");
          setError(e?.message || "Verification failed");
        }
      }, 2000);
    } catch (e: any) {
      setPhase("error");
      setError(e?.message || "Failed to start verification");
    }
  }

  function reset() {
    stopPolling();
    tokenRef.current = "";
    setDeepLink("");
    setError("");
    setPhase("idle");
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md rounded-2xl border-border/50 shadow-lg overflow-hidden">
        <CardHeader className="bg-secondary/30 border-b border-border/50 text-center pb-6">
          <div className="mx-auto bg-primary text-primary-foreground p-3 rounded-2xl shadow-sm w-fit mb-3">
            <Activity className="w-6 h-6" />
          </div>
          <CardTitle className="font-display text-2xl">TeleGuard</CardTitle>
          <CardDescription>Sign in with your Telegram account to continue.</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {phase === "idle" && (
            <>
              <p className="text-sm text-muted-foreground">
                Click the button below. We'll open our Telegram bot — just press <b>Start</b> there
                and we'll log you in automatically.
              </p>
              <Button
                className="w-full rounded-xl gap-2 h-11 font-semibold"
                onClick={startFlow}
                disabled={startVerify.isPending}
              >
                {startVerify.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Verify with Telegram
              </Button>
            </>
          )}

          {phase === "waiting" && (
            <>
              <div className="flex items-center gap-3 p-4 bg-secondary/40 rounded-xl border border-border/50">
                <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-semibold text-foreground">Waiting for Telegram…</div>
                  <div className="text-muted-foreground">
                    Open the bot and press <b>Start</b>. We'll log you in as soon as you do.
                  </div>
                </div>
              </div>
              {deepLink && (
                <a href={deepLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="w-full rounded-xl gap-2 h-11">
                    <ExternalLink className="w-4 h-4" />
                    Open the Telegram bot
                  </Button>
                </a>
              )}
              <Button variant="ghost" className="w-full rounded-xl gap-2" onClick={reset}>
                <RefreshCw className="w-4 h-4" />
                Cancel
              </Button>
            </>
          )}

          {phase === "success" && (
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-semibold text-foreground">Verified!</div>
                <div className="text-muted-foreground">Signing you in…</div>
              </div>
            </div>
          )}

          {phase === "error" && (
            <>
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <Button onClick={reset} className="w-full rounded-xl">Try again</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

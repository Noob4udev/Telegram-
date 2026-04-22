import { useMemo, useState } from "react";
import { ChevronsUpDown, Check, Copy, KeyRound, Loader2, Save, ShieldCheck, RefreshCw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { COUNTRIES, flagEmoji, type Country } from "@/lib/countries";
import { apiRequest } from "@/lib/queryClient";
import { api as routes } from "@shared/routes";
import { cn } from "@/lib/utils";

type Step = "phone" | "code" | "password" | "done";

const DEFAULT_COUNTRY = COUNTRIES.find((c) => c.iso2 === "US") || COUNTRIES[0];

export default function SessionStringPage() {
  const { toast } = useToast();
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [openCountry, setOpenCountry] = useState(false);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  const [step, setStep] = useState<Step>("phone");
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionString, setSessionString] = useState<string>("");
  const [savedPhone, setSavedPhone] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const fullPhone = useMemo(() => {
    const digits = phoneLocal.replace(/\D/g, "");
    return `${country.dialCode}${digits}`;
  }, [country, phoneLocal]);

  function reset() {
    setStep("phone");
    setSessionId("");
    setSessionString("");
    setSavedPhone("");
    setCode("");
    setPassword("");
    setError("");
  }

  async function callApi<T>(url: string, body: unknown): Promise<T> {
    const res = await apiRequest("POST", url, body);
    return (await res.json()) as T;
  }

  async function startFlow(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!phoneLocal.replace(/\D/g, "")) {
      setError("Please enter a phone number.");
      return;
    }
    setLoading(true);
    try {
      const r = await callApi<{ sessionId: string }>(routes.session.start.path, {
        phoneNumber: fullPhone,
      });
      setSessionId(r.sessionId);
      setStep("code");
      toast({ title: "Code sent", description: `Telegram sent a code to ${fullPhone}.` });
    } catch (err: any) {
      setError(err?.message || "Failed to send code.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("Enter the code Telegram sent you.");
      return;
    }
    setLoading(true);
    try {
      const r = await callApi<
        | { needs2FA: true }
        | { needs2FA: false; sessionString: string; phoneNumber: string }
      >(routes.session.verifyCode.path, { sessionId, code: code.trim() });

      if (r.needs2FA) {
        setStep("password");
        toast({
          title: "2FA required",
          description: "This account is protected with a password.",
        });
      } else {
        setSessionString(r.sessionString);
        setSavedPhone(r.phoneNumber);
        setStep("done");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid code.");
    } finally {
      setLoading(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Enter your 2FA password.");
      return;
    }
    setLoading(true);
    try {
      const r = await callApi<{ sessionString: string; phoneNumber: string }>(
        routes.session.verifyPassword.path,
        { sessionId, password }
      );
      setSessionString(r.sessionString);
      setSavedPhone(r.phoneNumber);
      setStep("done");
    } catch (err: any) {
      setError(err?.message || "Incorrect password.");
    } finally {
      setLoading(false);
    }
  }

  async function saveSession() {
    setSaveBusy(true);
    try {
      await callApi(routes.session.save.path, {
        sessionString,
        phoneNumber: savedPhone,
      });
      toast({
        title: "Account saved",
        description: "This session was saved and will be used by the app.",
      });
      reset();
    } catch (err: any) {
      toast({
        title: "Save failed",
        description: err?.message || "Could not save session.",
        variant: "destructive" as any,
      });
    } finally {
      setSaveBusy(false);
    }
  }

  function dontSave() {
    toast({ title: "Discarded", description: "Session string was not saved." });
    reset();
  }

  function copySession() {
    navigator.clipboard.writeText(sessionString).then(() => {
      toast({ title: "Copied", description: "Session string copied to clipboard." });
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <KeyRound className="w-7 h-7 text-primary" />
          Session String Generator
        </h1>
        <p className="text-muted-foreground mt-1">
          Use Telegram Desktop's official credentials to generate a session string from your phone number.
        </p>
      </div>

      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <CardHeader className="bg-secondary/30 border-b border-border/50">
          <CardTitle className="font-display text-lg">
            {step === "phone" && "Step 1 — Phone number"}
            {step === "code" && "Step 2 — Enter the code"}
            {step === "password" && "Step 3 — 2FA password"}
            {step === "done" && "Done — your session string"}
          </CardTitle>
          <CardDescription>
            {step === "phone" && "Pick your country, then enter your phone number."}
            {step === "code" && "Open Telegram and copy the code we just sent you."}
            {step === "password" && "This account has Two-Step Verification enabled."}
            {step === "done" && "Keep this secret. Anyone with it has full access to your Telegram account."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          {error && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === "phone" && (
            <form onSubmit={startFlow} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Country</Label>
                <Popover open={openCountry} onOpenChange={setOpenCountry}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between rounded-xl bg-background h-11"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-xl leading-none">{flagEmoji(country.iso2)}</span>
                        <span className="font-medium">{country.name}</span>
                        <span className="text-muted-foreground">{country.dialCode}</span>
                      </span>
                      <ChevronsUpDown className="opacity-50 w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]">
                    <Command>
                      <CommandInput placeholder="Search country..." />
                      <CommandList>
                        <CommandEmpty>No country found.</CommandEmpty>
                        <CommandGroup>
                          {COUNTRIES.map((c) => (
                            <CommandItem
                              key={c.iso2 + c.dialCode}
                              value={`${c.name} ${c.dialCode}`}
                              onSelect={() => {
                                setCountry(c);
                                setOpenCountry(false);
                              }}
                            >
                              <span className="text-xl leading-none mr-2">{flagEmoji(c.iso2)}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-muted-foreground mr-2">{c.dialCode}</span>
                              <Check className={cn("w-4 h-4", country.iso2 === c.iso2 && country.dialCode === c.dialCode ? "opacity-100" : "opacity-0")} />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Phone number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2 px-3 rounded-xl border border-input bg-background text-sm font-medium min-w-[100px] justify-center">
                    <span className="text-xl leading-none">{flagEmoji(country.iso2)}</span>
                    <span>{country.dialCode}</span>
                  </div>
                  <Input
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="Phone number"
                    className="rounded-xl bg-background h-11"
                    value={phoneLocal}
                    onChange={(e) => setPhoneLocal(e.target.value)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  We will request a login code from Telegram for {fullPhone || country.dialCode}.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={loading} className="rounded-xl gap-2 font-semibold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Send code
                </Button>
              </div>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={submitCode} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Login code</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="12345"
                  className="rounded-xl bg-background h-11 tracking-widest text-lg"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Sent via Telegram to {fullPhone}.
                </p>
              </div>
              <div className="flex justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={reset} className="rounded-xl gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Start over
                </Button>
                <Button type="submit" disabled={loading} className="rounded-xl gap-2 font-semibold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Verify
                </Button>
              </div>
            </form>
          )}

          {step === "password" && (
            <form onSubmit={submitPassword} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">2FA password</Label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="Your Two-Step Verification password"
                  className="rounded-xl bg-background h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Only your password is needed; the code has already been verified.
                </p>
              </div>
              <div className="flex justify-between gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={reset} className="rounded-xl gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Start over
                </Button>
                <Button type="submit" disabled={loading} className="rounded-xl gap-2 font-semibold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Submit password
                </Button>
              </div>
            </form>
          )}

          {step === "done" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground/80 font-semibold">Session string</Label>
                <textarea
                  readOnly
                  value={sessionString}
                  className="w-full min-h-[140px] rounded-xl bg-background border border-input p-3 text-xs font-mono break-all"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" onClick={copySession} className="rounded-xl gap-2">
                  <Copy className="w-4 h-4" />
                  Copy
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={dontSave}
                  className="rounded-xl gap-2 h-11"
                  disabled={saveBusy}
                >
                  Don't save
                </Button>
                <Button
                  type="button"
                  onClick={saveSession}
                  disabled={saveBusy}
                  className="rounded-xl gap-2 font-semibold h-11"
                >
                  {saveBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save & use this account
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";

export interface AuthUser {
  id: number;
  telegramUserId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  isAdmin: boolean;
}

export function useMe() {
  return useQuery<{ user: AuthUser | null }>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (!res.ok) return { user: null };
      return res.json();
    },
    refetchOnWindowFocus: true,
  });
}

export function useStartVerify() {
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.start.path, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ message: "Failed to start verify" }));
        throw new Error(e.message || "Failed to start verify");
      }
      return (await res.json()) as { token: string; deepLink: string; botUsername: string };
    },
  });
}

export async function pollVerify(token: string) {
  const res = await fetch(`${api.auth.poll.path}?token=${encodeURIComponent(token)}`, {
    credentials: "include",
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({ message: "Verify failed" }));
    throw new Error(e.message || "Verify failed");
  }
  return (await res.json()) as
    | { pending: true }
    | { pending: false; user: AuthUser };
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, { method: "POST", credentials: "include" });
    },
    onSuccess: () => {
      qc.clear();
      qc.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
  });
}

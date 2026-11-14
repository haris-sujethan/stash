"use client";
// The approver secret lives only in this tab's memory (React state): never localStorage, never a cookie,
// never a .env file (ADR 0004). Every approver request sends it; the server checks it each time.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

interface Approver {
  unlocked: boolean;
  /** Runs fetch with the secret, asking for it first if needed. Returns the error message, or null. */
  act: (path: string) => Promise<string | null>;
  lock: () => void;
}

const Ctx = createContext<Approver | null>(null);

export function ApproverProvider({ projectId, children }: { projectId: string | null; children: ReactNode }) {
  const secret = useRef<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<((s: string | null) => void) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const ask = () =>
    new Promise<string | null>((resolve) => {
      pending.current = resolve;
      setError(null);
      dialog.current?.showModal();
      setTimeout(() => input.current?.focus(), 0);
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = input.current?.value ?? "";
    if (!value || !projectId) return;
    setChecking(true);
    const res = await fetch("/api/approver/check", {
      method: "POST",
      headers: { "content-type": "application/json", "x-approver-secret": value },
      body: JSON.stringify({ projectId }),
    });
    setChecking(false);
    if (!res.ok) {
      setError("That isn't the approver secret.");
      input.current?.select();
      return;
    }
    secret.current = value;
    setUnlocked(true);
    if (input.current) input.current.value = "";
    dialog.current?.close();
    pending.current?.(value);
    pending.current = null;
  };

  const cancel = () => {
    dialog.current?.close();
    pending.current?.(null);
    pending.current = null;
  };

  const act = useCallback(async (path: string) => {
    const s = secret.current ?? (await ask());
    if (!s) return "Cancelled.";
    const res = await fetch(path, { method: "POST", headers: { "x-approver-secret": s } });
    if (res.status === 401) {
      secret.current = null;
      setUnlocked(false);
      return "The approver secret was rejected. Try again.";
    }
    if (!res.ok) return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? `Failed (${res.status}).`;
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lock = () => {
    secret.current = null;
    setUnlocked(false);
  };

  return (
    <Ctx.Provider value={{ unlocked, act, lock }}>
      {children}
      <dialog ref={dialog} className="approver" onCancel={cancel} aria-labelledby="approver-title">
        <form onSubmit={submit}>
          <h2 id="approver-title">Approver secret</h2>
          <p>Only a human with the approver secret can approve or reject Guardrails and verify Memories. It stays in this tab and is forgotten when you close it.</p>
          <label className="field">
            <span className="visually-hidden">Approver secret</span>
            <input ref={input} type="password" autoComplete="off" placeholder="Approver secret" required />
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          <div className="actions">
            <button className="btn" type="submit" disabled={checking}>{checking ? "Checking…" : "Unlock"}</button>
            <button className="btn btn--line" type="button" onClick={cancel}>Cancel</button>
          </div>
        </form>
      </dialog>
    </Ctx.Provider>
  );
}

export function useApprover(): Approver {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApprover outside ApproverProvider");
  return v;
}

export function LockState() {
  const { unlocked, lock } = useApprover();
  return unlocked ? (
    <button type="button" className="lock is-on btn btn--line" onClick={lock} title="Forget the approver secret">Approver unlocked · lock</button>
  ) : (
    <span className="lock">Approvals locked</span>
  );
}

/** A button that runs one approver action and refreshes the page. */
export function ApproverButton({ path, label, variant = "solid" }: { path: string; label: string; variant?: "solid" | "line" }) {
  const { act } = useApprover();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={variant === "line" ? "btn btn--line" : "btn"}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const err = await act(path);
          setBusy(false);
          setError(err === "Cancelled." ? null : err);
          if (!err) router.refresh();
        }}
      >
        {busy ? "…" : label}
      </button>
      {error && <span className="err" role="alert">{error}</span>}
    </>
  );
}

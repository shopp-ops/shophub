"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  shopsApi,
  getShopCredentials,
  CredentialsError,
  type AdminCredentials,
  type CreateShopResult,
  type Shop,
  type WalletCredentials,
} from "@/lib/api/shops";
import { CredentialsModal } from "@/components/admin-credentials-modal";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── schemas ────────────────────────────────────────────────────────────────

const createSchema = z
  .object({
    name: z.string().min(2, "At least 2 characters"),
    adminEmail: z.string().email("Valid email required"),
    availabilityTier: z.enum(["standard", "high"]),
    autoGenerateWallet: z.boolean(),
    walletAddress: z.string(),
    databaseType: z.enum(["standard", "light"]),
  })
  .refine((d) => d.autoGenerateWallet || d.walletAddress.trim().length > 0, {
    message: "Required",
    path: ["walletAddress"],
  });

const editSchema = z.object({
  availabilityTier: z.enum(["standard", "high"]),
  walletAddress: z.string().min(1, "Required"),
  databaseType: z.enum(["standard", "light"]),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;

// ─── constants ───────────────────────────────────────────────────────────────

const TERMINAL = new Set(["Ready", "Failed", "Degraded"]);

// ─── helpers ─────────────────────────────────────────────────────────────────

function StatusPill({ phase, reason }: { phase: string; reason: string | null }) {
  const colourCls =
    phase === "Ready"
      ? "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400"
      : phase === "Failed" || phase === "Degraded"
        ? "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400"
        : "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400";
  return (
    <span
      title={reason ?? ""}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colourCls}`}
    >
      {phase || "Unknown"}
    </span>
  );
}

function TierSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="standard">Standard</SelectItem>
        <SelectItem value="high">High</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DbSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="standard">Standard (PostgreSQL)</SelectItem>
        <SelectItem value="light">Light (MongoDB)</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ─── create dialog ───────────────────────────────────────────────────────────

function CreateShopDialog({
  open,
  onOpenChange,
  onCreated,
  token,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (result: CreateShopResult) => void;
  token: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      adminEmail: "",
      availabilityTier: "standard",
      autoGenerateWallet: true,
      walletAddress: "",
      databaseType: "standard",
    },
  });
  const autoGenerateWallet = watch("autoGenerateWallet");

  async function onSubmit(data: CreateFormData) {
    setServerError(null);
    try {
      const result = await shopsApi.create(token, {
        name: data.name,
        adminEmail: data.adminEmail,
        availabilityTier: data.availabilityTier,
        databaseType: data.databaseType,
        ...(data.autoGenerateWallet ? {} : { walletAddress: data.walletAddress.trim() }),
      });
      onCreated(result);
      reset();
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to create shop");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New shop</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <Controller
            name="name"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="c-name">Name</FieldLabel>
                <Input {...field} id="c-name" placeholder="my-shop" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="adminEmail"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="c-admin-email">Admin email</FieldLabel>
                <Input
                  {...field}
                  id="c-admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  aria-invalid={fieldState.invalid}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="availabilityTier"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Availability tier</FieldLabel>
                <TierSelect value={field.value} onChange={field.onChange} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="autoGenerateWallet"
            control={control}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
                Auto-generate wallet
              </label>
            )}
          />
          {!autoGenerateWallet && (
            <Controller
              name="walletAddress"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="c-wallet">Wallet address</FieldLabel>
                  <Input {...field} id="c-wallet" placeholder="0x…" aria-invalid={fieldState.invalid} />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          )}
          <Controller
            name="databaseType"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Database type</FieldLabel>
                <DbSelect value={field.value} onChange={field.onChange} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create shop"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── edit dialog ─────────────────────────────────────────────────────────────

function EditShopDialog({
  shop,
  open,
  onOpenChange,
  onUpdated,
  token,
}: {
  shop: Shop;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated: (shop: Shop) => void;
  token: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { control, handleSubmit, reset, formState: { isSubmitting } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      availabilityTier: shop.availabilityTier,
      walletAddress: shop.walletAddress ?? "",
      databaseType: shop.databaseType,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        availabilityTier: shop.availabilityTier,
        walletAddress: shop.walletAddress ?? "",
        databaseType: shop.databaseType,
      });
      setServerError(null);
    }
  }, [open, shop, reset]);

  async function onSubmit(data: EditFormData) {
    setServerError(null);
    try {
      const updated = await shopsApi.update(token, shop.id, data);
      onUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Failed to update shop");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {shop.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <Controller
            name="availabilityTier"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Availability tier</FieldLabel>
                <TierSelect value={field.value} onChange={field.onChange} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="walletAddress"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="e-wallet">Wallet address</FieldLabel>
                <Input {...field} id="e-wallet" aria-invalid={fieldState.invalid} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="databaseType"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Database type</FieldLabel>
                <DbSelect value={field.value} onChange={field.onChange} />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── delete dialog ───────────────────────────────────────────────────────────

function DeleteShopDialog({
  shop,
  open,
  onOpenChange,
  onDeleted,
  token,
}: {
  shop: Shop;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: (id: string) => void;
  token: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setError(null);
    setIsDeleting(true);
    try {
      await shopsApi.remove(token, shop.id);
      onDeleted(shop.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete shop");
      setIsDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{shop.name}&rdquo;?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the shop deployment. This action cannot be undone.
        </p>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" type="button">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── shop card ───────────────────────────────────────────────────────────────

const TIER_LABELS: Record<Shop["availabilityTier"], string> = {
  standard: "Standard",
  high: "High",
};

const DB_LABELS: Record<Shop["databaseType"], string> = {
  standard: "PostgreSQL",
  light: "MongoDB",
};

function Chip({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={
        accent
          ? "inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary"
          : "inline-flex items-center rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

function ShopCard({
  shop,
  onEdit,
  onDelete,
}: {
  shop: Shop;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{shop.name}</CardTitle>
          <span className="mt-0.5 shrink-0">
            <StatusPill phase={shop.phase} reason={shop.statusReason} />
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Chip accent={shop.availabilityTier === "high"}>
            {TIER_LABELS[shop.availabilityTier]}
          </Chip>
          <Chip>{DB_LABELS[shop.databaseType]}</Chip>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-4">
        <div>
          <p className="mb-0.5 text-xs font-medium text-muted-foreground">Wallet</p>
          <p className="truncate font-mono text-xs">
            {shop.walletAddress ?? <span className="not-italic text-muted-foreground">Pending…</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {/* Storefront URL — enabled once the shop is Ready and the operator has set status.url */}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            disabled={shop.phase !== "Ready" || !shop.url}
            title={
              shop.url
                ? shop.phase === "Ready"
                  ? shop.url
                  : "Available once the shop is Ready"
                : "Storefront URL not assigned yet"
            }
            onClick={() => {
              if (shop.url) window.open(shop.url, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink />
            Visit
          </Button>
          <Button variant="outline" size="icon-sm" onClick={onEdit} aria-label="Edit shop">
            <Pencil />
          </Button>
          <Button variant="destructive" size="icon-sm" onClick={onDelete} aria-label="Delete shop">
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── skeleton cards ───────────────────────────────────────────────────────────

function ShopCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="h-4 w-16 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
        <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="space-y-1.5 pt-1">
        <div className="h-3 w-10 animate-pulse rounded bg-muted" />
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex gap-2 pt-1">
        <div className="h-7 flex-1 animate-pulse rounded-lg bg-muted" />
        <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
        <div className="h-7 w-7 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { token } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [deletingShop, setDeletingShop] = useState<Shop | null>(null);

  // Credentials modal — null when closed; notice overrides credential display.
  const [credentialsModal, setCredentialsModal] = useState<{
    adminCredentials: AdminCredentials | null;
    walletCredentials: WalletCredentials | null;
    notice?: "already-retrieved" | "not-ready";
  } | null>(null);

  // Polling: active while any shop is non-terminal.
  const [pollingActive, setPollingActive] = useState(false);
  // ID of the shop whose credentials we should fetch once it turns Ready.
  const pendingShopIdRef = useRef<string | null>(null);

  // ─── create handler (non-blocking) ───────────────────────────────────────
  function handleCreated(result: CreateShopResult) {
    pendingShopIdRef.current = result.shop.id;
    setShops((prev) => [result.shop, ...prev]);
    setPollingActive(true);
  }

  // ─── initial load ─────────────────────────────────────────────────────────
  const fetchShops = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const list = await shopsApi.list(token);
      setShops(list);
      // Resume polling for any non-terminal shops that were already in progress.
      if (list.some((s) => !TERMINAL.has(s.phase))) {
        setPollingActive(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shops");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchShops(); }, [fetchShops]);

  // ─── polling loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pollingActive || !token) return;

    const intervalId = setInterval(async () => {
      try {
        const updated = await shopsApi.list(token);
        setShops(updated);

        // Check if the just-created shop reached a terminal phase.
        const pendingId = pendingShopIdRef.current;
        if (pendingId) {
          const pending = updated.find((s) => s.id === pendingId);
          if (pending?.phase === "Ready") {
            try {
              const creds = await getShopCredentials(pendingId, token);
              pendingShopIdRef.current = null;
              setCredentialsModal({
                adminCredentials: creds.adminCredentials,
                walletCredentials: creds.walletCredentials,
              });
            } catch (err) {
              if (err instanceof CredentialsError && err.status === 410) {
                // Already retrieved once — stop tracking, show the notice.
                pendingShopIdRef.current = null;
                setCredentialsModal({
                  adminCredentials: null,
                  walletCredentials: null,
                  notice: "already-retrieved",
                });
              } else if (err instanceof CredentialsError && err.status === 409) {
                // Ready phase but the operator hasn't materialised credentials
                // yet — surface "still provisioning" and keep the pending ref
                // so the next poll tick retries the fetch.
                setCredentialsModal({
                  adminCredentials: null,
                  walletCredentials: null,
                  notice: "not-ready",
                });
              }
              // Any other error: keep the ref set so a later tick retries.
            }
          } else if (pending && TERMINAL.has(pending.phase)) {
            // Failed / Degraded — no credentials to fetch; clear tracking.
            pendingShopIdRef.current = null;
          }
        }

        // Stop polling once every shop is terminal AND no credential fetch is
        // still outstanding (a Ready shop awaiting a 409 retry keeps polling).
        if (
          !updated.some((s) => !TERMINAL.has(s.phase)) &&
          pendingShopIdRef.current === null
        ) {
          setPollingActive(false);
        }
      } catch {
        // Ignore transient poll errors silently.
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [pollingActive, token]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your shop deployments.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="shrink-0 gap-1.5">
          <Plus />
          New shop
        </Button>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <ShopCardSkeleton key={i} />)}
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && shops.length === 0 && (
        <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed">
          <p className="text-sm font-medium">No shops yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Create your first deployment to get started.</p>
          <Button className="mt-4 gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus />
            New shop
          </Button>
        </div>
      )}

      {!loading && !error && shops.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shops.map((shop) => (
            <ShopCard
              key={shop.id}
              shop={shop}
              onEdit={() => setEditingShop(shop)}
              onDelete={() => setDeletingShop(shop)}
            />
          ))}
        </div>
      )}

      <CreateShopDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreated={handleCreated}
        token={token!}
      />

      {credentialsModal && (
        <CredentialsModal
          adminCredentials={credentialsModal.adminCredentials}
          walletCredentials={credentialsModal.walletCredentials}
          notice={credentialsModal.notice}
          onClose={() => setCredentialsModal(null)}
        />
      )}

      {editingShop && (
        <EditShopDialog
          shop={editingShop}
          open
          onOpenChange={(v) => { if (!v) setEditingShop(null); }}
          onUpdated={(updated) => setShops((prev) => prev.map((s) => s.id === updated.id ? updated : s))}
          token={token!}
        />
      )}

      {deletingShop && (
        <DeleteShopDialog
          shop={deletingShop}
          open
          onOpenChange={(v) => { if (!v) setDeletingShop(null); }}
          onDeleted={(id) => setShops((prev) => prev.filter((s) => s.id !== id))}
          token={token!}
        />
      )}
    </div>
  );
}

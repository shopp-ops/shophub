"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import type { AdminCredentials } from "@/lib/api/shops";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex gap-2">
        <Input id={id} value={value} readOnly className="font-mono" />
        <Button type="button" variant="outline" size="icon" onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </Field>
  );
}

export function AdminCredentialsModal({
  credentials,
  onClose,
}: {
  credentials: AdminCredentials;
  onClose: () => void;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Admin credentials</DialogTitle>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertDescription>
            These credentials are shown only once and cannot be retrieved again. Copy and store them now.
          </AlertDescription>
        </Alert>

        <CopyField id="admin-email" label="Email" value={credentials.email} />
        <CopyField id="admin-password" label="Password" value={credentials.password} />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          I have saved these credentials
        </label>

        <DialogFooter>
          <Button type="button" disabled={!acknowledged} onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

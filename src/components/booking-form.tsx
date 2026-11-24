"use client";
import { useActionState } from "react";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { bookSession } from "@/server/actions";

export function BookingForm({
  sessionTypeId,
  date,
  startTime,
}: {
  sessionTypeId: string;
  date: string;
  startTime: string;
}) {
  const [state, action, pending] = useActionState(bookSession, null);
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="sessionTypeId" value={sessionTypeId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="startTime" value={startTime} />
      <Field label="Name">
        <Input name="clientName" required />
      </Field>
      <Field label="Email">
        <Input name="clientEmail" type="email" required />
      </Field>
      <Field label="Phone">
        <Input name="clientPhone" />
      </Field>
      <Field label="Notes">
        <Textarea name="notes" rows={3} />
      </Field>
      {state?.error ? (
        <p className="text-sm text-red-800">{state.error}</p>
      ) : null}
      <Button disabled={pending}>
        {pending ? "Sending" : `Request ${date} at ${startTime}`}
      </Button>
    </form>
  );
}

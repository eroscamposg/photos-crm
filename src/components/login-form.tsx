"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button, Field, Input } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ error }: { error?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(
    error === "membership" ? "This account is not a member of the studio." : "",
  );
  const [pending, setPending] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        setPending(true);
        const result = await authClient.signIn.email({
          email: String(data.get("email") ?? ""),
          password: String(data.get("password") ?? ""),
        });
        setPending(false);
        if (result.error) {
          setMessage(result.error.message ?? "Could not sign in");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      }}
    >
      <Field label="Email">
        <Input name="email" type="email" autoComplete="username" required />
      </Field>
      <Field label="Password">
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      {message ? <p className="text-sm text-red-800">{message}</p> : null}
      <Button disabled={pending}>{pending ? "Signing in" : "Sign in"}</Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Credenziali non valide. Riprova.");
        return;
      }

      router.push("/lab");
      router.refresh();
    } catch {
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="mb-4 inline-block text-xs font-medium tracking-widest text-muted transition-colors hover:text-foreground"
        >
          MUTAGENIX
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">
          Accedi al Laboratorio
        </h1>
        <p className="mt-1 text-sm text-muted">
          Inserisci le tue credenziali per continuare.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          placeholder="scienziato@mutagenix.io"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Accedi
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Non hai un account?{" "}
        <Link
          href="/register"
          className="font-medium text-primary transition-colors hover:text-primary-light"
        >
          Crea il tuo organismo
        </Link>
      </p>
    </div>
  );
}

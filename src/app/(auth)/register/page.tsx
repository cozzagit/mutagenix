"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Le password non corrispondono.");
      return;
    }

    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error?.message ?? "Registrazione fallita. Riprova."
        );
        return;
      }

      // Auto-login after registration
      const loginResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (loginResult?.error) {
        router.push("/login");
      } else {
        router.push("/lab");
        router.refresh();
      }
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
          Crea il tuo Organismo
        </h1>
        <p className="mt-1 text-sm text-muted">
          Inizia il tuo percorso evolutivo.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Nome Scienziato"
          type="text"
          placeholder="Dr. Mutaforma"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          autoComplete="username"
        />
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
          placeholder="Minimo 8 caratteri"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <Input
          label="Conferma Password"
          type="password"
          placeholder="Ripeti la password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          error={
            confirmPassword.length > 0 && password !== confirmPassword
              ? "Le password non corrispondono"
              : undefined
          }
        />

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" fullWidth loading={loading}>
          Crea Organismo
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Hai già un account?{" "}
        <Link
          href="/login"
          className="font-medium text-primary transition-colors hover:text-primary-light"
        >
          Accedi al Lab
        </Link>
      </p>
    </div>
  );
}

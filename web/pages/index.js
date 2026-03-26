import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { AuthCard } from "@/components/AuthCard";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/store/useAppStore";

export default function HomePage() {
  const router = useRouter();
  const { token, hydrateAuth, setAuth } = useAppStore();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    if (token) {
      router.replace("/dashboard");
    }
  }, [router, token]);

  const handleSubmit = async (values) => {
    setSubmitting(true);
    setError("");

    try {
      const result = await apiFetch(`/api/auth/${mode}`, {
        method: "POST",
        body: values
      });

      setAuth(result);
      router.replace("/dashboard");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#0b141a_0%,#111b21_100%)] px-6 py-8">
      <AuthCard
        mode={mode}
        error={error}
        busy={submitting}
        onModeChange={setMode}
        onSubmit={handleSubmit}
      />
    </main>
  );
}

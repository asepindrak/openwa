import { useMemo, useState } from "react";

const initialValues = {
  name: "",
  email: "",
  password: ""
};

const featureCopy = [
  "Multi-user dashboard untuk banyak akun tim.",
  "Multi-device session dengan QR pairing lokal.",
  "Chat, media, dan realtime updates dalam satu CLI package."
];

export function AuthCard({ mode, onModeChange, onSubmit, error, busy }) {
  const [values, setValues] = useState(initialValues);
  const title = useMemo(() => (mode === "login" ? "Masuk ke workspace OpenWA" : "Buat workspace OpenWA"), [mode]);
  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Lanjutkan ke dashboard WhatsApp-style Anda dan kelola semua session dari satu tempat."
        : "Daftarkan akun pertama untuk mulai menjalankan inbox, device, dan session manager OpenWA.",
    [mode]
  );

  const submit = async (event) => {
    event.preventDefault();
    await onSubmit(values);
    setValues((current) => ({ ...current, password: "" }));
  };

  return (
    <section className="grid w-full max-w-[1180px] overflow-hidden rounded-[36px] border border-white/10 bg-[#0f1a20] shadow-[0_24px_90px_rgba(0,0,0,0.35)] lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden min-h-[720px] overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(37,211,102,0.28),transparent_36%),linear-gradient(180deg,#0b141a_0%,#111b21_100%)] px-10 py-10 lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_0%,rgba(255,255,255,0.03)_45%,transparent_100%)]" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-brand-100/70">OpenWA</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-white">
              Self-hosted WhatsApp workspace,
              <br />
              packed into one CLI.
            </h1>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/80">Local-first</div>
        </div>

        <div className="relative z-10 mt-10 grid gap-4">
          {featureCopy.map((item) => (
            <div key={item} className="rounded-[28px] border border-white/10 bg-white/[0.04] px-5 py-4 backdrop-blur">
              <p className="text-sm leading-7 text-white/78">{item}</p>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-auto rounded-[32px] border border-white/10 bg-white/[0.05] p-6 backdrop-blur">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-emerald-400 text-sm font-bold text-[#10251a]">
              WA
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Production-style control center</p>
              <p className="text-sm text-white/50">Session manager, dashboard, auth, media, dan realtime sockets.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[#111b21] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Frontend</p>
              <p className="mt-2 text-lg font-semibold text-white">55111</p>
            </div>
            <div className="rounded-2xl bg-[#111b21] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Backend</p>
              <p className="mt-2 text-lg font-semibold text-white">55222</p>
            </div>
            <div className="rounded-2xl bg-[#111b21] px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/35">Mode</p>
              <p className="mt-2 text-lg font-semibold text-white">Local</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center bg-[#f7f8fa] px-6 py-8 sm:px-10">
        <section className="w-full max-w-[470px] rounded-[32px] bg-white p-8 shadow-[0_20px_60px_rgba(17,27,33,0.12)] ring-1 ring-black/5 sm:p-10">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-emerald-400 text-sm font-bold text-[#10251a]">
                WA
              </div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#00a884]">OpenWA Access</p>
              <h2 className="mt-3 text-3xl font-semibold leading-tight text-[#111b21]">{title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#667781]">{subtitle}</p>
            </div>
            <div className="rounded-full bg-[#f0f2f5] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#54656f]">CLI</div>
          </div>

          <div className="mb-7 grid grid-cols-2 gap-2 rounded-full bg-[#f0f2f5] p-1.5">
            {["login", "register"].map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-full px-4 py-3 text-sm font-semibold transition ${
                  mode === value ? "bg-white text-[#111b21] shadow-sm" : "text-[#667781] hover:text-[#111b21]"
                }`}
                onClick={() => onModeChange(value)}
              >
                {value === "login" ? "Login" : "Register"}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={submit}>
            {mode === "register" ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-[#54656f]">Nama</span>
                <input
                  className="w-full rounded-2xl border border-[#d1d7db] bg-[#f7f8fa] px-4 py-3.5 text-[#111b21] outline-none transition placeholder:text-[#8696a0] focus:border-[#00a884] focus:bg-white"
                  value={values.name}
                  onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Nama Anda"
                  required
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#54656f]">Email</span>
              <input
                type="email"
                className="w-full rounded-2xl border border-[#d1d7db] bg-[#f7f8fa] px-4 py-3.5 text-[#111b21] outline-none transition placeholder:text-[#8696a0] focus:border-[#00a884] focus:bg-white"
                value={values.email}
                onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[#54656f]">Password</span>
              <input
                type="password"
                className="w-full rounded-2xl border border-[#d1d7db] bg-[#f7f8fa] px-4 py-3.5 text-[#111b21] outline-none transition placeholder:text-[#8696a0] focus:border-[#00a884] focus:bg-white"
                value={values.password}
                onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
                placeholder="Minimal 1 karakter"
                required
              />
            </label>

            {error ? <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}

            <button
              type="submit"
              className="w-full rounded-2xl bg-[#00a884] px-4 py-3.5 font-semibold text-white transition hover:bg-[#019273] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
            >
              {busy ? "Memproses..." : mode === "login" ? "Masuk ke dashboard" : "Buat akun dan mulai"}
            </button>
          </form>

          <div className="mt-8 rounded-[24px] bg-[#f7f8fa] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8696a0]">Setup flow</p>
            <p className="mt-2 text-sm leading-7 text-[#54656f]">Install sekali via npm, jalankan `openwa`, login ke dashboard, lalu hubungkan banyak device WhatsApp dari browser lokal Anda.</p>
          </div>
        </section>
      </div>
    </section>
  );
}

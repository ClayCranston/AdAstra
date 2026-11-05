"use client";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
export function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.3 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z"
      />
    </svg>
  );
}
export default function Login({
  profiles,
  googleEnabled,
}: {
  profiles: { id: string; name: string }[];
  googleEnabled: boolean;
}) {
  const [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (new URLSearchParams(location.search).has("error"))
      setError("Sign-in didn't finish. Try again or choose a local profile.");
  }, []);
  async function enter(id: string) {
    setBusy(id);
    setError("");
    try {
      const result = await signIn("credentials", {
        profile: id,
        redirect: false,
      });
      if (result?.error) {
        setError("Couldn't open this profile. Please try again.");
        setBusy("");
      } else location.assign("/");
    } catch {
      setError("Couldn't connect. Please try again.");
      setBusy("");
    }
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <a className="brand" href="/login">
          <Compass size={30} />
          <span>
            ad astra<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="login-copy">
          <span className="eyebrow light">
            A LITTLE ACCOUNTABILITY. A LOT OF POSSIBILITY.
          </span>
          <h1>
            Big ambitions.
            <br />
            Small promises.
            <br />
            <em>Your people.</em>
          </h1>
          <p>
            A space to show up, follow through, and become a little better—with
            a crew that has your back.
          </p>
          <div className="orbit-art" aria-hidden="true">
            <div className="orbit-ring one" />
            <div className="orbit-ring two" />
            <div className="orbit-ring three" />
            <span className="orbit-star">✳</span>
            <span className="orbit-label">
              PER ASPERA
              <br />
              AD ASTRA
            </span>
          </div>
        </div>
        <footer>
          <span>Built around real life.</span>
          <ArrowUpRight size={18} />
        </footer>
      </section>
      <section className="login-form">
        <span className="local-label">
          <span /> LOCAL WORKSPACE
        </span>
        <div>
          <div className="mini-icon">
            <Sparkles size={22} />
          </div>
          <h2>Good to have you here.</h2>
          <p className="muted">A better routine starts with showing up.</p>
          <button
            className="google-button"
            disabled={!googleEnabled || !!busy}
            onClick={() => {
              setBusy("google");
              void signIn("google", { callbackUrl: "/" });
            }}
          >
            <GoogleMark />
            Continue with Google
            {!googleEnabled && <span className="small-tag">Not connected</span>}
          </button>
          {!googleEnabled && (
            <p className="helper">
              Google sign-in is ready for credentials. Explore with a local
              profile below—no account needed.
            </p>
          )}
          {profiles.length > 0 && (
            <>
              <div className="divider-label">
                <span />
                OR EXPLORE A LOCAL PROFILE
                <span />
              </div>
              <div className="profile-options">
                {profiles.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => enter(p.id)}
                    disabled={!!busy}
                  >
                    <span className={`avatar color-${i}`}>{p.name[0]}</span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>
                        {p.id === "clay"
                          ? "Organization owner"
                          : "Group member"}
                      </small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            </>
          )}
          {error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="privacy-note">
            <LockKeyhole size={17} />
            <span>
              {profiles.length
                ? "Demo profiles and sample history. Everything stays on this computer."
                : "Sign in to access your private workspace."}
            </span>
          </div>
        </div>
        <footer>
          AdAstra <span>Better, together.</span>
        </footer>
      </section>
    </main>
  );
}

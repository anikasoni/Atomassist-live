import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Shell } from "../components/Shell";
import { ErrorMessage, StatusBadge } from "../components/ui";
import { api, ApiError, PublicInviteResponse } from "../lib/api";
import { saveCustomerAuth } from "../lib/auth";

export function JoinPage() {
  const { inviteToken } = useParams();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<PublicInviteResponse | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!inviteToken) return;

      try {
        const result = await api.validateInvite(inviteToken);
        setInvite(result);
      } catch (err) {
        if (err instanceof ApiError) setError(err.message);
        else setError("Invalid invite");
      }
    }

    void validate();
  }, [inviteToken]);

  async function join(event: FormEvent) {
    event.preventDefault();
    if (!inviteToken) return;

    setJoining(true);
    setError("");

    try {
      const result = await api.joinInvite(inviteToken, displayName);
      saveCustomerAuth(result.token, result.session.id);
      navigate(`/call/${result.session.id}?role=customer`);
    } catch (err) {
      if (err instanceof ApiError) setError(err.message);
      else setError("Failed to join session");
    } finally {
      setJoining(false);
    }
  }

  return (
    <Shell>
      <div className="mx-auto max-w-lg">
        <h1 className="text-3xl font-bold">Join Support Session</h1>
        <p className="mt-2 text-slate-400">
          Enter your name to join the secure browser-based support session.
        </p>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          {error && <ErrorMessage message={error} />}

          {!error && !invite && (
            <p className="text-slate-400">Validating invite...</p>
          )}

          {invite && (
            <>
              <div className="mb-6 flex items-center justify-between rounded-xl bg-slate-900 p-4">
                <div>
                  <p className="text-sm text-slate-400">Session</p>
                  <p className="font-mono text-xs">{invite.session.id}</p>
                </div>
                <StatusBadge status={invite.session.status} />
              </div>

              <form onSubmit={join} className="space-y-4">
                <label className="block">
                  <span className="text-sm text-slate-300">Your name</span>
                  <input
                    required
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-cyan-400"
                    placeholder="Example: John Customer"
                  />
                </label>

                <button
                  disabled={joining}
                  className="w-full rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"
                >
                  {joining ? "Joining..." : "Join Session"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
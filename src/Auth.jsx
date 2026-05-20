import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ragsmuubzjcxllvwdgfm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhZ3NtdXViempjeGxsdndkZ2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU0NzMsImV4cCI6MjA5NDcwMTQ3M30.vrqZesDext4I4um0k8sZLuPBdKhbhsy_03BZ-P7ch-M";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // login | register | reset
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const handleLogin = async () => {
    if (!email || !password) { setError("Introduce email y contraseña."); return; }
    setLoading(true); setError("");
    const { error: e } = await sb.auth.signInWithPassword({ email, password });
    if (e) setError(e.message === "Invalid login credentials" ? "Email o contraseña incorrectos." : e.message);
    else onLogin();
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!email || !password) { setError("Introduce email y contraseña."); return; }
    if (password.length < 6) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true); setError("");
    const { error: e } = await sb.auth.signUp({ email, password });
    if (e) setError(e.message);
    else setMsg("✓ Cuenta creada. Revisa tu email para confirmarla antes de entrar.");
    setLoading(false);
  };

  const handleReset = async () => {
    if (!email) { setError("Introduce tu email."); return; }
    setLoading(true); setError("");
    const { error: e } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`
    });
    if (e) setError(e.message);
    else setMsg("✓ Te hemos enviado un email para restablecer tu contraseña.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🗺</div>
          <h1 className="text-xl font-medium text-gray-900"><span className="text-teal-600">Sondeos</span>App</h1>
          <p className="text-xs text-gray-500 mt-1">Gestión de camiones y obras</p>
        </div>

        {msg ? (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-700 text-center mb-4">{msg}</div>
        ) : (
          <>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 mb-4">{error}</div>}

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Email</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="tu@email.com" onKeyDown={e=>e.key==="Enter"&&mode==="login"&&handleLogin()}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"/>
            </div>

            {mode !== "reset" && (
              <div className="mb-5">
                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Contraseña</label>
                <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&mode==="login"&&handleLogin()}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"/>
              </div>
            )}

            {mode === "login" && (
              <>
                <button onClick={handleLogin} disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40">
                  {loading ? "Entrando..." : "Entrar"}
                </button>
                <div className="flex justify-between mt-4 text-xs text-gray-400">
                  <button onClick={()=>{setMode("register");setError("");}} className="hover:text-teal-600 transition-colors">Crear cuenta</button>
                  <button onClick={()=>{setMode("reset");setError("");}} className="hover:text-teal-600 transition-colors">Olvidé mi contraseña</button>
                </div>
              </>
            )}

            {mode === "register" && (
              <>
                <button onClick={handleRegister} disabled={loading}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40">
                  {loading ? "Creando cuenta..." : "Crear cuenta"}
                </button>
                <button onClick={()=>{setMode("login");setError("");}} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  ← Volver al login
                </button>
              </>
            )}

            {mode === "reset" && (
              <>
                <button onClick={handleReset} disabled={loading}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40">
                  {loading ? "Enviando..." : "Enviar email de recuperación"}
                </button>
                <button onClick={()=>{setMode("login");setError("");}} className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  ← Volver al login
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

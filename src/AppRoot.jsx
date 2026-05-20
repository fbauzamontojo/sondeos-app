import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { LoginScreen } from "./Auth.jsx";
import App from "./App.jsx";

const SUPABASE_URL = "https://ragsmuubzjcxllvwdgfm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhZ3NtdXViempjeGxsdndkZ2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU0NzMsImV4cCI6MjA5NDcwMTQ3M30.vrqZesDext4I4um0k8sZLuPBdKhbhsy_03BZ-P7ch-M";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function AppRoot() {
  const [session, setSession] = useState(undefined); // undefined = cargando
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    // Sesión inicial
    sb.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadPerfil(session.user.id);
    });

    // Escuchar cambios de sesión
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadPerfil(session.user.id);
      else setPerfil(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadPerfil = async (userId) => {
    const { data } = await sb.from("perfiles").select("*").eq("id", userId).single();
    setPerfil(data);
  };

  const handleLogout = async () => {
    await sb.auth.signOut();
  };

  // Cargando sesión
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Cargando...</div>
      </div>
    );
  }

  // No hay sesión → pantalla de login
  if (!session) {
    return <LoginScreen onLogin={() => {}} />;
  }

  // Hay sesión → app completa
  return (
    <App
      user={session.user}
      perfil={perfil}
      onLogout={handleLogout}
    />
  );
}

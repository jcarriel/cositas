/**
 * Edge Function: notify
 *
 * Maneja dos acciones:
 *   action = "new-task"      → push inmediato cuando alguien crea una tarea
 *   action = "daily-summary" → push con el resumen de tareas pendientes
 *
 * Variables de entorno requeridas (Supabase → Edge Functions → Secrets):
 *   VAPID_PUBLIC_KEY   — clave pública VAPID
 *   VAPID_PRIVATE_KEY  — clave privada VAPID
 *   SUPABASE_URL       — se inyecta automáticamente
 *   SUPABASE_SERVICE_ROLE_KEY — se inyecta automáticamente
 *
 * Generar claves VAPID: npx web-push generate-vapid-keys
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VAPID_PUBLIC  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const SB_URL        = Deno.env.get("SUPABASE_URL")!;
const SB_SERVICE    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

// Enviar notificación push simple (sin encriptación para testing)
async function sendNotification(subscription: any, payload: string) {
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: payload,
  });

  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Push failed: ${response.status}`);
  }
}

Deno.serve(async (req) => {
  // Pre-flight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204, 
      headers: CORS 
    });
  }

  try {
    const body = await req.json();
    
    // ── Validar acción ──────────────────────────────────
    if (!body.action || (body.action !== "new-task" && body.action !== "daily-summary")) {
      return new Response(JSON.stringify({ error: "Acción desconocida" }), {
        status: 400, 
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SB_URL, SB_SERVICE);

    // ── Obtener suscripciones almacenadas ──────────────
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("id, subscription");

    if (error) throw error;
    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // ── Construir payload según la acción ──────────────
    let title = "", notifBody = "", tag = "cositas";

    if (body.action === "new-task") {
      title     = `📋 ${body.createdBy || "Alguien"} agregó una tarea`;
      notifBody = body.text || "";
      tag       = `task-${body.id}`;

    } else if (body.action === "daily-summary") {
      // Consultar tareas pendientes (con o sin fecha límite)
      const { data: pending } = await supabase
        .from("tasks")
        .select("id, text, due_date")
        .eq("done", false)
        .order("created_at", { ascending: false });

      if (!pending?.length) {
        return new Response(JSON.stringify({ sent: 0 }), {
          headers: { ...CORS, "Content-Type": "application/json" },
        });
      }

      const n = pending.length;
      // Detectar cuántas vencen hoy o están vencidas
      const today = new Date().toISOString().slice(0, 10);
      const urgent = pending.filter(t => t.due_date && t.due_date <= today).length;

      title     = "☀️ Buenos días — Cositas";
      notifBody = urgent > 0
        ? `${n} tarea${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""} · ⚠️ ${urgent} vence${urgent !== 1 ? "n" : ""} hoy`
        : `${n} tarea${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""}`;
      tag       = "daily-summary";
    }

    const payload = JSON.stringify({ title, body: notifBody, tag });

    // ── Enviar push a todos los suscriptores ───────────
    const results = await Promise.allSettled(
      subs.map(({ subscription }) => sendNotification(subscription, payload))
    );

    // Limpiar suscripciones expiradas / inválidas
    const expiredIds = results
      .map((r, i) => (r.status === "rejected" ? subs[i].id : null))
      .filter(Boolean);

    if (expiredIds.length) {
      await supabase.from("push_subscriptions").delete().in("id", expiredIds);
    }

    const sent = results.filter(r => r.status === "fulfilled").length;

    return new Response(JSON.stringify({ sent, expired: expiredIds.length }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500, headers: CORS });
  }
});

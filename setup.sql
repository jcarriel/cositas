-- ================================================================
-- COSITAS — Setup de base de datos para notificaciones push
-- Ejecutar en Supabase → SQL Editor
-- ================================================================

-- 1. Columna fecha límite en tareas (si no existe)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE;

-- 2. Tabla de suscripciones push
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription JSONB NOT NULL UNIQUE,
  user_name    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Políticas RLS (acceso anónimo — igual que la tabla tasks)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select" ON push_subscriptions
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_insert" ON push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_delete" ON push_subscriptions
  FOR DELETE TO anon USING (true);

-- ================================================================
-- OPCIONAL: Notificación diaria automática via pg_cron
-- Requiere activar la extensión pg_cron en Supabase
-- (Settings → Database → Extensions → pg_cron)
-- Cambia la URL de la Edge Function por la tuya
-- ================================================================
/*
SELECT cron.schedule(
  'daily-push-8am',
  '0 8 * * *',   -- Cada día a las 8:00 AM UTC
  $$
    SELECT net.http_post(
      url     := 'https://ppjjetgdlepxvgqxhyxu.supabase.co/functions/v1/notify',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.anon_key')
      ),
      body    := '{"action":"daily-summary"}'::jsonb
    );
  $$
);
*/

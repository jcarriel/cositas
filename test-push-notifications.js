/**
 * Script de Test para Push Notifications
 * Ejecutar en la consola del navegador (DevTools)
 */

const PushNotificationTests = {
  // Colores para output
  colors: {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
  },

  log(message, type = 'info') {
    const prefix = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      test: '🧪',
    }[type] || '•';
    console.log(`${prefix} ${message}`);
  },

  // Test 1: Verificar Service Worker
  async testServiceWorker() {
    this.log('Verificando Service Worker...', 'test');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) {
        this.log('No hay service workers registrados', 'error');
        return false;
      }
      const reg = regs[0];
      this.log(`Service Worker registrado: ${reg.scope}`, 'success');
      this.log(`Estado: ${reg.active ? 'activo' : 'inactivo'}`, 'info');
      return true;
    } catch (e) {
      this.log(`Error: ${e.message}`, 'error');
      return false;
    }
  },

  // Test 2: Verificar Permisos de Notificación
  async testNotificationPermission() {
    this.log('Verificando permisos de notificación...', 'test');
    if (!('Notification' in window)) {
      this.log('Notificaciones no soportadas en este navegador', 'error');
      return false;
    }
    const permission = Notification.permission;
    this.log(`Permiso actual: ${permission}`, 'info');
    if (permission !== 'granted') {
      this.log('Permisos no otorgados. Solicitar permiso...', 'warning');
      const result = await Notification.requestPermission();
      this.log(`Resultado: ${result}`, 'info');
      return result === 'granted';
    }
    this.log('Permisos otorgados', 'success');
    return true;
  },

  // Test 3: Verificar Suscripción Push
  async testPushSubscription() {
    this.log('Verificando suscripción push...', 'test');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) {
        this.log('No hay service workers', 'error');
        return false;
      }
      const reg = regs[0];
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        this.log('No hay suscripción push activa', 'warning');
        return false;
      }
      this.log('Suscripción push activa', 'success');
      this.log(`Endpoint: ${sub.endpoint.substring(0, 50)}...`, 'info');
      
      const p256dh = sub.getKey('p256dh');
      const auth = sub.getKey('auth');
      this.log(`Clave p256dh: ${p256dh ? 'presente' : 'falta'}`, p256dh ? 'success' : 'warning');
      this.log(`Clave auth: ${auth ? 'presente' : 'falta'}`, auth ? 'success' : 'warning');
      
      return true;
    } catch (e) {
      this.log(`Error: ${e.message}`, 'error');
      return false;
    }
  },

  // Test 4: Verificar Suscripción en Supabase
  async testSupabaseSubscription() {
    this.log('Verificando suscripción en Supabase...', 'test');
    try {
      const response = await fetch(
        'https://ppjjetgdlepxvgqxhyxu.supabase.co/rest/v1/push_subscriptions?select=count()',
        {
          headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwampldGdkbGVweHZncXhoeXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc0MjksImV4cCI6MjA4Nzg4MzQyOX0.stEuoeTJ4I6zdGV10XE0bLliXD6RdGuAed_DXHU-HiM',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwampldGdkbGVweHZncXhoeXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc0MjksImV4cCI6MjA4Nzg4MzQyOX0.stEuoeTJ4I6zdGV10XE0bLliXD6RdGuAed_DXHU-HiM',
          }
        }
      );
      if (!response.ok) {
        this.log(`Error HTTP: ${response.status}`, 'error');
        return false;
      }
      const data = await response.json();
      const count = data[0]?.count || 0;
      this.log(`Total de suscripciones en BD: ${count}`, 'success');
      return true;
    } catch (e) {
      this.log(`Error: ${e.message}`, 'error');
      return false;
    }
  },

  // Test 5: Verificar Edge Function (CORS)
  async testEdgeFunctionCORS() {
    this.log('Verificando Edge Function (CORS)...', 'test');
    try {
      const response = await fetch(
        'https://ppjjetgdlepxvgqxhyxu.supabase.co/functions/v1/notify',
        {
          method: 'OPTIONS',
          headers: {
            'Origin': window.location.origin,
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'content-type',
          }
        }
      );
      this.log(`Status: ${response.status}`, response.status === 204 ? 'success' : 'warning');
      const corsOrigin = response.headers.get('Access-Control-Allow-Origin');
      this.log(`CORS Origin: ${corsOrigin || 'no presente'}`, corsOrigin ? 'success' : 'error');
      const corsMethods = response.headers.get('Access-Control-Allow-Methods');
      this.log(`CORS Methods: ${corsMethods || 'no presente'}`, corsMethods ? 'success' : 'error');
      return response.status === 204;
    } catch (e) {
      this.log(`Error: ${e.message}`, 'error');
      return false;
    }
  },

  // Test 6: Verificar Edge Function (POST)
  async testEdgeFunctionPOST() {
    this.log('Verificando Edge Function (POST)...', 'test');
    try {
      const response = await fetch(
        'https://ppjjetgdlepxvgqxhyxu.supabase.co/functions/v1/notify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwampldGdkbGVweHZncXhoeXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc0MjksImV4cCI6MjA4Nzg4MzQyOX0.stEuoeTJ4I6zdGV10XE0bLliXD6RdGuAed_DXHU-HiM',
          }
        },
        JSON.stringify({
          action: 'new-task',
          id: 'test-' + Date.now(),
          createdBy: 'Test Script',
          text: 'Test notification from script'
        })
      );
      this.log(`Status: ${response.status}`, response.status === 200 ? 'success' : 'error');
      const data = await response.json();
      this.log(`Respuesta: ${JSON.stringify(data)}`, 'info');
      return response.status === 200;
    } catch (e) {
      this.log(`Error: ${e.message}`, 'error');
      return false;
    }
  },

  // Test 7: Enviar notificación de prueba
  async testSendNotification() {
    this.log('Enviando notificación de prueba...', 'test');
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length === 0) {
        this.log('No hay service workers', 'error');
        return false;
      }
      const reg = regs[0];
      await reg.showNotification('🧪 Test Notification', {
        body: 'Esta es una notificación de prueba',
        tag: 'test-notification',
        renotify: true,
        vibrate: [150, 80, 150],
      });
      this.log('Notificación enviada', 'success');
      return true;
    } catch (e) {
      this.log(`Error: ${e.message}`, 'error');
      return false;
    }
  },

  // Ejecutar todos los tests
  async runAll() {
    console.clear();
    this.log('=== PUSH NOTIFICATIONS TEST SUITE ===', 'info');
    console.log('');

    const results = {
      serviceWorker: await this.testServiceWorker(),
      permission: await this.testNotificationPermission(),
      pushSubscription: await this.testPushSubscription(),
      supabaseSubscription: await this.testSupabaseSubscription(),
      edgeFunctionCORS: await this.testEdgeFunctionCORS(),
      edgeFunctionPOST: await this.testEdgeFunctionPOST(),
      sendNotification: await this.testSendNotification(),
    };

    console.log('');
    this.log('=== RESUMEN DE RESULTADOS ===', 'info');
    const passed = Object.values(results).filter(r => r).length;
    const total = Object.keys(results).length;
    this.log(`${passed}/${total} tests pasados`, passed === total ? 'success' : 'warning');
    
    console.table(results);
    
    return results;
  }
};

// Ejecutar tests
console.log('Ejecutando: PushNotificationTests.runAll()');
PushNotificationTests.runAll();

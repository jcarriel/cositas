/**
 * Script de Validación de Push Notifications
 * Ejecutar con: node validate-implementation.js
 */

const SUPABASE_URL = "https://ppjjetgdlepxvgqxhyxu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwampldGdkbGVweHZncXhoeXh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMDc0MjksImV4cCI6MjA4Nzg4MzQyOX0.stEuoeTJ4I6zdGV10XE0bLliXD6RdGuAed_DXHU-HiM";
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/notify`;

const results = [];

function log(message, type = "info") {
  const prefix = {
    success: "✅",
    error: "❌",
    test: "🧪",
    info: "ℹ️",
  }[type] || "•";
  console.log(`${prefix} ${message}`);
}

async function test(name, fn) {
  log(`Testing: ${name}`, "test");
  try {
    await fn();
    results.push({ name, passed: true });
    log(`PASSED: ${name}`, "success");
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg });
    log(`FAILED: ${name} - ${errorMsg}`, "error");
  }
  console.log("");
}

// Test 1: Verificar que la Edge Function responde a OPTIONS
async function testEdgeFunctionCORS() {
  await test("Edge Function - OPTIONS CORS", async () => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://jcarriel.github.io",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    if (response.status !== 204) {
      throw new Error(`Expected status 204, got ${response.status}`);
    }

    const corsOrigin = response.headers.get("Access-Control-Allow-Origin");
    if (!corsOrigin) {
      throw new Error("Missing Access-Control-Allow-Origin header");
    }

    const corsMethods = response.headers.get("Access-Control-Allow-Methods");
    if (!corsMethods) {
      throw new Error("Missing Access-Control-Allow-Methods header");
    }

    log(`CORS Origin: ${corsOrigin}`, "info");
    log(`CORS Methods: ${corsMethods}`, "info");
  });
}

// Test 2: Verificar que la Edge Function responde a POST
async function testEdgeFunctionPOST() {
  await test("Edge Function - POST new-task", async () => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "new-task",
        id: `test-${Date.now()}`,
        createdBy: "Validation Script",
        text: "Test notification from validation script",
      }),
    });

    if (response.status !== 200) {
      const text = await response.text();
      throw new Error(`Expected status 200, got ${response.status}. Body: ${text}`);
    }

    const data = await response.json();
    log(`Response: ${JSON.stringify(data)}`, "info");

    if (typeof data.sent !== "number") {
      throw new Error("Response missing 'sent' field");
    }
  });
}

// Test 3: Verificar que la Edge Function responde a daily-summary
async function testEdgeFunctionDailySummary() {
  await test("Edge Function - POST daily-summary", async () => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "daily-summary",
      }),
    });

    if (response.status !== 200) {
      const text = await response.text();
      throw new Error(`Expected status 200, got ${response.status}. Body: ${text}`);
    }

    const data = await response.json();
    log(`Response: ${JSON.stringify(data)}`, "info");

    if (typeof data.sent !== "number") {
      throw new Error("Response missing 'sent' field");
    }
  });
}

// Test 4: Verificar que la tabla push_subscriptions existe
async function testSupabaseTable() {
  await test("Supabase - push_subscriptions table exists", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?select=id`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Invalid response format");
    }

    const count = data.length;
    log(`Total subscriptions in database: ${count}`, "info");
  });
}

// Test 5: Verificar que la tabla tasks existe
async function testSupabaseTasksTable() {
  await test("Supabase - tasks table exists", async () => {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/tasks?select=id&limit=1`,
      {
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (response.status !== 200) {
      throw new Error(`Expected status 200, got ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error("Invalid response format");
    }

    log(`Tasks table is accessible`, "info");
  });
}

// Test 6: Verificar que la Edge Function maneja errores correctamente
async function testEdgeFunctionErrorHandling() {
  await test("Edge Function - Error handling (invalid action)", async () => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "invalid-action",
      }),
    });

    if (response.status !== 400) {
      throw new Error(`Expected status 400 for invalid action, got ${response.status}`);
    }

    const data = await response.json();
    if (!data.error) {
      throw new Error("Response should contain error field");
    }

    log(`Error response: ${JSON.stringify(data)}`, "info");
  });
}

// Test 7: Verificar que la Edge Function valida JSON
async function testEdgeFunctionJSONValidation() {
  await test("Edge Function - JSON validation", async () => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
      },
      body: "invalid json",
    });

    if (response.status === 200) {
      throw new Error("Should reject invalid JSON");
    }

    log(`Correctly rejected invalid JSON with status ${response.status}`, "info");
  });
}

// Test 8: Verificar CORS headers en respuesta POST
async function testCORSHeadersInPOST() {
  await test("Edge Function - CORS headers in POST response", async () => {
    const response = await fetch(EDGE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Origin": "https://jcarriel.github.io",
      },
      body: JSON.stringify({
        action: "new-task",
        id: `test-${Date.now()}`,
        createdBy: "Validation Script",
        text: "Test",
      }),
    });

    const corsOrigin = response.headers.get("Access-Control-Allow-Origin");
    if (!corsOrigin) {
      throw new Error("Missing CORS header in POST response");
    }

    log(`CORS header present: ${corsOrigin}`, "info");
  });
}

// Ejecutar todos los tests
async function runAllTests() {
  console.log("\n");
  log("=== PUSH NOTIFICATIONS VALIDATION TEST SUITE ===", "info");
  console.log("");

  await testEdgeFunctionCORS();
  await testEdgeFunctionPOST();
  await testEdgeFunctionDailySummary();
  await testSupabaseTable();
  await testSupabaseTasksTable();
  await testEdgeFunctionErrorHandling();
  await testEdgeFunctionJSONValidation();
  await testCORSHeadersInPOST();

  // Resumen
  console.log("");
  log("=== TEST SUMMARY ===", "info");
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  log(`${passed}/${total} tests passed`, passed === total ? "success" : "error");

  console.log("\nDetailed Results:");
  console.table(results);

  if (passed !== total) {
    console.log("\nFailed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ❌ ${r.name}: ${r.error}`);
      });
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

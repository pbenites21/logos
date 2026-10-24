import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const PROFILES_DIR = "chrome-profiles";
const SESSIONS_DIR = "sessions";

// Asegurar que existan los directorios necesarios
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

// Configuración para Power Apps / Kardex
const KARDEX_CONFIG = {
    profileDir: path.join(PROFILES_DIR, "kardex-profile"),
    authFile: path.join(SESSIONS_DIR, "kardex-auth.json"),
    url: "https://apps.powerapps.com/play/e/default-71f482e3-6ab4-463e-ae43-63535af77275/a/5ceed969-8dc0-42f9-a5d0-32c947cd5100?tenantId=71f482e3-6ab4-463e-ae43-63535af77275&hint=86dbc614-4e48-468c-aaa6-99d1adf57eec&sourcetime=1786728816829&source=portal"
};

// Ciclo para capturar los tokens y headers exactos de Power Apps / Kardex mediante la petición GET a BD_MODIFICACIONES_OT
async function runKardexAuthCycle() {
    console.log(`[Kardex] Iniciando sesión y espera de petición GET de Power Platform...`);

    const context = await chromium.launchPersistentContext(KARDEX_CONFIG.profileDir, {
        headless: false,
        args: [
            "--start-maximized",
            "--disable-sync",
            "--no-first-run",
            "--no-default-browser-check"
        ]
    });

    const page = context.pages()[0] || (await context.newPage());

    let headersCaptured = false;

    // Interceptor para capturar exactamente la llamada GET de la tabla BD_MODIFICACIONES_OT con sus headers
    page.on("request", (request) => {
        const url = request.url();
        const headers = request.headers();
        
        if (url.includes("BD_MODIFICACIONES_OT") && headers["authorization"]) {
            try {
                const kardexData = {
                    "Authorization": headers["authorization"] || "",
                    "x-ms-client-session-id": headers["x-ms-client-session-id"] || "",
                    "x-ms-client-request-id": headers["x-ms-client-request-id"] || "",
                    "x-ms-client-environment-id": headers["x-ms-client-environment-id"] || "",
                    "x-ms-client-app-id": headers["x-ms-client-app-id"] || "",
                    "x-ms-client-tenant-id": headers["x-ms-client-tenant-id"] || "",
                    "x-ms-client-object-id": headers["x-ms-client-object-id"] || "",
                    "x-ms-shared-connection-id": headers["x-ms-shared-connection-id"] || "",
                    "x-ms-protocol-semantics": headers["x-ms-protocol-semantics"] || "",
                    "User-Agent": headers["user-agent"] || "",
                    "Referer": headers["referer"] || "",
                    "Origin": headers["origin"] || "",
                    "updated": new Date().toISOString()
                };

                // Asegurar que el directorio de sesiones exista antes de escribir
                if (!fs.existsSync(SESSIONS_DIR)) {
                    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
                }

                fs.writeFileSync(KARDEX_CONFIG.authFile, JSON.stringify(kardexData, null, 2), "utf-8");
                headersCaptured = true;
                console.log(`[Kardex] ¡Headers y Token guardados físicamente en ${KARDEX_CONFIG.authFile}!`);
            } catch (err: any) {
                console.error(`[Kardex] Error crítico al escribir el archivo de auth:`, err?.message || err);
            }
        }
    });

    try {
        console.log(`[Kardex] Navegando a Power Apps...`);
        await page.goto(KARDEX_CONFIG.url, { waitUntil: "domcontentloaded", timeout: 25000 });
        
        console.log(`[Kardex] Esperando a que cargue la app y ejecutando secuencia de clics...`);
        await page.waitForTimeout(5000);

        let step1Done = false;
        let step2Done = false;
        let step3Done = false;
        const maxAttempts = 15;
        const imeiValue = "353431655009843";

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const frames = page.frames();
                for (const frame of frames) {
                    
                    // PASO 1: Clic en el botón lateral del segundo elemento ("Registro O.T.")
                    if (!step1Done) {
                        const success1 = await frame.evaluate(() => {
                            const elementosGaleria = document.querySelectorAll('.virtualized-gallery-item');
                            if (elementosGaleria.length >= 2) {
                                const segundoElemento = elementosGaleria[1];
                                const botonDerecho = segundoElemento.querySelector('[data-control-name="Button3"] button') || segundoElemento.querySelector('[data-control-name="Button3"]');
                                
                                if (botonDerecho) {
                                    (botonDerecho as HTMLElement).click();
                                    return true;
                                }
                            }
                            return false;
                        });

                        if (success1) {
                            console.log(`[Kardex] Paso 1 completado: Clic en el botón lateral de 'Registro O.T.' (intento ${attempt})`);
                            step1Done = true;
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }

                    // PASO 2: Clic en el botón de "Modificación O.T." (EditFilled)
                    if (step1Done && !step2Done) {
                        const success2 = await frame.evaluate(() => {
                            const botonModificacion = Array.from(document.querySelectorAll('button')).find(el => {
                                const spanTexto = el.querySelector('span._____f3eo9z0, span');
                                return (spanTexto && spanTexto.textContent?.includes("Modificación O.T.")) || el.querySelector('[data-testid="EditFilled"]');
                            });

                            if (botonModificacion) {
                                (botonModificacion as HTMLElement).click();
                                return true;
                            }
                            return false;
                        });

                        if (success2) {
                            console.log(`[Kardex] Paso 2 completado: Clic en 'Modificación O.T.' (intento ${attempt})`);
                            step2Done = true;
                            await new Promise(r => setTimeout(r, 2000));
                        }
                    }

                    // PASO 3: Ingresar el IMEI en el campo DataCardValue3_1 y presionar enter / disparar eventos
                    if (step2Done && !step3Done) {
                        const success3 = await frame.evaluate((imei) => {
                            const container = document.querySelector('[data-control-name="DataCardValue3_1"]');
                            const inputElem = container?.querySelector('input[appmagic-control="DataCardValue3_1textbox"]') || 
                                              document.querySelector('input[appmagic-control="DataCardValue3_1textbox"]');

                            if (inputElem) {
                                const input = inputElem as HTMLInputElement;
                                input.focus();
                                input.value = imei;
                                
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                                input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                                input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
                                return true;
                            }
                            return false;
                        }, imeiValue);

                        if (success3) {
                            console.log(`[Kardex] Paso 3 completado: IMEI '${imeiValue}' ingresado en DataCardValue3_1 (intento ${attempt})`);
                            step3Done = true;
                        }
                    }
                }
                
                if (step1Done && step2Done && step3Done && headersCaptured) {
                    console.log(`[Kardex] Secuencia e intercepción de GET completadas con éxito.`);
                    break;
                }
            } catch {
                // Ignorar errores transitorios por renderizado de frames
            }

            await page.waitForTimeout(1500);
        }

        if (step3Done && !headersCaptured) {
            console.log(`[Kardex] Esperando a que se dispare la petición GET con el IMEI...`);
            for (let waitSec = 0; waitSec < 15; waitSec++) {
                if (headersCaptured) break;
                await page.waitForTimeout(2000);
            }
        }

    } catch (error: any) {
        console.error(`[Kardex] Error al navegar o interactuar:`, error?.message || error);
    }

    if (!fs.existsSync(KARDEX_CONFIG.authFile)) {
        console.log(`\n[!] Inicia sesión manualmente en la ventana de Power Apps (Kardex)`);
        console.log(`[!] Esperando 60 segundos para la autenticación inicial...`);
        await page.waitForTimeout(60000);
    } else {
        await page.waitForTimeout(4000);
    }

    console.log(`[Kardex] Cerrando navegador de Power Apps y guardando estado...`);
    await context.close();
}

export async function runKardexAutomation() {
    const TWO_HOURS_MS = 35 * 60 * 1000;

    while (true) {
        await runKardexAuthCycle();

        console.log(`[Kardex] Ciclo de autenticación finalizado. Esperando ${TWO_HOURS_MS / 60000} minutos para renovar...\n`);
        await new Promise(resolve => setTimeout(resolve, TWO_HOURS_MS));
    }
}

// Ejecutar directamente al iniciar
runKardexAutomation();
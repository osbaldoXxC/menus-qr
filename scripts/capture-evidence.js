/**
 * Script de Automatización de Capturas Reales de GitHub Actions con Playwright
 * Proyecto: MexxicanMX / Menús QR (CampusOps)
 * 
 * Uso:
 *   node scripts/capture-evidence.js --url "https://github.com/osbaldoXxC/menus-qr/actions/runs/..." --output "evidence/cicd/issue-29/issue-29-failed.png"
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('C:/Users/Baldo/OneDrive/Escritorio/asdad/menus-qr-Negocios/node_modules/playwright');

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: '',
    output: '',
    timeout: 30000,
    viewport: { width: 1440, height: 900 }
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && args[i + 1]) {
      options.url = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--timeout' && args[i + 1]) {
      options.timeout = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return options;
}

async function run() {
  const options = parseArgs();

  if (!options.url || !options.output) {
    console.error('Uso requerido: node scripts/capture-evidence.js --url <URL> --output <OUTPUT_PATH>');
    process.exit(1);
  }

  const outputAbs = path.resolve(options.output);
  const outputDir = path.dirname(outputAbs);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[Playwright] Iniciando navegador Chromium en modo headless...`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  try {
    console.log(`[Playwright] Navegando a la URL: ${options.url}`);
    await page.goto(options.url, {
      waitUntil: 'networkidle',
      timeout: options.timeout
    });

    // Espera adicional para renderizado de logs dinámicos en GitHub Actions
    await page.waitForTimeout(3000);

    console.log(`[Playwright] Capturando pantalla completa...`);
    await page.screenshot({
      path: outputAbs,
      fullPage: false
    });

    // Verificación de integridad del archivo PNG
    const stats = fs.statSync(outputAbs);
    const buffer = fs.readFileSync(outputAbs);
    const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;

    if (!isPng || stats.size < 1000) {
      throw new Error(`El archivo generado no es un PNG válido o está corrupto (tamaño: ${stats.size} bytes).`);
    }

    console.log(`[Playwright] ✅ Captura auténtica verificada con éxito:`);
    console.log(`   Ruta: ${outputAbs}`);
    console.log(`   Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
    console.log(`   Dimensiones: ${options.viewport.width}x${options.viewport.height}`);
  } catch (error) {
    console.error(`[Playwright] ❌ Error durante la captura:`, error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();

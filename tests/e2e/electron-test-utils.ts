import { _electron as electron, type ElectronApplication, type Page } from 'playwright';

export interface AppInstance {
  app: ElectronApplication;
  page: Page;
}

let activeApp: ElectronApplication | null = null;

export async function startApp(): Promise<AppInstance> {
  // Meluncurkan aplikasi Electron
  const app = await electron.launch({ args: ['.'] });
  activeApp = app;

  // Tunggu jendela pertama dibuka
  const page = await app.firstWindow();

  // Pastikan aplikasi termuat dengan menunggu event tertentu jika perlu
  // (misalnya domcontentloaded, load, atau menungggu selector khusus)
  await page.waitForLoadState('domcontentloaded');

  return { app, page };
}

export async function stopApp(app: ElectronApplication): Promise<void> {
  if (app) {
    await app.close();
  }
}

// Helper untuk menutup app yang aktif jika terjadi error yang tidak ter-catch
export async function cleanupApp(): Promise<void> {
  if (activeApp) {
    await activeApp.close();
    activeApp = null;
  }
}

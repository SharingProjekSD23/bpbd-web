import { test, expect, type Page } from '@playwright/test';
import { seedStore } from '../../lib/bpbd/model';

async function login(page: Page, email: string, password = 'BPBDdemo2026!') {
  await page.goto('/masuk');
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
}

test('anonymous access, old role sessions, invalid login, reload and logout', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('bpbd-role', 'ADM');
    sessionStorage.setItem('bpbd-session', 'in');
  });
  await page.goto('/admin/pengguna');
  await expect(page).toHaveURL(/\/masuk$/);
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Role demonstrasi' })).toHaveCount(0);
  await login(page, 'demo@bpbd.test');
  await expect(page.getByText('Email atau kata sandi tidak sesuai, atau akun dinonaktifkan.')).toBeVisible();
  await login(page, 'pk@bpbd.example', 'salah');
  await expect(page.getByRole('button', { name: 'Menu akun' })).toHaveCount(0);
  await login(page, 'PK@BPBD.EXAMPLE');
  await expect(page.getByRole('heading', { name: 'Dashboard Bidang Pencegahan dan Kesiapsiagaan' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard Bidang Pencegahan dan Kesiapsiagaan' })).toBeVisible();
  await page.goto('/data/kejadian');
  await expect(page.getByRole('heading', { name: 'Akses dibatasi' })).toBeVisible();
  await page.getByRole('button', { name: 'Kembali ke Beranda' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard Bidang Pencegahan dan Kesiapsiagaan' })).toBeVisible();
  await page.getByRole('button', { name: 'Menu akun' }).click();
  await page.getByRole('menuitem', { name: 'Keluar' }).click();
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu akun' })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('Daftar akun dummy', { exact: true }).click();
  await expect(page.getByText('rr@bpbd.example', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('legacy accounts gain credentials without resetting data or enabling inactive accounts', async ({ page }) => {
  const legacy = seedStore();
  for (const user of legacy.users) delete (user as Partial<typeof user>).demoPassword;
  legacy.entries[0].title = 'Catatan lama tetap tersimpan';
  legacy.users.find(user => user.role === 'RR')!.status = 'Nonaktif';
  await page.addInitScript(store => {
    if (!localStorage.getItem('bpbd-demo-v1')) localStorage.setItem('bpbd-demo-v1', JSON.stringify(store));
  }, legacy);
  await login(page, 'rr@bpbd.example');
  await expect(page.getByText('Email atau kata sandi tidak sesuai, atau akun dinonaktifkan.')).toBeVisible();
  await login(page, 'kl@bpbd.example');
  await expect(page.getByRole('heading', { name: 'Dashboard Kedaruratan' })).toBeVisible();
  await page.goto('/data/kejadian/KJD-001');
  await expect(page.getByRole('heading', { name: 'Catatan lama tetap tersimpan' })).toBeVisible();
});

test('two researchers keep distinct sessions and disabling an account ends its open session', async ({ page, context }) => {
  await login(page, 'nadia@peneliti.example');
  await expect(page.getByRole('heading', { name: 'Beranda Peneliti' })).toBeVisible();
  const arif = await context.newPage();
  await login(arif, 'arif@peneliti.example');
  await expect(arif.getByRole('heading', { name: 'Status Akun Peneliti' })).toBeVisible();
  await arif.goto('/peneliti/permohonan/RSET-003');
  await expect(arif.getByRole('heading', { name: 'Akses dibatasi' })).toBeVisible();
  const admin = await context.newPage();
  await login(admin, 'adm@bpbd.example');
  await admin.goto('/admin/pendaftaran');
  await admin.getByRole('row').filter({ hasText: 'Arif Setiawan' }).getByRole('button', { name: 'Tinjau', exact: true }).click();
  await admin.getByRole('button', { name: 'Setujui Akun' }).click();
  await arif.goto('/peneliti');
  await expect(arif.getByText('Analisis pemulihan fasilitas pascabencana', { exact: true })).toBeVisible();
  await expect(arif.getByText('Kajian kerentanan banjir di Kecamatan Genuk', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Kajian kerentanan banjir di Kecamatan Genuk', exact: true })).toBeVisible();
  await expect(page.getByText('Analisis pemulihan fasilitas pascabencana', { exact: true })).toHaveCount(0);
  await admin.goto('/admin/pengguna/PEN-001');
  await admin.getByRole('combobox', { name: 'Status akun', exact: true }).click();
  await admin.getByRole('option', { name: 'Nonaktif', exact: true }).click();
  await admin.getByRole('button', { name: 'Tinjau Perubahan' }).click();
  await admin.getByRole('button', { name: 'Simpan Pengguna' }).click();
  await expect(page.getByRole('heading', { name: 'Selamat datang kembali' })).toBeVisible();
  await expect(arif.getByRole('heading', { name: 'Beranda Peneliti' })).toBeVisible();
});

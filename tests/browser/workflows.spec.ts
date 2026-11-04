import { test, expect, type Page } from './fixtures';
test('new registration has its own identity and waits for approval',async({page})=>{await page.goto('/daftar-peneliti');await page.getByLabel(/^Nomor WhatsApp/).fill('081234567890');await page.locator('#register-name').fill('Peneliti Baru Demo');await page.locator('#register-institution').fill('Universitas Uji');await page.locator('#auth-email').fill('baru@contoh.test');await page.locator('#auth-password').fill('PenelitiDemo!');await expect(page.getByLabel(/^Tujuan penelitian/)).toHaveCount(0);await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Kirim Pendaftaran'}).click();await expect(page.getByRole('heading',{name:'Status Akun Peneliti'})).toBeVisible();await expect(page.getByText('Menunggu Persetujuan',{exact:true})).toBeVisible();await role(page,'Admin Sistem BPBD');await page.goto('/admin/pendaftaran');await page.getByRole('row').filter({hasText:'Peneliti Baru Demo'}).getByRole('button',{name:'Tinjau',exact:true}).click();await page.getByRole('button',{name:'Setujui Akun',exact:true}).click();await expect(page.getByText('Keputusan akun tersimpan.',{exact:true})).toBeVisible();await login(page,'baru@contoh.test','PenelitiDemo!');await expect(page.getByRole('heading',{name:'Beranda Peneliti'})).toBeVisible();await expect(page.getByText('Kajian kerentanan banjir di Kecamatan Genuk',{exact:true})).toHaveCount(0);await page.goto('/peneliti/permohonan/RSET-001');await expect(page.getByRole('heading',{name:'Akses dibatasi'})).toBeVisible();});
async function login(page:Page,email:string,password='BPBDdemo2026!'){
 await page.request.post('/api/bpbd/logout',{headers:{'X-BPBD-Request':'1'}});await page.goto('/masuk');await page.locator('#auth-email').fill(email);await page.locator('#auth-password').fill(password);await page.getByRole('button',{name:'Masuk',exact:true}).click();await expect(page.getByRole('button',{name:'Menu akun'})).toBeVisible();
}
async function role(page:Page,name:string){const emails:Record<string,string>={'Admin Sistem BPBD':'adm@bpbd.example','Bidang Pencegahan dan Kesiapsiagaan':'pk@bpbd.example','Bidang Kedaruratan dan Logistik':'kl@bpbd.example','Bidang Rehabilitasi dan Rekonstruksi':'rr@bpbd.example','Sekretariat BPBD':'sek@bpbd.example','Peneliti / Akademisi':'nadia@peneliti.example'};await login(page,emails[name]);}
test('integrated dashboards, private records, and mobile layout', async ({page})=>{
  await role(page,'Admin Sistem BPBD');
  await expect(page.getByRole('heading',{name:'Dashboard Penelitian',exact:true})).toBeVisible();
  await page.goto('/admin/hak-akses');await expect(page.getByRole('heading',{name:'Hak Akses Terintegrasi'})).toBeVisible();
  await role(page,'Bidang Pencegahan dan Kesiapsiagaan');
  await expect(page.getByRole('heading',{name:'Dashboard Logistik',exact:true})).toBeVisible();
  expect((await page.request.get('/api/operasional/records/kejadian')).status()).toBe(403);
  await page.getByRole('link',{name:'Operasional Bidang',exact:true}).click();
  const frame=page.frameLocator('iframe[title="Ruang kerja operasional BPBD"]');
  await frame.locator('.unit-card[data-unit="PK"]').click();await expect(frame.locator('#add-open')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('operational form saves directly and Secretariat sees a read-only field', async ({page})=>{
  await role(page,'Bidang Kedaruratan dan Logistik');await page.getByRole('link',{name:'Operasional Bidang',exact:true}).click();
  let frame=page.frameLocator('iframe[title="Ruang kerja operasional BPBD"]');await frame.locator('.unit-card[data-unit="KL"]').click();
  await page.setViewportSize({width:390,height:844});
  await frame.locator('#add-open').click();await frame.locator('#record-form [name="nama"]').fill('Kejadian terintegrasi');
  await frame.locator('#record-form [name="jenis_bencana"]').selectOption('Banjir');await frame.locator('#record-form [name="tanggal"]').fill('2026-11-04');
  await frame.locator('#record-form button[type="submit"]').click();await expect(frame.locator('#detail-title')).toHaveText('Kejadian terintegrasi');
  await expect(frame.locator('#detail-body')).not.toContainText('Menunggu Persetujuan');
  await role(page,'Sekretariat BPBD');await page.getByRole('button',{name:'Buka atau tutup navigasi',exact:true}).click();await page.getByRole('link',{name:'Operasional Bidang',exact:true}).click();
  frame=page.frameLocator('iframe[title="Ruang kerja operasional BPBD"]');await frame.locator('.unit-card[data-unit="KL"]').click();
  await expect(frame.getByText('Kejadian terintegrasi',{exact:true})).toBeVisible();await expect(frame.locator('#add-open')).toHaveCount(0);
});

test('operational CSV preview, commit, export and duplicate protection',async({page})=>{
  await role(page,'Bidang Kedaruratan dan Logistik');await page.getByRole('link',{name:'Operasional Bidang',exact:true}).click();
  const frame=page.frameLocator('iframe[title="Ruang kerja operasional BPBD"]');await frame.locator('.unit-card[data-unit="KL"]').click();
  await frame.locator('[data-tab="barang"]').click();await frame.locator('#import-open').click();
  const file={name:'barang.csv',mimeType:'text/csv',buffer:Buffer.from('id,nama,satuan\nIMPORT-1,Barang impor,paket\n')};
  await frame.locator('#import-form input[type=file]').setInputFiles(file);await frame.locator('#import-form button[type=submit]').click();
  await frame.locator('#confirm-import').check();await frame.locator('#save-import').click();await expect(frame.locator('#module-content').getByText('Barang impor',{exact:true})).toBeVisible();
  const download=page.waitForEvent('download');await frame.locator('[data-export=xlsx]').click();expect((await download).suggestedFilename()).toBe('barang.xlsx');
  await frame.locator('#import-open').click();await frame.locator('#import-form input[type=file]').setInputFiles(file);await frame.locator('#import-form button[type=submit]').click();
  await expect(frame.locator('#import-result')).toContainText('Batch ini sudah diimpor');
});
test('researcher sees only scoped records and result acceptance survives review',async({page})=>{await page.goto('/');await role(page,'Peneliti / Akademisi');await page.goto('/peneliti/data/RSET-001');await expect(page.getByRole('heading',{name:'Rincian Akses Data'})).toBeVisible();const dataRows=page.locator('tbody tr');await expect(dataRows.first()).toContainText('Genuk');await page.goto('/peneliti/permohonan/RSET-003');await expect(page.getByRole('heading',{name:'Akses dibatasi'})).toBeVisible();await page.goto('/peneliti/hasil/kirim/RSET-001');await page.getByLabel('Dokumen hasil penelitian',{exact:true}).setInputFiles({name:'hasil-demo.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF')});await page.locator('#result-summary').fill('Ringkasan penelitian demo untuk pemeriksaan alur.');await page.locator('#result-feedback').fill('Perlu memperjelas cakupan dan metadata kejadian.');await page.getByRole('button',{name:'Tinjau Hasil'}).click();await page.getByRole('button',{name:'Kirim Hasil Penelitian',exact:true}).click();await expect(page.locator('.badge').filter({hasText:/^Sudah diterima$/})).toBeVisible();await role(page,'Admin Sistem BPBD');await page.goto('/riset/hasil/RSET-001');await page.getByRole('combobox',{name:'Status review',exact:true}).click();await page.getByRole('option',{name:'Perlu Perbaikan',exact:true}).click();await page.locator('#result-note').fill('Tambahkan penjelasan metode.');await page.getByRole('button',{name:'Simpan Review'}).click();await expect(page.locator('.badge').filter({hasText:/^Sudah diterima$/})).toBeVisible();await expect(page.locator('.badge').filter({hasText:/^Perlu Perbaikan$/})).toBeVisible();});

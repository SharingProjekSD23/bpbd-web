import { chromium } from 'playwright';
import { seedStore, DEMO_PASSWORD, home } from '../lib/bpbd/model.ts';
import { mkdir, writeFile } from 'node:fs/promises';
const baseURL=process.env.BPBD_TEST_URL || 'http://127.0.0.1:5174';
await mkdir('outputs/browser',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
try {
  for(const role of ['KL','PK','RR','SEK','ADM','PEN']){
    const user=seedStore().users.find(u=>u.role===role && u.status==='Aktif');
    const context=await browser.newContext({baseURL,viewport:{width:1440,height:1000}}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const login=await context.request.post('/api/bpbd/login',{headers:{'X-BPBD-Request':'1'},data:{email:user.email,password:DEMO_PASSWORD}});
    if(login.status()!==200)throw new Error(`Login ${role} failed: ${login.status()}`);
    await page.goto(home(role));await page.getByRole('heading',{level:1}).first().waitFor();
    await page.screenshot({path:`outputs/browser/${role}-dashboard.png`,fullPage:true});
    if(['KL','PK','RR','SEK'].includes(role)){
      await page.getByRole('link',{name:'Operasional Bidang',exact:true}).click();
      const frame=page.frameLocator('iframe[title="Ruang kerja operasional BPBD"]');
      await frame.locator('.unit-card').first().waitFor();
      const unit=role==='SEK'?'KL':role;
      await frame.locator(`.unit-card[data-unit="${unit}"]`).click();
      await frame.locator('#module-content table').waitFor();
      if(role==='SEK' && await frame.locator('#add-open').count())throw new Error('Sekretariat has editing button on KL');
      await page.screenshot({path:`outputs/browser/${role}-operasional.png`,fullPage:true});
      await page.setViewportSize({width:390,height:844});await page.screenshot({path:`outputs/browser/${role}-mobile.png`,fullPage:true});
    }else if(role==='ADM'){
      await page.getByRole('link',{name:'Hasil Penelitian',exact:true}).click();await page.getByRole('heading',{name:'Hasil & Repository Penelitian',exact:true}).waitFor();
    }
    if(errors.length)throw new Error(`${role}: ${errors.join('; ')}`);
    results.push({role,login:true,render:true,pageErrors:errors.length});
    await context.request.post('/api/bpbd/logout',{headers:{'X-BPBD-Request':'1'}});await context.close();
  }
}finally{await browser.close();}
await writeFile('outputs/browser/report.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));

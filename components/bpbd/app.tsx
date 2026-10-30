"use client";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BookOpen, ChevronDown, ChevronRight, ClipboardCheck, Database, FileClock, FileText, FlaskConical, FolderOpen, GraduationCap, HelpCircle, LayoutDashboard, LockKeyhole, LogOut, Menu, Settings, Shield, ShieldCheck, Upload, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { Sidebar, SidebarContent, SidebarFooter, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { AppContext, useApp, type Registration } from './context';
import { Action } from './shared';
import Dashboard from './dashboard';
import { Approvals, DataDetail, DataForm, DataList, ImportPage, Reports, SystemPage } from './operations';
import { AccessDetail, ResearchDetail, ResearchForm, ResearchHome, ResearchList, ResultDetail, ResultForm } from './research';
import { ApplyAccess, AuditPage, Masters, Permissions, Settings as SettingsPage, UsersPage } from './admin';
import { AccountStatus, Auth, Help, Profile } from './auth';
import { canEdit, canRead, canReviewOperational, canVisit, sessionUser, formatDate, groups, home, isReviewer, referenceDate, roles, seedStore, type Filters, type Role, type Store } from '@/lib/bpbd/model';
import { api, RequestError, type Snapshot } from '@/lib/bpbd/api';
function emptyStore(): Store { const store = seedStore(); return { ...store, users: [], entries: [], research: [], reports: [], imports: [], audit: [] }; }
export default function BPBDApp() {
 const [store,setStore] = useState<Store>(emptyStore);
 const [userId,setUserId] = useState<string|null>(null);
 const user = sessionUser(store,userId);
 const role:Role = user?.role || 'PEN';
 const [location,setLocation] = useState('/masuk');
 const [ready,setReady] = useState(false);
 const [dirty,setDirtyState] = useState(false);
 const [pending,setPending] = useState<(()=>void)|null>(null);
 const dirtyRef = useRef(false);
 const stateRef = useRef(store);
 const userIdRef = useRef<string|null>(null);
 const filters = useRef(new Map<string,Filters>());
 const [storageWarning,setStorageWarning] = useState('');
 const revisionRef = useRef(0);
 const savingRef = useRef(false);
 const authGeneration = useRef(0);
 const applySnapshot = useCallback((snapshot:Snapshot)=>{
  const next=snapshot.store||emptyStore();stateRef.current=next;setStore(next);
  revisionRef.current=snapshot.revision;userIdRef.current=snapshot.userId;setUserId(snapshot.userId);setStorageWarning('');
 },[]);
 const resetSession = useCallback(()=>{authGeneration.current++;applySnapshot({store:null,revision:0,userId:null});filters.current.clear();},[applySnapshot]);
 const setDirty = useCallback((value:boolean)=>{dirtyRef.current=value;setDirtyState(value);},[]);
 const commitNavigation = useCallback((path:string)=>{window.history.pushState({},'',path);setLocation(path);window.scrollTo({top:0,behavior:'instant'});},[]);
 const clearSession = useCallback(async()=>{try{await api('logout','POST');resetSession();}catch(e){toast.error((e as Error).message);throw e;}},[resetSession]);
 const navigate = useCallback((path:string)=>{
  if(!path.startsWith('/')||path.startsWith('//'))return;
  const go=async()=>{try{if(path==='/masuk')await clearSession();commitNavigation(path);}catch{}};
  if(dirtyRef.current)setPending(()=>go);else go();
 },[commitNavigation,clearSession]);
 const acceptLogin = useCallback((snapshot:Snapshot)=>{
  authGeneration.current++;applySnapshot(snapshot);filters.current.clear();
  const account=snapshot.store?.users.find(u=>u.id===snapshot.userId);
  if(account)commitNavigation(account.role==='PEN'&&account.status!=='Aktif'?'/status-akun':home(account.role));
 },[applySnapshot,commitNavigation]);
 const signIn = useCallback(async(email:string,password:string)=>{
  try{acceptLogin(await api<Snapshot>('login','POST',{email,password}));return true;}
  catch(e){toast.error((e as Error).message);return false;}
 },[acceptLogin]);
 const register = useCallback(async(input:Registration)=>{
  try{acceptLogin(await api<Snapshot>('register','POST',input));return true;}
  catch(e){toast.error((e as Error).message);return false;}
 },[acceptLogin]);
 const mutate = useCallback(async(update:(s:Store)=>void,action='',object='')=>{
  if(savingRef.current){toast.error('Tunggu penyimpanan sebelumnya selesai.');return false;}
  savingRef.current=true;
  try{
   const next=structuredClone(stateRef.current);update(next);
   applySnapshot(await api<Snapshot>('state','PUT',{store:next,revision:revisionRef.current,action,object}));return true;
  }catch(e){
   if(e instanceof RequestError&&e.status===409){try{applySnapshot(await api<Snapshot>('state'));}catch{}}
   if(e instanceof RequestError&&e.status===401)resetSession();
   toast.error((e as Error).message||'Perubahan belum tersimpan di server.');return false;
  }finally{savingRef.current=false;}
 },[applySnapshot,resetSession]);
 useEffect(()=>{
  let cancelled=false;
  async function load(){
   try{const snapshot=await api<Snapshot>('state');if(cancelled)return;applySnapshot(snapshot);}
   catch(e){if(cancelled)return;if(!(e instanceof RequestError&&e.status===401))setStorageWarning((e as Error).message);}
   if(cancelled)return;
   const current=window.location.pathname+window.location.search;
   const account=sessionUser(stateRef.current,userIdRef.current);
   const publicPage=['/masuk','/daftar-peneliti','/pemulihan-akun'].includes(window.location.pathname);
   const target=account&&(current==='/'||current==='/masuk')?(account.role==='PEN'&&account.status!=='Aktif'?'/status-akun':home(account.role)):!account&&!publicPage?'/masuk':current;
   if(target!==current)window.history.replaceState({},'',target);
   setLocation(target);setReady(true);
  }
  void load();return()=>{cancelled=true;};
 },[applySnapshot]);
 useEffect(()=>{
  if(ready&&userId&&!user){resetSession();setDirty(false);window.history.replaceState({},'','/masuk');setLocation('/masuk');toast.error('Sesi berakhir karena akun tidak tersedia atau dinonaktifkan.');}
 },[ready,userId,user,resetSession,setDirty]);
 useEffect(()=>{
  const pop=()=>{const target=window.location.pathname+window.location.search;if(dirtyRef.current){window.history.pushState({},'',location);setPending(()=>()=>commitNavigation(target));}else setLocation(target);};
  const unload=(e:BeforeUnloadEvent)=>{if(dirtyRef.current){e.preventDefault();e.returnValue='';}};
  window.addEventListener('popstate',pop);window.addEventListener('beforeunload',unload);
  return()=>{window.removeEventListener('popstate',pop);window.removeEventListener('beforeunload',unload);};
 },[location,commitNavigation]);
 useEffect(()=>{
  let cancelled=false;
  const refresh=async()=>{
   if(!ready||!userIdRef.current||savingRef.current||dirtyRef.current||document.hidden)return;
   const generation=authGeneration.current,revision=revisionRef.current;
   try{const next=await api<Snapshot>('state');if(!cancelled&&generation===authGeneration.current&&!savingRef.current&&!dirtyRef.current&&revision===revisionRef.current){applySnapshot(next);}}
   catch(e){if(cancelled||generation!==authGeneration.current)return;if(e instanceof RequestError&&e.status===401){resetSession();commitNavigation('/masuk');}else setStorageWarning((e as Error).message);}
  };
  const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);
  return()=>{cancelled=true;clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[ready,applySnapshot,resetSession,commitNavigation]);
 useEffect(()=>{
  const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>|void}}).modelContext;
  if(!context?.registerTool)return;
  const lifecycle=new AbortController();
  const register=(tool:unknown)=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}};
  const requireAccount=()=>{const account=sessionUser(stateRef.current,userIdRef.current);if(!account)throw new Error('Silakan login terlebih dahulu.');return account;};
  register({name:'read_bpbd_demo_summary',title:'Baca ringkasan demo BPBD',description:'Baca ringkasan data sintetis yang diizinkan untuk akun aktif.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{
   if(!input||typeof input!=='object'||Object.keys(input).length)throw new Error('Masukan harus berupa objek kosong.');
   const account=requireAccount(),s=stateRef.current;
   if(account.role==='PEN')return{role:account.role,requests:account.status==='Aktif'?s.research.filter(x=>x.owner===account.id).map(x=>({id:x.id,title:x.title,status:x.status})):[]};
   return{role:account.role,approvedRecords:s.entries.filter(e=>!e.archived&&e.status==='Disetujui'&&canRead(account.role,e.group)).length};
  }});
  register({name:'navigate_bpbd_demo',title:'Buka halaman demo BPBD',description:'Membuka halaman yang diizinkan bagi akun aktif.',inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false},annotations:{readOnlyHint:false},execute:(input:unknown)=>{
   const account=requireAccount();
   if(!input||typeof input!=='object'||!('path'in input)||typeof input.path!=='string'||!/^\/(dashboard|data|laporan|peneliti|riset|impor|profil|bantuan|admin|audit|persetujuan)(\/|$)/.test(input.path))throw new Error('Route tidak valid.');
   if(dirtyRef.current)throw new Error('Selesaikan perubahan form sebelum berpindah.');
   if(!canVisit(stateRef.current,account.role,input.path,account.id))throw new Error('Akses dibatasi.');
   commitNavigation(input.path);return{path:input.path,opened:true};
  }});
  return()=>lifecycle.abort();
 },[commitNavigation]);
 const path=location.split('?')[0];const query=new URLSearchParams(location.split('?')[1]||'');
 const publicRoute=['/masuk','/daftar-peneliti','/pemulihan-akun'].includes(path);
 if(!ready)return <div style={{padding:40,maxWidth:1200,margin:'auto'}}><Skeleton className="h-12 w-72 mb-8"/><div className="stats-grid">{[1,2,3,4].map(n=><Skeleton key={n} className="h-36"/>)}</div><Skeleton className="h-72"/><p className="small muted" style={{marginTop:15}}>Memuat ruang kerja BPBD…</p></div>;
 return <AppContext.Provider value={{store,user,role,path,query,navigate,signIn,register,mutate,dirty,setDirty,filters:filters.current}}><a className="skip-link" href="#main-content">Lewati ke konten utama</a><Toaster richColors theme="light" position="bottom-right"/>{storageWarning&&<div role="alert" className="notice danger" style={{margin:15}}>{storageWarning}</div>}{publicRoute||!user?<Auth key={path} mode={publicRoute?path.slice(1):'masuk'}/>:<SidebarProvider style={{'--sidebar-width':'240px'} as React.CSSProperties}><AppSidebar/><div className="shell-main"><Header/><main id="main-content" className="content" tabIndex={-1}>{canVisit(store,role,path,user.id)?<RoutePage key={`${user.id}:${role}:${path}`}/>:<SystemPage code="403"/>}<footer className="footer"><span>© 2026 BPBD Kota Semarang · Prototipe UI/UX</span><span>Data demo · Waktu Indonesia Barat (WIB)</span></footer></main></div></SidebarProvider>}<AlertDialog open={!!pending} onOpenChange={open=>!open&&setPending(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Perubahan belum disimpan</AlertDialogTitle><AlertDialogDescription>Isian Anda akan hilang jika meninggalkan halaman. Tetap di halaman untuk meninjau dan menyimpan form.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Tetap di Halaman</AlertDialogCancel><AlertDialogAction onClick={()=>{const go=pending;setDirty(false);setPending(null);go?.();}}>Tinggalkan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></AppContext.Provider>;
}
function AppSidebar(){const {role,store,user,path,navigate}=useApp();const {setOpenMobile,isMobile}=useSidebar();const active=user?.status==='Aktif';const pending=store.entries.filter(e=>!e.archived&&canReviewOperational(role)&&e.status==='Menunggu Persetujuan').length;type Item={label:string;path:string;icon:React.ElementType;count?:number};const menus:Item[]=role==='PEN'?(active?[{label:'Beranda Peneliti',path:'/peneliti',icon:LayoutDashboard},{label:'Permohonan Saya',path:'/peneliti/permohonan',icon:ClipboardCheck},{label:'Data yang Disetujui',path:'/peneliti/data',icon:ShieldCheck},{label:'Hasil Penelitian',path:'/peneliti/hasil',icon:FileText}]:[{label:'Status Akun',path:'/status-akun',icon:Shield}]):[{label:role==='ADM'?'Dashboard Utama':'Dashboard Bidang',path:home(role),icon:LayoutDashboard},{label:'Data Bidang',path:'/data',icon:Database},...(role!=='ADM'||store.adminOperational?[{label:'Impor Data',path:'/impor',icon:Upload}]:[]),...(canReviewOperational(role)?[{label:'Persetujuan Data',path:'/persetujuan',icon:ClipboardCheck,count:pending}]:[]),{label:'Laporan',path:'/laporan',icon:FileText}];const research:Item[]=role==='SEK'||isReviewer(store,role)?[{label:'Permohonan Data',path:'/riset/permohonan',icon:FlaskConical},{label:'Hasil Penelitian',path:'/riset/hasil',icon:GraduationCap}]:[];const admin:Item[]=role==='ADM'?[{label:'Pengguna',path:'/admin/pengguna',icon:Users},{label:'Persetujuan Akun',path:'/admin/pendaftaran',icon:ClipboardCheck,count:store.users.filter(u=>u.role==='PEN'&&u.status==='Menunggu Persetujuan').length},{label:'Hak Akses',path:'/admin/hak-akses',icon:LockKeyhole},{label:'Izin Data Peneliti',path:'/admin/akses-riset',icon:ShieldCheck},{label:'Master Data',path:'/admin/master',icon:FolderOpen},{label:'Audit Trail',path:'/audit',icon:FileClock},{label:'Pengaturan',path:'/admin/pengaturan',icon:Settings}]:[];function link(item:Item){const selected=item.path==='/peneliti'?path==='/peneliti':item.path.startsWith('/dashboard')?path.startsWith('/dashboard'):path===item.path||path.startsWith(item.path+'/');return <a className={`nav-link ${selected?'active':''}`} href={item.path} key={item.path} aria-current={selected?'page':undefined} onClick={e=>{if(e.ctrlKey||e.metaKey)return;e.preventDefault();navigate(item.path==='/admin/master'?'/admin/master/wilayah':item.path);if(isMobile)setOpenMobile(false);}}><item.icon/><span>{item.label}</span>{!!item.count&&<span className="nav-count">{item.count}</span>}</a>;}
return <Sidebar><div className="brand"><img src="/logo-bpbd.png" alt="Logo BPBD" width="44" height="44"/><div><strong>BPBD SEMARANG</strong><small>SIAGA · DATA CENTER</small></div>{isMobile&&<button aria-label="Tutup navigasi" className="icon-button" onClick={()=>setOpenMobile(false)}><X size={18}/></button>}</div><SidebarContent className="gap-0"><div className="nav-caption" style={{marginTop:9}}>MENU UTAMA</div><nav aria-label="Menu utama" style={{padding:'0 12px'}}>{menus.map(link)}</nav>{research.length>0&&<><div className="nav-caption">LAYANAN PENELITIAN</div><nav aria-label="Layanan penelitian" style={{padding:'0 12px'}}>{research.map(link)}</nav></>}{admin.length>0&&<><div className="nav-caption">ADMINISTRASI</div><nav aria-label="Administrasi" style={{padding:'0 12px'}}>{admin.map(link)}</nav></>}</SidebarContent><SidebarFooter className="p-0 gap-0"><div className="sidebar-help"><HelpCircle size={19} style={{color:'#647b9f'}}/><strong style={{display:'block',marginTop:8}}>Butuh panduan?</strong><p>Pelajari alur pengelolaan data dan layanan penelitian.</p><button className="text-button" onClick={()=>{navigate('/bantuan');setOpenMobile(false);}}>Buka Pusat Bantuan</button></div><div className="sidebar-bottom"><ShieldCheck size={16}/>Ruang kerja BPBD Kota Semarang</div></SidebarFooter></Sidebar>;
}
function Header(){const {role,store,user,path,navigate}=useApp();const [notifications,setNotifications]=useState(false);const [read,setRead]=useState(false);const name=user!.name;const requests=store.research.filter(r=>role==='PEN'?user!.status==='Aktif'&&r.owner===user!.id:role==='SEK'||isReviewer(store,role)&&r.requestedGroups.some(g=>groups[g].role===role));const due=requests.filter(r=>!r.versions.length&&Math.ceil((Date.parse(r.deadline)-Date.parse(referenceDate))/86400000)<=store.settings.reminderDays);const notificationsList=role==='ADM'?store.users.filter(u=>u.role==='PEN'&&u.status==='Menunggu Persetujuan').map(u=>({id:u.id,title:`Pendaftaran ${u.name}`,note:'Menunggu pemeriksaan identitas',path:'/admin/pendaftaran'})).concat(store.entries.filter(e=>!e.archived&&e.status==='Menunggu Persetujuan').map(e=>({id:e.id,title:e.title,note:'Menunggu validasi Admin inti',path:`/persetujuan/${e.id}`}))):role==='PEN'?requests.map(r=>({id:r.id,title:r.title,note:`Permohonan: ${r.status} · Tenggat ${formatDate(r.deadline)}`,path:`/peneliti/permohonan/${r.id}`})):[...due.map(r=>({id:r.id,title:`Pengingat hasil: ${r.title}`,note:`Tenggat ${formatDate(r.deadline)}`,path:`/riset/hasil/${r.id}`})),...store.entries.filter(e=>!e.archived&&canReviewOperational(role)&&e.status==='Menunggu Persetujuan').map(e=>({id:e.id,title:e.title,note:'Menunggu validasi Admin inti',path:`/persetujuan/${e.id}`}))];return <><header className="global-header"><div className="header-context"><SidebarTrigger aria-label="Buka atau tutup navigasi" className="mr-1"/><span>Sistem Informasi Kebencanaan</span><ChevronRight size={13}/><strong>{role==='PEN'?'Area Peneliti':roles[role].short}</strong></div><div className="header-actions"><button className="icon-button" aria-label={`Notifikasi, ${read?0:notificationsList.length} belum dibaca`} style={{position:'relative'}} onClick={()=>setNotifications(true)}><Bell size={19}/>{!read&&notificationsList.length>0&&<span style={{position:'absolute',right:6,top:4,width:7,height:7,borderRadius:'50%',background:'#e88341',border:'1px solid white'}}/>}</button><DropdownMenu><DropdownMenuTrigger asChild><button className="user-info" aria-label="Menu akun"><span className="avatar">{name.split(' ').slice(0,2).map(part=>part[0]).join('')}</span><div style={{textAlign:'left'}}><strong>{name.replace(' (Demo)','')}</strong><small>{roles[role].short}</small></div><ChevronDown size={13}/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>navigate('/profil')}>Profil Saya</DropdownMenuItem><DropdownMenuItem onClick={()=>navigate('/bantuan')}>Bantuan</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>navigate('/masuk')}><LogOut size={15}/>Keluar</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></header><div className="demo-bar"><div className="demo-label"><FlaskConical size={14}/><strong>DATA DEMO</strong><span className="demo-description">Prototipe · Tersimpan di browser ini</span></div><div className="demo-controls"><span className="small">{roles[role].short}</span><button className="text-button" onClick={()=>navigate('/masuk')}>Ganti Akun</button></div></div><Sheet open={notifications} onOpenChange={setNotifications}><SheetContent className="p-6 overflow-y-auto"><SheetHeader className="p-0"><SheetTitle>Notifikasi</SheetTitle><SheetDescription>Pembaruan dan pengingat untuk role Anda.</SheetDescription></SheetHeader><button className="text-button" onClick={()=>setRead(true)}>Tandai semua dibaca</button>{notificationsList.length?notificationsList.map(n=><button className="notification" key={n.id} style={{textAlign:'left',width:'100%'}} onClick={()=>{navigate(n.path);setNotifications(false);}}><strong>{n.title}</strong><small>{n.note}</small></button>):<p className="small muted" style={{marginTop:20}}>Tidak ada notifikasi untuk saat ini.</p>}</SheetContent></Sheet></>;}
function RoutePage(){const {path,store,role}=useApp();const p=path.split('/').filter(Boolean);if(path==='/'||path.startsWith('/dashboard'))return <Dashboard/>;if(path==='/profil')return <Profile/>;if(path==='/bantuan')return <Help/>;if(path==='/status-akun')return <AccountStatus/>;if(['403','404','gangguan'].includes(p[0]))return <SystemPage code={p[0]}/>;
 if(p[0]==='data'){if(p.length<3)return <DataList group={p[1]}/>;if(p[2]==='baru'||p[3]==='edit')return <DataForm group={p[1]} id={p[3]==='edit'?p[2]:undefined}/>;return <DataDetail group={p[1]} id={p[2]}/>;}
 if(p[0]==='impor')return p[1]==='pekerjaan'?<ImportPage jobId={p[2]}/>:<ImportPage group={p[1]}/>;
 if(p[0]==='persetujuan'){if(!p[1])return <Approvals/>;const entry=store.entries.find(e=>e.id===p[1]);return entry?<DataDetail group={entry.group} id={entry.id} review/>:<SystemPage code="404"/>;}
 if(p[0]==='laporan')return <Reports id={p[1]&&!['baru','template'].includes(p[1])?p[1]:undefined} create={p[1]==='baru'} template={p[1]==='template'}/>;
 if(p[0]==='riset'||p[0]==='peneliti'){const internal=p[0]==='riset';if(!p[1])return internal?<SystemPage code="404"/>:<ResearchHome/>;if(p[1]==='permohonan'){if(p[2]==='baru'||p[3]==='edit')return !internal?<ResearchForm id={p[3]==='edit'?p[2]:undefined}/>:<SystemPage code="404"/>;return p[2]?<ResearchDetail id={p[2]} internal={internal}/>:<ResearchList internal={internal}/>;}if(p[1]==='data'&&!internal)return p[2]?<AccessDetail id={p[2]}/>:<ResearchList access/>;if(p[1]==='hasil'){if(p[2]==='kirim'&&!internal)return <ResultForm id={p[3]}/>;return p[2]?<ResultDetail id={p[2]} internal={internal}/>:<ResearchList internal={internal} results/>;}}
 if(p[0]==='admin'){if(p[1]==='pengguna')return <UsersPage id={p[2]&&p[2]!=='baru'?p[2]:undefined} create={p[2]==='baru'}/>;if(p[1]==='pendaftaran')return <UsersPage registrations/>;if(p[1]==='hak-akses')return <Permissions/>;if(p[1]==='master')return <Masters type={p[2]||'wilayah'}/>;if(p[1]==='pengaturan')return <SettingsPage/>;if(p[1]==='akses-riset')return <ApplyAccess/>;}
 if(p[0]==='audit')return <AuditPage/>;return <SystemPage code="404"/>;
}

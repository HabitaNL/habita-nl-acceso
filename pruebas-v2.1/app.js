  import {firebaseConfig} from './firebase-config.js';
import {getStorage,ref as storageRef,uploadBytes,getDownloadURL,deleteObject} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js';
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,getDoc,setDoc,addDoc,updateDoc,collection,getDocs,query,where,serverTimestamp,writeBatch} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const $=id=>document.getElementById(id),msg=t=>$('message').textContent=t,show=(id,visible)=>$(id).hidden=!visible;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let auth,db,storage,current,profile,properties=[],prospects=[];
if(firebaseConfig.apiKey==='REEMPLAZAR'){msg('Configuración pendiente: edita firebase-config.js y sigue README.md. Puedes abrir la demo v0.8.');$('signIn').disabled=true;}
else{
try{const app=initializeApp(firebaseConfig);auth=getAuth(app);db=getFirestore(app);storage=getStorage(app);onAuthStateChanged(auth,async u=>{current=u;profile=null;show('welcome',!u);show('pending',false);show('app',false);$('who').textContent=u?.email||'Sin iniciar sesión';if(!u){msg('Inicia sesión con Gmail.');return}await checkAccess();});msg('Configuración cargada. Ingresa con Gmail.');}
catch(e){msg('Error de configuración Firebase: '+e.message);$('signIn').disabled=true;}
}
$('signIn').onclick=async()=>{try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){msg('No se pudo iniciar sesión: '+e.message)}};
async function checkAccess(){try{const s=await getDoc(doc(db,'users',current.uid));profile=s.exists()?s.data():null;if(profile?.status==='active'&&profile.email===current.email){show('app',true);show('pending',false);msg('Acceso autorizado · '+profile.role);$('navRequests').hidden=profile.role!=='admin';$('propertyForm').style.display=profile.role==='admin'?'':'none';await loadData();return}show('pending',true);show('app',false);$('pendingText').textContent=profile?.status==='suspended'?'Cuenta suspendida. Contacta al administrador.':profile?.status==='pending'?'Solicitud enviada. Pendiente de autorización.':'Tu cuenta aún no tiene autorización. Solicita acceso o espera la invitación.';$('requestAccess').disabled=profile?.status==='suspended';msg('Sin acceso al inventario.');}catch(e){msg('No se pudo verificar el acceso: '+e.message)}}
$('requestAccess').onclick=async()=>{try{await setDoc(doc(db,'requests',current.uid),{email:current.email,displayName:current.displayName||'',status:'pending',createdAt:serverTimestamp()});msg('Solicitud registrada. El administrador deberá aprobarla.');await checkAccess()}catch(e){msg('No se pudo solicitar acceso: '+e.message)}};
$('refreshAccess').onclick=checkAccess;
for(const id of ['signOut','signOutPending'])$(id).onclick=()=>signOut(auth);
const views=['home','properties','requests','prospects','agenda','dashboard','alerts','opportunities','funnel','facebook'];function navigate(v){for(const x of views)show(x+'View',x===v);show('inventoryAdmin',v==='properties'&&profile?.role==='admin');if(v==='properties')$('propertyForm').style.display=profile?.role==='admin'?'':'none';if(v!=='properties'){show('editPropertyPanel',false);closeGallery()}if(v==='properties')renderAdminProperties()};

$('navFunnel').onclick=async()=>{navigate('funnel');await loadFunnel();};
$('navFacebook').onclick=async()=>{
  navigate('facebook');
  $('facebookGroupAdmin').style.display=profile?.role==='admin'?'':'none';
  await loadFacebookGroups();
  loadFacebookProperties();
  await loadFacebookPublications();
};

function loadFacebookProperties(){
  const selector=$('facebookPropertySelect');
  const preview=$('facebookPropertyPreview');
  if(!selector||!preview)return;

  const previousSelection=selector.value;
  selector.replaceChildren(new Option('Selecciona una propiedad',''));
  preview.hidden=true;

  const disponibles=properties.filter(p=>
  !p.archived &&
  String(p.status||'').trim().toLowerCase()==='disponible'
);

  for(const p of disponibles){
    selector.add(new Option(
      `${p.title||'Sin título'} - ${p.municipality||''}`,
      p.id
    ));
  }

  if(disponibles.some(p=>p.id===previousSelection))selector.value=previousSelection;

  selector.onchange=()=>{
    const p=disponibles.find(x=>x.id===selector.value);
    preview.hidden=!p;
    if(!p)return;

    $('facebookPropertyTitle').textContent=p.title||'Propiedad';

    const fotos=Array.isArray(p.photos)
  ? p.photos.filter(f=>f?.url)
  : [];

const photoSelect=$('facebookPhotoSelect');
const portada=$('facebookPropertyCover');

photoSelect.replaceChildren(
  new Option('Selecciona una fotografía','')
);

fotos.forEach((foto,index)=>{
  photoSelect.add(
    new Option(`Fotografía ${index+1}`,String(index))
  );
});

photoSelect.value=fotos.length?'0':'';

const actualizarFotografia=()=>{
  const indice=photoSelect.value===''?-1:Number(photoSelect.value);
  const foto=fotos[indice];

  portada.hidden=!foto?.url;

  if(foto?.url){
    portada.src=foto.url;
  }else{
    portada.removeAttribute('src');
  }
};

photoSelect.onchange=actualizarFotografia;
actualizarFotografia();

    const precio=Number(p.price||0).toLocaleString('es-MX',{
      style:'currency',
      currency:'MXN',
      maximumFractionDigits:0
    });

    const descripcion=[
      p.title||'Propiedad en venta',
      `Ubicación: ${[p.colony,p.municipality].filter(Boolean).join(', ')}`,
      `Precio: ${precio}`,
      `Habitaciones: ${p.beds??'No especificado'}`,
      `Baños: ${p.baths??'No especificado'}`,
      'Información por inbox.'
    ].join('\n');

    $('facebookPropertyDetails').textContent=descripcion;
    $('facebookDownloadCard').onclick=()=>{
  const indice=photoSelect.value===''?-1:Number(photoSelect.value);
  const fotoSeleccionada=fotos[indice];

  if(!fotoSeleccionada?.url){
    return msg('Selecciona una fotografía para generar la ficha.');
  }

  downloadFacebookCard(
    {...p,photos:[fotoSeleccionada]},
    descripcion
  );
};
    
    
    // Compartir ficha por WhatsApp
    $('facebookShareWhatsApp').onclick = async () => {
      const indice = photoSelect.value === ''
        ? -1
        : Number(photoSelect.value);

      const fotoSeleccionada = fotos[indice];

      if (!fotoSeleccionada?.url) {
        return msg('Selecciona una fotografía para compartir la ficha.');
      }

      const propiedad = {
        ...p,
        photos: [fotoSeleccionada]
      };

      
      
      // Preparar la copia de la descripción sin bloquear la apertura de WhatsApp
      let copiaDescripcion = null;

      if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        copiaDescripcion = navigator.clipboard
          .writeText(descripcion)
          .then(() => true)
          .catch(() => false);
      }


      // En computadoras, abrir WhatsApp Web y descargar la ficha.
      if (!/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        
const ventana = window.open('about:blank', '_blank');

const fichaGenerada = await downloadFacebookCard(
  propiedad,
  descripcion,
  false
);

if (!fichaGenerada) {
  if (ventana && !ventana.closed) {
    ventana.close();
  }

  msg('No se pudo generar la ficha PNG. WhatsApp Web no se abrirá.');
  return;
}

const enlace = 'https://web.whatsapp.com/send?text='
  + encodeURIComponent(descripcion);


        

        if (ventana) {
          ventana.location.href = enlace;
        }

        const copiada = copiaDescripcion
          ? await copiaDescripcion
          : false;

        if (copiada) {
          msg(
            'Ficha PNG descargada y descripción copiada. ' +
            'Adjunta la imagen como Fotos y videos en WhatsApp Web ' +
            'y presiona Ctrl + V en el pie de foto.'
          );
        } else {
          msg(
            'Ficha PNG descargada. ' +
            'Utiliza Copiar descripción en HABITA NL ' +
            'y después pégala en el pie de foto de WhatsApp Web.'
          );
        }

        if (!ventana) {
          msg(
            'El navegador bloqueó WhatsApp Web. ' +
            'Abre web.whatsapp.com manualmente. ' +
            (copiada
              ? 'La descripción ya está copiada.'
              : 'Copia la descripción desde HABITA NL.')
          );
        }



        return;
      }

      // En dispositivos móviles, utilizar el menú nativo.
      await downloadFacebookCard(propiedad, descripcion, true);
    };

    $('facebookCopyDescription').onclick=async()=>{
      try{
        await navigator.clipboard.writeText(descripcion);
        msg('Descripción copiada.');
      }catch(e){
        msg('No se pudo copiar la descripción: '+e.message);
      }
    };
  };
  if(selector.value)selector.onchange();
  fillFacebookPublicationProperties();
}


let facebookGroupsCache = [];

function renderFacebookGroups() {
  const container = $('facebookGroupList');
  const selector = $('facebookGroupMunicipalityFilter');
  const summary = $('facebookGroupFilterSummary');

  if (!container || !selector || !summary) return;

  const municipio = selector.value.trim().toLocaleLowerCase('es-MX');

  const groups = facebookGroupsCache.filter(group =>
    !municipio ||
    String(group.municipality || '')
      .trim()
      .toLocaleLowerCase('es-MX') === municipio
  );

  summary.textContent =
    `${groups.length} grupo(s) encontrado(s).`;

  container.replaceChildren();

  if (!groups.length) {
    container.textContent =
      'No hay grupos registrados para este municipio.';
    return;
  }

  const isAdministrator = profile?.role === 'admin';

  for (const group of groups) {
    const card = document.createElement('div');
    card.className = 'card';

    const title = document.createElement('h3');
    title.textContent = group.name || 'Grupo sin nombre';

    const details = document.createElement('p');
    details.textContent = [
      group.municipality || 'Sin municipio',
      group.groupType || 'Sin tipo',
      `${Number(group.members || 0).toLocaleString('es-MX')} miembros`,
      ...(isAdministrator ? [group.status || 'Sin estado'] : [])
    ].join(' · ');

    const link = document.createElement('a');
    link.textContent = 'Abrir grupo en Facebook';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    try {
      const parsed = new URL(group.url);

      if (
        parsed.protocol === 'https:' &&
        ['facebook.com', 'www.facebook.com', 'm.facebook.com']
          .includes(parsed.hostname) &&
        parsed.pathname.startsWith('/groups/')
      ) {
        link.href = parsed.href;
      } else {
        link.textContent = 'Enlace no válido';
      }
    } catch {
      link.textContent = 'Enlace no válido';
    }

    card.append(title, details, link);
    container.appendChild(card);
  }
}

async function loadFacebookGroups(){
  const container=$('facebookGroupList');
  if(!container)return;

  container.textContent='Cargando grupos...';

  try{
    const snapshot=await getDocs(
  profile?.role==='admin'
    ? collection(db,'groups')
    : query(collection(db,'groups'),where('status','==','Activo'))
);
    const isAdministrator=profile?.role==='admin';

    const groups=snapshot.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(g=>isAdministrator||g.status==='Activo')
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es'));

    
    // Guardar los grupos autorizados para filtrarlos sin nuevas consultas.
    facebookGroupsCache = groups;

    // Mantener todos los grupos activos disponibles
    // para registrar publicaciones.
    fillFacebookPublicationGroups(groups);

    const selector = $('facebookGroupMunicipalityFilter');

    if (selector) {
      const seleccionAnterior = selector.value;

      const municipios = new Map();

      for (const group of groups) {
        const nombre = String(group.municipality || '').trim();
        const clave = nombre.toLocaleLowerCase('es-MX');

        if (nombre && !municipios.has(clave)) {
          municipios.set(clave, nombre);
        }
      }

      selector.replaceChildren(
        new Option('Todos los municipios', '')
      );

      const opciones = [...municipios.values()]
        .sort((a, b) => a.localeCompare(b, 'es-MX'));

      for (const municipio of opciones) {
        selector.add(new Option(
          municipio,
          municipio.toLocaleLowerCase('es-MX')
        ));
      }

      selector.value = [...selector.options]
        .some(option => option.value === seleccionAnterior)
          ? seleccionAnterior
          : '';

      selector.onchange = renderFacebookGroups;
    }

    renderFacebookGroups();

  }catch(error){
    container.textContent='Error al cargar los grupos: '+error.message;
  }
}


function getFilteredFacebookGroups() {
  const selector = $('facebookGroupMunicipalityFilter');
  const municipality = String(selector?.value || '')
    .trim()
    .toLocaleLowerCase('es-MX');

  return facebookGroupsCache.filter(group =>
    !municipality ||
    String(group.municipality || '')
      .trim()
      .toLocaleLowerCase('es-MX') === municipality
  );
}

$('facebookExportGroups').onclick = () => {
  const groups = getFilteredFacebookGroups();

  if (!groups.length) {
    msg('No hay grupos para exportar con el filtro seleccionado.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    msg('No se pudo cargar la herramienta de exportación Excel.');
    return;
  }

  const rows = groups.map(group => ({
    'Nombre del grupo': group.name || '',
    'Municipio': group.municipality || '',
    'Tipo de grupo': group.groupType || '',
    'Miembros': Number(group.members || 0),
    'Estado': group.status || '',
    'Reglas u observaciones': group.rules || '',
    'Enlace de Facebook': group.url || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 42 },
    { wch: 22 },
    { wch: 18 },
    { wch: 14 },
    { wch: 16 },
    { wch: 55 },
    { wch: 70 }
  ];

  worksheet['!autofilter'] = {
    ref: worksheet['!ref']
  };

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    'Grupos Facebook'
  );

  const municipality = $('facebookGroupMunicipalityFilter')
    .selectedOptions[0]?.textContent || 'Todos';

  const safeName = municipality
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/gi, '_');

  XLSX.writeFile(
    workbook,
    `HABITA_NL_Grupos_Facebook_${safeName}.xlsx`
  );

  msg(`${groups.length} grupo(s) exportado(s) a Excel.`);
};

$('facebookGroupForm').onsubmit=async e=>{
  e.preventDefault();

  if(profile?.role!=='admin'){
    return msg('Solo el administrador puede registrar grupos.');
  }

  const form=e.target;
  const data=Object.fromEntries(new FormData(form));

  const name=String(data.name||'').trim();
  const municipality=String(data.municipality||'').trim();
  const url=String(data.url||'').trim();
  const members=Number(data.members);

  if(!name||!municipality||!url){
    return msg('Completa los campos obligatorios.');
  }

  let parsedUrl;
  try{
    parsedUrl=new URL(url);
  }catch{
    return msg('Ingresa un enlace válido de Facebook.');
  }

  if(
    parsedUrl.protocol!=='https:'||
    !['facebook.com','www.facebook.com','m.facebook.com'].includes(parsedUrl.hostname)||
    !parsedUrl.pathname.startsWith('/groups/')
  ){
    return msg('El enlace debe corresponder a un grupo de Facebook.');
  }

  if(!Number.isSafeInteger(members)||members<0){
    return msg('Ingresa un número válido de miembros.');
  }

  const statusEl=$('facebookGroupStatus');

  try{
    await addDoc(collection(db,'groups'),{
      name,
      municipality,
      url:parsedUrl.href,
      groupType:data.groupType,
      members,
      rules:String(data.rules||'').trim(),
      status:'Activo',
      ownerUid:current.uid,
      createdAt:serverTimestamp()
    });

    form.reset();
    if(statusEl)statusEl.textContent='Grupo registrado correctamente.';
    msg('Grupo registrado correctamente.');
  }catch(error){
    if(statusEl)statusEl.textContent='Error al registrar el grupo: '+error.message;
    msg('Error al registrar el grupo: '+error.message);
  }
};

for(const v of views){const id='nav'+v[0].toUpperCase()+v.slice(1);$(id).onclick=async()=>{navigate(v);if(v==='requests')await loadAdmin();if(v==='prospects')await loadMyProspects();if(v==='agenda')await loadAgenda();if(v==='alerts')await loadAlerts();if(v==='dashboard')await loadDashboard();if(v==='opportunities')await loadOpportunities();if(v==='facebook'){$('facebookGroupAdmin').style.display=profile?.role==='admin'?'':'none';await loadFacebookGroups();loadFacebookProperties();await loadFacebookPublications()}}};
async function loadData(){try{const [p,r]=await Promise.all([getDocs(collection(db,'properties')),getDocs(collection(db,'prospects_public'))]);properties=p.docs.map(x=>({id:x.id,...x.data()}));prospects=r.docs.map(x=>({id:x.id,...x.data()}));$('kAll').textContent=properties.filter(p=>!p.archived).length;$('kAvailable').textContent=properties.filter(x=>!x.archived&&x.status==='Disponible').length;$('kProspects').textContent=prospects.length;$('propertyRows').innerHTML=properties.filter(p=>!p.archived).map(p=>`<tr><td>${escape(p.id.slice(0,8))}</td><td>${escape(p.title)}</td><td>${escape(p.municipality)}</td><td>${Number(p.price).toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</td><td>${escape(p.status)}</td></tr>`).join('');$('prospectRows').innerHTML=prospects.map(p=>{const matches=properties.filter(x=>!x.archived&&x.status==='Disponible'&&Number(x.price)<=Number(p.maxBudget)&&Number(x.beds)>=Number(p.minBeds)&&p.municipalities.some(m=>m.toLowerCase()===String(x.municipality).toLowerCase())&&(x.payments||[]).includes(p.payment)).length;return `<tr><td>${escape(p.id.slice(0,8))}</td><td>${escape(p.municipalities.join(', '))}</td><td>${Number(p.maxBudget).toLocaleString('es-MX')}</td><td>${Number(p.minBeds)}</td><td>${escape(p.payment)}</td><td>${matches}</td></tr>`}).join('');renderAdminProperties();renderGallery();renderProspectCRM();loadFacebookProperties();}catch(e){msg('Error al consultar datos: '+e.message)}}
$('propertyForm').onsubmit=async e=>{e.preventDefault();if(profile?.role!=='admin')return msg('Acceso denegado: solo el administrador puede registrar propiedades.');const f=e.target,d=Object.fromEntries(new FormData(f)),payments=[...f.querySelectorAll('[name=payment]:checked')].map(x=>x.value);if(!payments.length)return msg('Selecciona al menos una forma de pago');try{await addDoc(collection(db,'properties'),{...d,price:Number(d.price),beds:Number(d.beds),payments,ownerUid:current.uid,createdAt:serverTimestamp()});f.reset();msg('Propiedad guardada en la nube');await loadData()}catch(e){msg('Error al guardar: '+e.message)}};
// v1.3: los datos identificables solo se guardan en /prospects; /prospects_public contiene preferencias.
const splitList=v=>String(v||'').split(',').map(x=>x.trim()).filter(Boolean);
const norm=v=>String(v||'').trim().toLocaleLowerCase('es-MX');
const matchesFor=p=>properties.filter(x=>{
 if(x.archived||x.status!=='Disponible'||Number(x.price)>Number(p.maxBudget)||Number(x.beds)<Number(p.minBeds))return false;
 if(!Array.isArray(p.municipalities)||!p.municipalities.some(m=>norm(m)===norm(x.municipality)))return false;
 if(Array.isArray(p.colonies)&&p.colonies.length&&!p.colonies.some(c=>norm(c)===norm(x.colony)))return false;
 if(p.minBaths!==null&&p.minBaths!==undefined&&p.minBaths!==''&&Number(x.baths||0)<Number(p.minBaths))return false;
 const pay=Array.isArray(p.payments)&&p.payments.length?p.payments:(p.payment?[p.payment]:[]);
 return !pay.length||pay.some(v=>(x.payments||[]).some(q=>norm(q)===norm(v)));
});
let myProspects=[];
let selectedProspectId=null, myActivities=[];
async function loadMyProspects(){
 try{const snap=await getDocs(query(collection(db,'prospects'),where('ownerUid','==',current.uid)));
 myProspects=snap.docs.map(d=>({id:d.id,...d.data()}));renderProspectCRM();
 }catch(e){msg('No se pudo consultar la cartera privada: '+e.message)}
}
function renderProspectCRM(){
 $('privateProspectRows').innerHTML=myProspects.map(p=>`<tr><td>${escape(p.name)}</td><td>${escape(p.phone)}${p.email?' · '+escape(p.email):''}</td><td><select data-stage-id="${escape(p.id)}">${['Nuevo','Contactado','Visita programada','Negociación','Cerrado','Descartado'].map(st=>`<option ${p.stage===st?'selected':''}>${st}</option>`).join('')}</select></td><td>${matchesFor(p).map(x=>escape(x.title)).join(', ')||'Sin coincidencias'}</td><td><button type="button" class="secondary" data-followup-id="${escape(p.id)}">Actividades</button> <button type="button" class="secondary" data-edit-prospect="${escape(p.id)}">Editar ficha</button></td></tr>`).join('')||'<tr><td colspan="5">Todavía no has registrado prospectos.</td></tr>';
 $('privateProspectRows').querySelectorAll('[data-stage-id]').forEach(el=>el.onchange=async()=>{try{await updateDoc(doc(db,'prospects',el.dataset.stageId),{stage:el.value,updatedAt:serverTimestamp()});msg('Etapa actualizada.')}catch(e){msg('Error al actualizar etapa: '+e.message)}});
 $('privateProspectRows').querySelectorAll('[data-followup-id]').forEach(b=>b.onclick=()=>openFollowup(b.dataset.followupId));
 $('privateProspectRows').querySelectorAll('[data-edit-prospect]').forEach(b=>b.onclick=()=>openProspectEdit(b.dataset.editProspect));
 $('prospectRows').innerHTML=prospects.map(p=>`<tr><td>${escape(p.id.slice(0,8))}</td><td>${escape((p.municipalities||[]).join(', '))}</td><td>${Number(p.maxBudget).toLocaleString('es-MX')}</td><td>${Number(p.minBeds)}</td><td>${escape((p.payments||[p.payment]).filter(Boolean).join(' / '))}</td><td>${matchesFor(p).length}</td></tr>`).join('');
 $('matchResults').innerHTML=prospects.map(p=>{const m=matchesFor(p);return m.length?`<div class="card"><strong>Demanda ${escape(p.id.slice(0,8))}</strong><p>${escape((p.municipalities||[]).join(', '))} · ${m.length} coincidencia(s)</p>${m.map(x=>`<div>${escape(x.title)} · ${escape(x.municipality)} · ${Number(x.price).toLocaleString('es-MX',{style:'currency',currency:'MXN'})}</div>`).join('')}</div>`:''}).filter(Boolean).join('')||'<p class="muted">No hay coincidencias con propiedades disponibles.</p>';
}
$('prospectForm').onsubmit=async e=>{e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));const municipalities=splitList(d.municipalities),colonies=splitList(d.colonies),payments=[...f.querySelectorAll('[name=prospectPayment]:checked')].map(x=>x.value);
 if(!municipalities.length||!payments.length)return msg('Selecciona municipio y al menos una forma de pago.');
 const maxBudget=Number(d.maxBudget),minBeds=Number(d.minBeds),minBaths=d.minBaths===''?null:Number(d.minBaths);
 if(!Number.isFinite(maxBudget)||maxBudget<=0||!Number.isInteger(minBeds)||minBeds<0)return msg('Revisa presupuesto y habitaciones.');
 const id=doc(collection(db,'prospects')).id,common={ownerUid:current.uid,municipalities,colonies,maxBudget,minBeds,minBaths,payments,createdAt:serverTimestamp()};
 try{const batch=writeBatch(db);batch.set(doc(db,'prospects',id),{...common,name:d.name.trim(),phone:d.phone.trim(),email:d.email.trim(),stage:d.stage});batch.set(doc(db,'prospects_public',id),common);await batch.commit();f.reset();msg('Prospecto registrado: datos privados y preferencias anónimas guardados.');await loadData();await loadMyProspects();}catch(err){msg('No se pudo guardar el prospecto: '+err.message)}
};
// v1.7: edición privada de prospectos, actualizando preferencias anónimas en el mismo lote.
let editingProspectId=null;
function openProspectEdit(id){
 const p=myProspects.find(x=>x.id===id&&x.ownerUid===current.uid);if(!p)return msg('Solo puedes editar prospectos propios.');
 editingProspectId=id;const f=$('editProspectForm');f.reset();
 for(const k of ['name','phone','email','maxBudget','minBeds','stage'])f.elements[k].value=p[k]??'';
 f.elements.municipalities.value=(p.municipalities||[]).join(', ');f.elements.colonies.value=(p.colonies||[]).join(', ');
 f.elements.minBaths.value=p.minBaths??'';
 const pay=p.payments||[p.payment].filter(Boolean);f.querySelectorAll('[name=editPayment]').forEach(x=>x.checked=pay.includes(x.value));
 show('editProspectPanel',true);$('editProspectPanel').scrollIntoView({block:'start'});
}
$('cancelProspectEdit').onclick=()=>{editingProspectId=null;show('editProspectPanel',false)};
$('editProspectForm').onsubmit=async e=>{
 e.preventDefault();const id=editingProspectId,p=myProspects.find(x=>x.id===id&&x.ownerUid===current.uid);if(!p)return msg('Prospecto no autorizado.');
 const f=e.target,d=Object.fromEntries(new FormData(f)),municipalities=splitList(d.municipalities),colonies=splitList(d.colonies),payments=[...f.querySelectorAll('[name=editPayment]:checked')].map(x=>x.value);
 const maxBudget=Number(d.maxBudget),minBeds=Number(d.minBeds),minBaths=d.minBaths===''?null:Number(d.minBaths);
 if(!d.name.trim()||!d.phone.trim()||!municipalities.length||!payments.length||!Number.isFinite(maxBudget)||maxBudget<=0||!Number.isInteger(minBeds)||minBeds<0)return msg('Revisa nombre, teléfono, municipios, presupuesto, habitaciones y forma de pago.');
 const preferences={municipalities,colonies,payments,maxBudget,minBeds,minBaths};
 try{const batch=writeBatch(db);batch.update(doc(db,'prospects',id),{...preferences,name:d.name.trim(),phone:d.phone.trim(),email:d.email.trim(),stage:d.stage,updatedAt:serverTimestamp()});batch.update(doc(db,'prospects_public',id),preferences);await batch.commit();editingProspectId=null;show('editProspectPanel',false);msg('Ficha y preferencias compartidas actualizadas.');await loadData();await loadMyProspects();}
 catch(err){msg('No se pudo editar el prospecto: '+err.message)}
};
function csv(available){const rows=properties.filter(p=>!p.archived&&(!available||p.status==='Disponible'));const headers=['ID','Título','Municipio','Colonia','Precio MXN','Habitaciones','Baños','Tipo','Formas de pago','Reembolso %','Estatus'];const data=[headers,...rows.map(p=>[p.id,p.title,p.municipality,p.colony,p.price,p.beds,p.baths,p.propertyType,(p.payments||[]).join(' / '),p.reimbursementPercent||'N/A',p.status])];const val=x=>'"'+String(x??'').replace(/^[=+@\-\t\r]/,'\'$&').replace(/"/g,'""')+'"';const content='\ufeff'+data.map(row=>row.map(val).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='HABITA_NL_'+(available?'Disponibles':'Todas')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('exportAvailable').onclick=()=>csv(true);$('exportAll').onclick=()=>csv(false);
async function loadAdmin(){if(profile?.role!=='admin')return;try{const [rs,us]=await Promise.all([getDocs(collection(db,'requests')),getDocs(collection(db,'users'))]);$('requestRows').innerHTML=rs.docs.map(s=>{const r=s.data();return `<div class="card"><strong>${escape(r.email)}</strong> · ${escape(r.status)} <button data-uid="${escape(s.id)}" data-email="${escape(r.email)}" class="approve">Aprobar como asesor</button><button data-uid="${escape(s.id)}" class="reject secondary">Rechazar</button></div>`}).join('')||'Sin solicitudes';$('userRows').innerHTML=us.docs.map(s=>{const u=s.data();return `<div class="card">${escape(u.email)} · ${escape(u.role)} · ${escape(u.status)} ${s.id!==current.uid?`<button class="suspend secondary" data-uid="${escape(s.id)}">Suspender</button>`:''}</div>`}).join('');document.querySelectorAll('.approve').forEach(b=>b.onclick=()=>approve(b.dataset.uid,b.dataset.email));document.querySelectorAll('.reject').forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,'requests',b.dataset.uid),{status:'rejected'});await loadAdmin()});document.querySelectorAll('.suspend').forEach(b=>b.onclick=async()=>{await updateDoc(doc(db,'users',b.dataset.uid),{status:'suspended'});await loadAdmin()})}catch(e){msg('Error administrativo: '+e.message)}}
async function approve(uid,email){try{await setDoc(doc(db,'users',uid),{email,role:'advisor',status:'active',approvedBy:current.uid,updatedAt:serverTimestamp()});await updateDoc(doc(db,'requests',uid),{status:'approved'});msg('Asesor autorizado');await loadAdmin()}catch(e){msg('Error al aprobar: '+e.message)}}
$('inviteButton').onclick=async()=>{const email=$('inviteEmail').value.trim().toLowerCase(),role=$('inviteRole').value;if(!email)return msg('Escribe un correo válido');try{await setDoc(doc(db,'invitations',email),{email,role,status:'pending',createdBy:current.uid,createdAt:serverTimestamp()});msg('Invitación registrada. El asesor debe ingresar y solicitar acceso; el administrador aprobará su cuenta al aparecer la solicitud.');}catch(e){msg('Error al invitar: '+e.message)}};

let editingId=null;
const adminOnly=()=>profile?.role==='admin'&&profile?.status==='active';
function renderAdminProperties(){if(!adminOnly())return;
const term=$('propertySearch').value.toLowerCase(),archived=$('showArchived').checked,status=$('propertyStatusFilter').value;
const rows=properties.filter(p=>Boolean(p.archived)===archived&&(!status||p.status===status)&&[p.title,p.municipality,p.colony].some(x=>String(x||'').toLowerCase().includes(term)));
$('adminPropertyRows').innerHTML=rows.map(p=>`<div class="card"><strong>${escape(p.title)}</strong> · ${escape(p.municipality)} · ${Number(p.price).toLocaleString('es-MX',{style:'currency',currency:'MXN'})} · ${escape(p.status)}<div class="flex"><button class="gallery-open" data-id="${escape(p.id)}">Fotografías (${(p.photos||[]).length})</button>${p.archived?`<button class="restore" data-id="${escape(p.id)}">Restaurar</button><button class="hardDelete secondary" data-id="${escape(p.id)}">Eliminar definitivamente</button>`:`<button class="edit" data-id="${escape(p.id)}">Editar</button><button class="archive secondary" data-id="${escape(p.id)}">Enviar a papelera</button>`}</div></div>`).join('')||'<p>No hay propiedades en esta vista.</p>';
$('adminPropertyRows').querySelectorAll('.gallery-open').forEach(b=>b.onclick=()=>openGallery(b.dataset.id));
for(const [cls,fn] of [['edit',startEdit],['archive',archiveProperty],['restore',restoreProperty],['hardDelete',hardDeleteProperty]])$('adminPropertyRows').querySelectorAll('.'+cls).forEach(b=>b.onclick=()=>fn(b.dataset.id));}
for(const id of ['propertySearch','propertyStatusFilter','showArchived'])$(id).addEventListener('input',renderAdminProperties);
function startEdit(id){if(!adminOnly())return;const p=properties.find(x=>x.id===id&&!x.archived);if(!p)return;editingId=id;const f=$('editPropertyForm');for(const key of ['title','municipality','colony','price','beds','baths','status'])f.elements[key].value=p[key]??'';for(const o of f.elements.payments.options)o.selected=(p.payments||[]).includes(o.value);show('editPropertyPanel',true);$('editPropertyPanel').scrollIntoView({block:'start'});}
$('cancelEdit').onclick=()=>{editingId=null;show('editPropertyPanel',false)};
$('editPropertyForm').onsubmit=async e=>{e.preventDefault();if(!adminOnly()||!editingId)return;const f=e.target,d=Object.fromEntries(new FormData(f)),payments=[...f.elements.payments.selectedOptions].map(o=>o.value);if(!payments.length)return msg('Selecciona una forma de pago');try{await updateDoc(doc(db,'properties',editingId),{title:d.title,municipality:d.municipality,colony:d.colony||'',price:Number(d.price),beds:Number(d.beds),baths:d.baths===''?null:Number(d.baths),status:d.status,payments,updatedBy:current.uid,updatedAt:serverTimestamp()});editingId=null;show('editPropertyPanel',false);msg('Propiedad actualizada');await loadData()}catch(err){msg('Error al editar: '+err.message)}};
async function archiveProperty(id){if(!adminOnly())return;const p=properties.find(x=>x.id===id&&!x.archived);if(!p||!confirm('¿Enviar a papelera: '+p.title+'?'))return;try{await updateDoc(doc(db,'properties',id),{archived:true,archivedBy:current.uid,archivedAt:serverTimestamp()});msg('Propiedad archivada');await loadData()}catch(err){msg('Error al archivar: '+err.message)}}
async function restoreProperty(id){if(!adminOnly())return;try{await updateDoc(doc(db,'properties',id),{archived:false,restoredBy:current.uid,restoredAt:serverTimestamp()});msg('Propiedad restaurada');await loadData()}catch(err){msg('Error al restaurar: '+err.message)}}
async function hardDeleteProperty(id){if(!adminOnly())return;const p=properties.find(x=>x.id===id&&x.archived);if(p?.photos?.length)return msg('Primero elimina las fotografías desde la galería.');if(!p||prompt('Para eliminar definitivamente '+p.title+', escribe ELIMINAR')!=='ELIMINAR')return;try{const batch=writeBatch(db);batch.set(doc(collection(db,'inventory_audit')),{propertyId:id,title:p.title,action:'hard_delete',actorUid:current.uid,actorEmail:current.email,at:serverTimestamp()});batch.delete(doc(db,'properties',id));await batch.commit();msg('Propiedad eliminada definitivamente');await loadData()}catch(err){msg('Error al eliminar: '+err.message)}}

// Galería v1.2: imágenes en Storage, referencias en el documento de propiedad.
let galleryId=null,uploading=false;
const galleryProperty=()=>properties.find(p=>p.id===galleryId);
function openGallery(id){const p=properties.find(x=>x.id===id);if(!p)return;galleryId=id;show('galleryPanel',true);renderGallery();$('galleryPanel').scrollIntoView({block:'start'});}
function closeGallery(){galleryId=null;show('galleryPanel',false)}
$('closeGallery').onclick=closeGallery;
$('closeImage').onclick=()=>show('imageModal',false);
$('imageModal').onclick=e=>{if(e.target.id==='imageModal')show('imageModal',false)};
function renderGallery(){const p=galleryProperty();if(!p)return;
 $('galleryTitle').textContent='Fotografías · '+p.title;
 show('galleryUpload',adminOnly()&&!p.archived);
 const photos=Array.isArray(p.photos)?p.photos:[];
 $('galleryGrid').innerHTML=photos.map((ph,i)=>`<div class="gallery-tile ${i===0?'gallery-main':''}">
 <img src="${escape(ph.url)}" alt="Fotografía ${i+1} de ${escape(p.title)}" data-idx="${i}" loading="lazy">
 <div class="gallery-note">${i===0?'Portada':`Imagen ${i+1}`}</div>
 ${adminOnly()&&!p.archived?`<div class="gallery-controls"><button class="move-left secondary" data-idx="${i}" ${i===0?'disabled':''}>←</button><button class="move-right secondary" data-idx="${i}" ${i===photos.length-1?'disabled':''}>→</button><button class="delete-photo secondary" data-idx="${i}">Quitar</button></div>`:''}</div>`).join('')||'<p>Aún no hay fotografías para esta propiedad.</p>';
 $('galleryGrid').querySelectorAll('img').forEach(el=>el.onclick=()=>{$('largeImage').src=photos[Number(el.dataset.idx)].url;show('imageModal',true)});
 $('galleryGrid').querySelectorAll('.move-left').forEach(el=>el.onclick=()=>movePhoto(Number(el.dataset.idx),-1));
 $('galleryGrid').querySelectorAll('.move-right').forEach(el=>el.onclick=()=>movePhoto(Number(el.dataset.idx),1));
 $('galleryGrid').querySelectorAll('.delete-photo').forEach(el=>el.onclick=()=>removePhoto(Number(el.dataset.idx)));
}
// Reescala antes de subir para limitar consumo de almacenamiento y ancho de banda.
async function compressImage(file){if(file.size>5*1024*1024)throw Error('El archivo excede 5 MB: '+file.name);
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Formato no permitido: '+file.name);
 const bitmap=await createImageBitmap(file);try{const scale=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo comprimir la imagen')),'image/jpeg',0.78));
 if(blob.size>5*1024*1024)throw Error('La imagen comprimida supera 5 MB');return blob;
 }finally{bitmap.close()}}
$('uploadPhotos').onclick=async()=>{if(uploading||!adminOnly())return;const p=galleryProperty();if(!p||p.archived)return;
 const files=[...$('galleryFiles').files];if(!files.length)return msg('Selecciona fotografías.');
 if((p.photos||[]).length+files.length>20)return msg('Máximo 20 fotografías por propiedad.');
 uploading=true;$('uploadPhotos').disabled=true;const uploaded=[];
 try{for(let i=0;i<files.length;i++){const file=files[i];$('galleryProgress').textContent=`Procesando ${i+1} de ${files.length}: ${file.name}`;
 const blob=await compressImage(file);const path=`properties/${p.id}/${crypto.randomUUID()}.jpg`;
 await uploadBytes(storageRef(storage,path),blob,{contentType:'image/jpeg'});
 const url=await getDownloadURL(storageRef(storage,path));uploaded.push({path,url});
 // Guardar cada foto inmediatamente para que un fallo posterior no deje referencias sin persistir.
 const snap=await getDoc(doc(db,'properties',p.id));const photos=Array.isArray(snap.data()?.photos)?snap.data().photos:[];
 if(photos.length>=20){await deleteObject(storageRef(storage,path));throw Error('La galería alcanzó 20 imágenes.');}
 await updateDoc(doc(db,'properties',p.id),{photos:[...photos,{path,url,uploadedBy:current.uid}],updatedBy:current.uid,updatedAt:serverTimestamp()});
 }
 $('galleryFiles').value='';$('galleryProgress').textContent='Carga terminada.';msg('Fotografías guardadas.');await loadData();
 }catch(err){$('galleryProgress').textContent='Carga interrumpida. '+err.message;msg('Error de galería: '+err.message);await loadData();}
 finally{uploading=false;$('uploadPhotos').disabled=false;}
};
async function movePhoto(i,delta){if(!adminOnly()||uploading)return;const p=galleryProperty();if(!p||p.archived)return;const photos=[...(p.photos||[])];const j=i+delta;if(j<0||j>=photos.length)return;
 [photos[i],photos[j]]=[photos[j],photos[i]];
 try{await updateDoc(doc(db,'properties',p.id),{photos,updatedBy:current.uid,updatedAt:serverTimestamp()});await loadData();}catch(err){msg('No se pudo ordenar: '+err.message)}}
async function removePhoto(i){if(!adminOnly()||uploading)return;const p=galleryProperty();if(!p||p.archived)return;const photos=[...(p.photos||[])],ph=photos[i];if(!ph||!confirm('¿Eliminar esta fotografía definitivamente?'))return;
 try{await deleteObject(storageRef(storage,ph.path));photos.splice(i,1);await updateDoc(doc(db,'properties',p.id),{photos,updatedBy:current.uid,updatedAt:serverTimestamp()});msg('Fotografía eliminada.');await loadData();}
 catch(err){msg('No se pudo completar la eliminación: '+err.message+'; si el archivo ya fue borrado, contacta al administrador antes de reintentar.')}}
// Mostrar galería a asesores desde filas del inventario compartido.
const originalLoadData=loadData;
loadData=async function(){await originalLoadData();const rows=$('propertyRows').querySelectorAll('tr');
 rows.forEach(row=>{const id=properties.filter(p=>!p.archived)[[...rows].indexOf(row)]?.id;if(!id)return;
 const cell=document.createElement('td');const b=document.createElement('button');b.className='secondary';b.textContent='Fotos';b.onclick=()=>openGallery(id);cell.appendChild(b);row.appendChild(cell);});};

// v1.4: Seguimiento privado por prospecto, actividades y visitas.
function localNow(){const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
async function openFollowup(id){
 const p=myProspects.find(x=>x.id===id);if(!p)return msg('Prospecto no disponible en tu cartera.');
 selectedProspectId=id;show('followupPanel',true);$('followupTitle').textContent='Seguimiento · '+p.name;
 $('activityForm').reset();$('activityForm').elements.occurredAt.value=localNow();
 $('activityProperty').innerHTML='<option value="">Sin propiedad</option>'+properties.filter(x=>!x.archived).map(x=>`<option value="${escape(x.id)}">${escape(x.title)} · ${escape(x.municipality)}</option>`).join('');
 await loadActivities();$('followupPanel').scrollIntoView({behavior:'smooth',block:'start'});
}
$('closeFollowup').onclick=()=>{selectedProspectId=null;reschedulingId=null;show('reschedulePanel',false);show('followupPanel',false)};
async function loadActivities(){
 if(!selectedProspectId)return;
 try{const snap=await getDocs(query(collection(db,'activities'),where('ownerUid','==',current.uid)));
 myActivities=snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.prospectId===selectedProspectId).sort((a,b)=>String(b.occurredAt).localeCompare(String(a.occurredAt)));
 $('activityHistory').innerHTML=myActivities.map(a=>{const prop=properties.find(p=>p.id===a.propertyId);return `<div class="card"><strong>${escape(a.type)} · ${escape(a.result)}</strong><p>${escape(a.occurredAt.replace('T',' '))}${prop?' · '+escape(prop.title):''}</p>${a.notes?`<p>${escape(a.notes)}</p>`:''}${a.nextAt?`<p><strong>Próximo seguimiento:</strong> ${escape(a.nextAt.replace('T',' '))}</p>`:''}<button type="button" class="secondary" data-reschedule-id="${escape(a.id)}">Reprogramar</button><small>Responsable: ${escape(current.email)}</small></div>`}).join('')||'<p class="muted">Sin actividades registradas.</p>';
 $('activityHistory').querySelectorAll('[data-reschedule-id]').forEach(b=>b.onclick=()=>openReschedule(b.dataset.rescheduleId));
 }catch(e){msg('No se pudo consultar el historial: '+e.message)}
}
// v1.7: reprogramar el registro original, sin duplicar actividades.
let reschedulingId=null;
function openReschedule(id){
 const a=myActivities.find(x=>x.id===id&&x.ownerUid===current.uid&&x.prospectId===selectedProspectId);if(!a)return msg('Actividad no disponible.');
 reschedulingId=id;const f=$('rescheduleForm');f.reset();f.elements.occurredAt.value=a.occurredAt||'';f.elements.nextAt.value=a.nextAt||'';f.elements.result.value='Reprogramada';f.elements.notes.value=a.notes||'';
 show('reschedulePanel',true);$('reschedulePanel').scrollIntoView({block:'start'});
}
$('cancelReschedule').onclick=()=>{reschedulingId=null;show('reschedulePanel',false)};
$('rescheduleForm').onsubmit=async e=>{
 e.preventDefault();const a=myActivities.find(x=>x.id===reschedulingId&&x.ownerUid===current.uid&&x.prospectId===selectedProspectId);if(!a)return msg('Actividad no autorizada.');
 const d=Object.fromEntries(new FormData(e.target));if(!d.occurredAt)return msg('Indica fecha de actividad.');if(d.nextAt&&d.nextAt<d.occurredAt)return msg('El próximo seguimiento no puede ser anterior a la actividad.');
 try{await updateDoc(doc(db,'activities',a.id),{occurredAt:d.occurredAt,nextAt:d.nextAt||'',result:d.result,notes:(d.notes||'').trim(),updatedAt:serverTimestamp()});reschedulingId=null;show('reschedulePanel',false);msg('Actividad reprogramada sin duplicar el registro.');await loadActivities();}
 catch(err){msg('No se pudo reprogramar: '+err.message)}
};
$('activityForm').onsubmit=async e=>{
 e.preventDefault();if(!selectedProspectId||!myProspects.some(p=>p.id===selectedProspectId))return msg('Selecciona un prospecto propio.');
 const d=Object.fromEntries(new FormData(e.target));if(!d.occurredAt)return msg('Indica fecha y hora.');
 if(d.nextAt&&d.nextAt<d.occurredAt)return msg('El siguiente seguimiento no puede ser anterior a la actividad.');
 try{await addDoc(collection(db,'activities'),{ownerUid:current.uid,prospectId:selectedProspectId,type:d.type,result:d.result,occurredAt:d.occurredAt,propertyId:d.propertyId||'',nextAt:d.nextAt||'',notes:(d.notes||'').trim(),createdAt:serverTimestamp()});
 e.target.reset();e.target.elements.occurredAt.value=localNow();msg('Actividad guardada en el historial privado.');await loadActivities();
 }catch(err){msg('Error al guardar actividad: '+err.message)}
};

// v1.5 Agenda comercial. Fechas locales YYYY-MM-DDTHH:mm, sin conversion UTC.
let agendaActivities=[],agendaNames={};
const agendaDate=s=>String(s||'').replace('T',' ');
const agendaPending=a=>['Pendiente','Programada','Reprogramada'].includes(a.result);
const agendaTarget=a=>a.nextAt||a.occurredAt;
async function loadAgenda(){
 if(!current||profile?.status!=='active')return;
 try{
  const [act,pro]=await Promise.all([getDocs(collection(db,'activities')),getDocs(collection(db,'prospects'))]);
  agendaActivities=act.docs.map(d=>({id:d.id,...d.data()})).filter(a=>profile.role==='admin'||a.ownerUid===current.uid);
  agendaNames={};pro.docs.forEach(d=>{const p=d.data();if(profile.role==='admin'||p.ownerUid===current.uid)agendaNames[d.id]=p.name||'Prospecto'});
  renderAgenda();
 }catch(err){msg('Error al cargar agenda: '+err.message)}
}
function renderAgenda(){
 const now=localNow(),week=new Date();week.setDate(week.getDate()+7);
 const end=new Date(week.getTime()-week.getTimezoneOffset()*60000).toISOString().slice(0,16);
 const pending=agendaActivities.filter(agendaPending),overdue=pending.filter(a=>agendaTarget(a)<now),upcoming=pending.filter(a=>agendaTarget(a)>=now&&agendaTarget(a)<=end);
 $('agendaPending').textContent=pending.length;$('agendaOverdue').textContent=overdue.length;$('agendaWeek').textContent=upcoming.length;
 const filter=$('agendaFilter').value,term=$('agendaSearch').value.trim().toLocaleLowerCase('es-MX'),month=$('agendaMonth').value;
 const rows=agendaActivities.filter(a=>{
  const t=agendaTarget(a),isPending=agendaPending(a);
  if(month&&!t.startsWith(month))return false;
  if(filter==='pending'&&!isPending||filter==='overdue'&&!(isPending&&t<now)||filter==='week'&&!(isPending&&t>=now&&t<=end)||filter==='done'&&a.result!=='Realizada')return false;
  const prop=properties.find(p=>p.id===a.propertyId)?.title||'';
  return !term||[a.type,a.result,a.notes,prop,agendaNames[a.prospectId]||''].join(' ').toLocaleLowerCase('es-MX').includes(term);
 }).sort((a,b)=>agendaTarget(a).localeCompare(agendaTarget(b)));
 $('agendaRows').innerHTML=rows.map(a=>{
  const prop=properties.find(p=>p.id===a.propertyId)?.title||'Sin propiedad';
  const canEdit=a.ownerUid===current.uid;
  return `<div class="card"><strong>${escape(a.type)} · ${escape(a.result)}</strong><p><strong>Fecha:</strong> ${escape(agendaDate(a.occurredAt))} · <strong>Próxima acción:</strong> ${escape(agendaDate(a.nextAt)||'No indicada')}</p><p><strong>Prospecto:</strong> ${escape(agendaNames[a.prospectId]||'Privado de otro asesor')} · <strong>Propiedad:</strong> ${escape(prop)}</p>${a.notes?`<p>${escape(a.notes)}</p>`:''}${canEdit?`<label>Actualizar estado <select data-agenda-id="${escape(a.id)}">${['Programada','Pendiente','Realizada','Reprogramada','Cancelada','No contestó'].map(s=>`<option ${s===a.result?'selected':''}>${s}</option>`).join('')}</select></label>`:''}</div>`
 }).join('')||'<p class="muted">No hay actividades para estos filtros.</p>';
 $('agendaRows').querySelectorAll('[data-agenda-id]').forEach(el=>el.onchange=async()=>{
  const id=el.dataset.agendaId,a=agendaActivities.find(x=>x.id===id);if(!a||a.ownerUid!==current.uid)return;
  try{await updateDoc(doc(db,'activities',id),{result:el.value,updatedAt:serverTimestamp()});msg('Estado actualizado.');await loadAgenda()}catch(err){msg('No se pudo actualizar: '+err.message);renderAgenda()}
 });
}
for(const id of ['agendaFilter','agendaSearch','agendaMonth'])$(id).addEventListener('input',renderAgenda);


// v1.6 Dashboard comercial: solo lectura; respetar consultas autorizadas por rol.
let dashboardProspects=[],dashboardActivities=[],dashboardUsers=[];
const dashPending=a=>['Pendiente','Programada','Reprogramada'].includes(a.result);
const dashLocalDate=v=>v?.toDate?.() ? new Date(v.toDate().getTime()-v.toDate().getTimezoneOffset()*60000).toISOString().slice(0,16) : typeof v==='string' ? v : '';
function dashSince(period){const d=new Date();if(period==='all')return '';if(period==='month')return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
 if(period==='year')return `${d.getFullYear()}-01-01`;d.setDate(d.getDate()-(period==='last90'?90:30));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
async function loadDashboard(){
 if(!current||profile?.status!=='active')return;
 $('dashboardStatus').textContent='Consultando indicadores...';
 const admin=profile.role==='admin';
 try{
  const pQuery=admin?collection(db,'prospects'):query(collection(db,'prospects'),where('ownerUid','==',current.uid));
  const aQuery=admin?collection(db,'activities'):query(collection(db,'activities'),where('ownerUid','==',current.uid));
  const [ps,as]=await Promise.all([getDocs(pQuery),getDocs(aQuery)]);
  dashboardProspects=ps.docs.map(d=>({id:d.id,...d.data()})).filter(p=>admin||p.ownerUid===current.uid);
  dashboardActivities=as.docs.map(d=>({id:d.id,...d.data()})).filter(a=>admin||a.ownerUid===current.uid);
  dashboardUsers=[];
  if(admin){try{const us=await getDocs(collection(db,'users'));dashboardUsers=us.docs.map(d=>({uid:d.id,...d.data()}));}
   catch(e){$('dashboardStatus').textContent='No fue posible consultar el directorio de asesores: '+e.message;}}
  const select=$('dashboardAdvisor'),prior=select.value;
  select.innerHTML=admin?'<option value="all">Todo el equipo</option>':'<option value="mine">Mis resultados</option>';
  if(admin){const owners=new Set([...dashboardProspects,...dashboardActivities].map(x=>x.ownerUid).filter(Boolean));
   for(const u of dashboardUsers)if(u.status==='active')owners.add(u.uid);
   [...owners].sort((a,b)=>String(dashboardUsers.find(u=>u.uid===a)?.email||a).localeCompare(String(dashboardUsers.find(u=>u.uid===b)?.email||b))).forEach(uid=>{
    const opt=document.createElement('option');opt.value=uid;opt.textContent=dashboardUsers.find(u=>u.uid===uid)?.email||(uid===current.uid?current.email:'Asesor '+uid.slice(0,8));select.appendChild(opt);
   });
  }
  select.value=[...select.options].some(o=>o.value===prior)?prior:admin?'all':'mine';
  show('dashboardTeamSection',admin);renderDashboard();
 }catch(e){$('dashboardStatus').textContent='No se pudieron cargar los indicadores: '+e.message;msg('Error del dashboard: '+e.message);}
}
function renderDashboard(){
 if(!current||profile?.status!=='active')return;
 const admin=profile.role==='admin',owner=admin?$('dashboardAdvisor').value:current.uid,since=dashSince($('dashboardPeriod').value);
 const mine=x=>!admin||owner==='all'||x.ownerUid===owner;
 const inPeriod=v=>!since||(v&&v.slice(0,10)>=since);
 const ps=dashboardProspects.filter(p=>mine(p)&&inPeriod(dashLocalDate(p.createdAt)));
 const acts=dashboardActivities.filter(a=>mine(a)&&inPeriod(a.occurredAt||dashLocalDate(a.createdAt)));
 const active=properties.filter(p=>!p.archived);
 const set=(id,n)=>$(id).textContent=n;
 // El inventario es global y representa el estado actual, sin atribución de ventas por asesor.
 set('dashProperties',active.length);set('dashAvailable',active.filter(p=>p.status==='Disponible').length);set('dashSold',active.filter(p=>p.status==='Vendida').length);
 const closed=ps.filter(p=>p.stage==='Cerrado').length;
 set('dashProspects',ps.length);set('dashFollowing',ps.filter(p=>['Contactado','Visita programada','Negociación'].includes(p.stage)).length);
 set('dashClosed',closed);set('dashDiscarded',ps.filter(p=>p.stage==='Descartado').length);
 set('dashConversion',ps.length?`${(100*closed/ps.length).toFixed(1)}%`:'0%');
 set('dashVisitsPending',acts.filter(a=>a.type==='Visita'&&dashPending(a)).length);
 set('dashVisitsDone',acts.filter(a=>a.type==='Visita'&&a.result==='Realizada').length);
 set('dashVisitsCanceled',acts.filter(a=>a.type==='Visita'&&a.result==='Cancelada').length);
 const now=localNow(),endDate=new Date();endDate.setDate(endDate.getDate()+7);
 const end=new Date(endDate.getTime()-endDate.getTimezoneOffset()*60000).toISOString().slice(0,16);
 const pending=acts.filter(dashPending),target=a=>a.nextAt||a.occurredAt;
 set('dashPending',pending.length);set('dashOverdue',pending.filter(a=>target(a)&&target(a)<now).length);
 set('dashWeek',pending.filter(a=>target(a)&&target(a)>=now&&target(a)<=end).length);
 const stages=['Nuevo','Contactado','Visita programada','Negociación','Cerrado','Descartado'];
 $('dashboardStages').innerHTML=stages.map(s=>{const n=ps.filter(p=>p.stage===s).length,pct=ps.length?100*n/ps.length:0;
  return `<div class="dashboard-bar-line"><span>${escape(s)}</span><div class="dashboard-bar-track"><div class="dashboard-bar-fill" style="width:${pct.toFixed(1)}%"></div></div><strong>${n}</strong></div>`;}).join('');
 if(admin){const ids=[...new Set([...dashboardProspects,...dashboardActivities].map(x=>x.ownerUid).filter(Boolean))].filter(uid=>owner==='all'||uid===owner);
  $('dashboardTeamRows').innerHTML=ids.map(uid=>{const ownP=ps.filter(p=>p.ownerUid===uid),ownA=acts.filter(a=>a.ownerUid===uid);
   const name=dashboardUsers.find(u=>u.uid===uid)?.email||(uid===current.uid?current.email:'Asesor '+uid.slice(0,8));
   return `<tr><td>${escape(name)}</td><td>${ownP.length}</td><td>${ownP.filter(p=>p.stage==='Cerrado').length}</td><td>${ownA.length}</td><td>${ownA.filter(a=>a.type==='Visita').length}</td><td>${ownA.filter(dashPending).length}</td></tr>`;}).join('')||'<tr><td colspan="6">Sin registros para el periodo.</td></tr>';
 }
 $('dashboardStatus').textContent=`Actualizado: ${new Date().toLocaleString('es-MX')}. Datos de ${admin?'equipo autorizado':'cartera propia'}; el inventario es compartido.`;
}
for(const id of ['dashboardAdvisor','dashboardPeriod'])$(id).addEventListener('change',renderDashboard);
$('dashboardRefresh').onclick=loadDashboard;


// v1.8.1: centro de alertas derivado de Firestore; no almacena notificaciones ni datos personales adicionales.
let alertItems=[];
const alertDay=s=>String(s||'').slice(0,10);
function alertDayOffset(days){const d=new Date();d.setDate(d.getDate()+days);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function alertCategory(a){
 const target=a.nextAt||a.occurredAt,day=alertDay(target),today=alertDayOffset(0);
 if(!target)return null;
 if(target<localNow())return 'overdue';
 if(day===today)return 'today';
 if(day===alertDayOffset(1))return 'tomorrow';
 if(day>today&&day<=alertDayOffset(7))return 'later';
 return null;
}
async function loadAlerts(){
 if(!current||profile?.status!=='active')return;
 $('alertsStatus').textContent='Consultando seguimientos...';
 try{
  const admin=profile.role==='admin';
  const aq=admin?collection(db,'activities'):query(collection(db,'activities'),where('ownerUid','==',current.uid));
  const pq=admin?collection(db,'prospects'):query(collection(db,'prospects'),where('ownerUid','==',current.uid));
  const [acts,ps]=await Promise.all([getDocs(aq),getDocs(pq)]);
  const names=new Map(ps.docs.map(d=>[d.id,d.data().name||'Prospecto']));
  alertItems=acts.docs.map(d=>({id:d.id,...d.data()}))
   .filter(a=>(admin||a.ownerUid===current.uid)&&['Pendiente','Programada','Reprogramada'].includes(a.result))
   .map(a=>({...a,alertType:alertCategory(a),prospectName:names.get(a.prospectId)||'Prospecto privado'}))
   .filter(a=>a.alertType);
  renderAlerts();
  $('alertsStatus').textContent='Actualizado: '+new Date().toLocaleString('es-MX')+'. Las alertas se actualizan al abrir este módulo o al pulsar Actualizar.';
 }catch(e){$('alertsStatus').textContent='No se pudieron cargar las alertas: '+e.message;msg('Error al consultar alertas: '+e.message)}
}
function renderAlerts(){
 const groups=[['overdue','alertsOverdueRows','alertsOverdue'],['today','alertsTodayRows','alertsToday'],['tomorrow','alertsTomorrowRows','alertsTomorrow'],['later','alertsLaterRows',null]];
 for(const [kind,container,count] of groups){
  const items=alertItems.filter(a=>a.alertType===kind).sort((a,b)=>(a.nextAt||a.occurredAt).localeCompare(b.nextAt||b.occurredAt));
  if(count)$(count).textContent=items.length;
  $(container).innerHTML=items.map(a=>{
   const target=(a.nextAt||a.occurredAt).replace('T',' ');
   const prop=properties.find(p=>p.id===a.propertyId)?.title||'Sin propiedad';
   const own=a.ownerUid===current.uid;
   return `<div class="card"><strong>${escape(a.type)} · ${escape(a.result)}</strong><p><strong>Fecha de seguimiento:</strong> ${escape(target)}</p><p><strong>Prospecto:</strong> ${escape(a.prospectName)} · <strong>Propiedad:</strong> ${escape(prop)}</p>${a.notes?`<p>${escape(a.notes)}</p>`:''}<button type="button" class="secondary" data-alert-agenda="${escape(a.id)}">Ver en agenda</button>${own?`<button type="button" data-alert-prospect="${escape(a.prospectId)}">Abrir seguimiento</button>`:''}</div>`;
  }).join('')||'<p class="muted">Sin alertas en este periodo.</p>';
 }
 $('alertsBadge').textContent=alertItems.filter(a=>['overdue','today'].includes(a.alertType)).length||'';
 document.querySelectorAll('[data-alert-agenda]').forEach(b=>b.onclick=async()=>{navigate('agenda');$('agendaFilter').value='all';$('agendaMonth').value='';$('agendaSearch').value='';await loadAgenda();const item=agendaActivities.find(a=>a.id===b.dataset.alertAgenda);if(item){$('agendaSearch').value=item.notes||item.type;renderAgenda()}});
 document.querySelectorAll('[data-alert-prospect]').forEach(b=>b.onclick=async()=>{navigate('prospects');await loadMyProspects();await openFollowup(b.dataset.alertProspect)});
}
$('alertsRefresh').onclick=loadAlerts;
$('alertsOpenAgenda').onclick=async()=>{navigate('agenda');await loadAgenda()};

// v1.9: oportunidades vinculadas a prospectos privados y propiedades compartidas.
let opportunityItems=[],opportunityProspects=[];
const opportunityStages=['Identificada','Contactado','Visita programada','Negociación','Ganada','Perdida'];
const opportunityMoney=n=>Number(n||0).toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0});
async function loadOpportunities(){
 if(!current||profile?.status!=='active')return;
 $('oppStatus').textContent='Cargando oportunidades...';
 try{
  const admin=profile.role==='admin';
  const [os,ps]=await Promise.all([
   getDocs(admin?collection(db,'opportunities'):query(collection(db,'opportunities'),where('ownerUid','==',current.uid))),
   getDocs(admin?collection(db,'prospects'):query(collection(db,'prospects'),where('ownerUid','==',current.uid)))
  ]);
  opportunityItems=os.docs.map(d=>({id:d.id,...d.data()})).filter(o=>admin||o.ownerUid===current.uid);
  opportunityProspects=ps.docs.map(d=>({id:d.id,...d.data()}));
  const own=opportunityProspects.filter(p=>p.ownerUid===current.uid);
  $('oppProspect').innerHTML='<option value="">Seleccionar prospecto</option>'+own.map(p=>`<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('');
  $('oppProperty').innerHTML='<option value="">Seleccionar propiedad</option>'+properties.filter(p=>!p.archived&&p.status==='Disponible').map(p=>`<option value="${escape(p.id)}">${escape(p.title)} · ${opportunityMoney(p.price)}</option>`).join('');
  renderOpportunities();$('oppStatus').textContent='Datos actualizados. Las oportunidades se guardan en Firestore.';
 }catch(e){$('oppStatus').textContent='No se pudieron cargar las oportunidades: '+e.message;msg('Error de oportunidades: '+e.message)}
}
function renderOpportunities(){
 const f=$('oppFilter').value,rows=opportunityItems.filter(o=>!f||o.stage===f);
 $('oppTotal').textContent=opportunityItems.length;
 $('oppNegotiating').textContent=opportunityItems.filter(o=>o.stage==='Negociación').length;
 $('oppWon').textContent=opportunityItems.filter(o=>o.stage==='Ganada').length;
 $('oppRows').innerHTML=rows.map(o=>{
  const p=opportunityProspects.find(p=>p.id===o.prospectId),property=properties.find(p=>p.id===o.propertyId),own=o.ownerUid===current.uid;
  return `<div class="card"><strong>${escape(p?.name||'Prospecto no disponible')} · ${escape(property?.title||'Propiedad no disponible')}</strong><p>Valor estimado: ${opportunityMoney(o.expectedValue)} · Responsable: ${escape(o.ownerUid===current.uid?current.email:o.ownerUid.slice(0,8))}</p>${o.notes?`<p>${escape(o.notes)}</p>`:''}${own?`<label>Etapa<select data-opp-stage="${escape(o.id)}">${opportunityStages.map(s=>`<option ${o.stage===s?'selected':''}>${s}</option>`).join('')}</select></label><label>Notas<textarea data-opp-notes="${escape(o.id)}" maxlength="1000" rows="2">${escape(o.notes||'')}</textarea></label><button type="button" data-opp-save="${escape(o.id)}">Guardar cambios</button>`:`<p>Etapa: ${escape(o.stage)}</p>`}</div>`;
 }).join('')||'<p class="muted">No hay oportunidades en esta vista.</p>';
 $('oppRows').querySelectorAll('[data-opp-save]').forEach(b=>b.onclick=async()=>{
  const o=opportunityItems.find(x=>x.id===b.dataset.oppSave&&x.ownerUid===current.uid);if(!o)return;
  const card=b.closest('.card'),stage=card.querySelector('[data-opp-stage]').value,notes=card.querySelector('[data-opp-notes]').value.trim();
  if(!opportunityStages.includes(stage))return;
  b.disabled=true;try{await updateDoc(doc(db,'opportunities',o.id),{stage,notes,updatedAt:serverTimestamp()});msg('Oportunidad actualizada.');await loadOpportunities()}catch(e){msg('No se pudo actualizar: '+e.message);b.disabled=false}
 });
}
$('oppFilter').onchange=renderOpportunities;
$('oppForm').onsubmit=async e=>{
 e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));
 const prospect=opportunityProspects.find(p=>p.id===d.prospectId&&p.ownerUid===current.uid),property=properties.find(p=>p.id===d.propertyId&&!p.archived&&p.status==='Disponible');
 if(!prospect||!property||!opportunityStages.includes(d.stage))return msg('Selecciona un prospecto propio y una propiedad disponible.');
 const value=Number(d.expectedValue);if(!Number.isFinite(value)||value<0)return msg('Valor estimado inválido.');
 if(opportunityItems.some(o=>o.prospectId===d.prospectId&&o.propertyId===d.propertyId&&o.stage!=='Perdida'))return msg('Ya existe una oportunidad activa para este prospecto y propiedad.');
 const button=f.querySelector('[type=submit]');button.disabled=true;
 try{await addDoc(collection(db,'opportunities'),{ownerUid:current.uid,prospectId:d.prospectId,propertyId:d.propertyId,stage:d.stage,expectedValue:value,notes:(d.notes||'').trim(),createdAt:serverTimestamp()});f.reset();msg('Oportunidad creada.');await loadOpportunities()}
 catch(err){msg('No se pudo crear la oportunidad: '+err.message)}finally{button.disabled=false}
};


/* HABITA NL v2.0 - Indicadores del embudo comercial */
const funnelActiveStages = [
  'Identificada',
  'Contactado',
  'Visita programada',
  'Negociación'
];

function calculateFunnel(items) {
  const rows = Array.isArray(items) ? items : [];

  const active = rows.filter(o =>
    funnelActiveStages.includes(o.stage)
  );

  const won = rows.filter(o => o.stage === 'Ganada');
  const lost = rows.filter(o => o.stage === 'Perdida');

  const amount = list => list.reduce((total, o) => {
    const value = Number(o.expectedValue);
    return total + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);

  const resolved = won.length + lost.length;

  return {
    total: rows.length,
    active: active.length,
    pipeline: amount(active),
    won: won.length,
    lost: lost.length,
    wonValue: amount(won),
    conversion: resolved > 0
      ? (won.length / resolved) * 100
      : 0,
    stages: opportunityStages.map(stage => ({
      stage,
      count: rows.filter(o => o.stage === stage).length,
      value: amount(rows.filter(o => o.stage === stage))
    }))
  };
}
 
/* HABITA NL v2.0 - Reporte del embudo comercial */

function funnelSetText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function funnelAdvisorName(uid, users) {
  const user = users.find(u => u.id === uid);
  return user?.displayName || user?.name ||
    user?.email || uid?.slice(0, 8) || 'Sin asignar';
}

async function loadFunnel() {
  if (!current || profile?.status !== 'active') return;

  funnelSetText('funnelStatus', 'Actualizando reporte...');

  try {
    const admin = profile.role === 'admin';

    const opportunitiesSnapshot = await getDocs(
      admin
        ? collection(db, 'opportunities')
        : query(
            collection(db, 'opportunities'),
            where('ownerUid', '==', current.uid)
          )
    );

    const opportunities = opportunitiesSnapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    let users = [];

    if (admin) {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      users = usersSnapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
    } else {
      users = [{
        id: current.uid,
        displayName: profile.displayName || current.displayName,
        email: current.email
      }];
    }

    const advisorSelect = $('funnelAdvisor');
    const previousSelection = advisorSelect.value;

    const advisorIds = [
      ...new Set(opportunities.map(o => o.ownerUid).filter(Boolean))
    ];

    advisorSelect.innerHTML =
      `<option value="all">${profile.role === 'admin' ? 'Todo el equipo' : 'Mis oportunidades'}</option>` +
      advisorIds.map(uid =>
        `<option value="${escape(uid)}">${
          escape(funnelAdvisorName(uid, users))
        }</option>`
      ).join('');

    advisorSelect.value =
      advisorIds.includes(previousSelection)
        ? previousSelection
        : 'all';

    const render = () => {
      const selected = advisorSelect.value;
      const filtered = selected === 'all'
        ? opportunities
        : opportunities.filter(o => o.ownerUid === selected);

      const metrics = calculateFunnel(filtered);

      funnelSetText('funnelTotal', metrics.total);
      funnelSetText('funnelPipeline', opportunityMoney(metrics.pipeline));
      funnelSetText('funnelWonValue', opportunityMoney(metrics.wonValue));
       funnelSetText('funnelWon', metrics.won);
      funnelSetText('funnelLost', metrics.lost);
      funnelSetText('funnelConversion',
        metrics.conversion.toFixed(1) + '%');

      const maxCount = Math.max(
        1,
        ...metrics.stages.map(s => s.count)
      );

      $('funnelStages').innerHTML = metrics.stages.map(s => `
        <div class="dashboard-bar-line">
          <span>${escape(s.stage)}</span>
          <div class="dashboard-bar-track">
            <div class="dashboard-bar-fill"
                 style="width:${(s.count / maxCount) * 100}%">
            </div>
          </div>
          <strong>${s.count}</strong>
        </div>
      `).join('');

      const groups = new Map();

      for (const opportunity of opportunities) {
        const uid = opportunity.ownerUid || 'sin-asignar';

        if (!groups.has(uid)) groups.set(uid, []);
        groups.get(uid).push(opportunity);
      }

      $('funnelTeamRows').innerHTML = [...groups.entries()]
        .filter(([uid]) => selected === 'all' || uid === selected)
        .map(([uid, items]) => {
          const m = calculateFunnel(items);

          return `<tr>
            <td>${escape(funnelAdvisorName(uid, users))}</td>
            <td>${m.total}</td>
            <td>${m.active}</td>
            <td>${m.won}</td>
            <td>${m.lost}</td>
            <td>${opportunityMoney(m.pipeline)}</td>
            <td>${m.conversion.toFixed(1)}%</td>
          </tr>`;
        }).join('') ||
        '<tr><td colspan="7">Sin oportunidades registradas.</td></tr>';
    };

    advisorSelect.onchange = render;
    render();

    funnelSetText('funnelStatus', 'Reporte actualizado.');

  } catch (error) {
    funnelSetText(
      'funnelStatus',
      'No se pudo actualizar el reporte: ' + error.message
    );
  }
}

$('funnelRefresh').onclick = loadFunnel;


// v2.1: Fichas descargables e historial de publicaciones.
function fillFacebookPublicationProperties(){
 const sel=$('facebookPublicationProperty');if(!sel)return;
 const old=sel.value;sel.replaceChildren(new Option('Selecciona una propiedad',''));
 for(const p of properties.filter(x=>!x.archived&&String(x.status||'').trim().toLowerCase()==='disponible'))sel.add(new Option(`${p.title||'Sin título'} - ${p.municipality||''}`,p.id));
 if([...sel.options].some(o=>o.value===old))sel.value=old;
}
function fillFacebookPublicationGroups(groups){
 const sel=$('facebookPublicationGroup');if(!sel)return;
 const old=sel.value;sel.replaceChildren(new Option('Selecciona un grupo',''));
 for(const g of groups.filter(x=>x.status==='Activo'))sel.add(new Option(g.name||'Grupo',g.id));
 if([...sel.options].some(o=>o.value===old))sel.value=old;
}
function facebookDateLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
$('facebookPublicationDate').value=facebookDateLocal();
$('facebookPublicationForm').onsubmit=async e=>{
 e.preventDefault();const status=$('facebookPublicationStatus');
 if(!current||profile?.status!=='active')return;
 const propertyId=$('facebookPublicationProperty').value,groupId=$('facebookPublicationGroup').value;
 const p=properties.find(x=>x.id===propertyId&&!x.archived&&String(x.status||'').toLowerCase()==='disponible');
 const g=$('facebookPublicationGroup').selectedOptions[0];
 const date=$('facebookPublicationDate').value,url=$('facebookPublicationUrl').value.trim(),notes=$('facebookPublicationNotes').value.trim();
 if(!p||!groupId||!g||!/^\d{4}-\d{2}-\d{2}$/.test(date))return status.textContent='Selecciona propiedad, grupo y fecha válidos.';
 if(date>facebookDateLocal())return status.textContent='La fecha no puede ser futura.';
 if(url){try{const u=new URL(url);if(u.protocol!=='https:'||!['facebook.com','www.facebook.com','m.facebook.com','web.facebook.com'].includes(u.hostname))throw Error();}catch{return status.textContent='Ingresa un enlace HTTPS válido de Facebook.';}}
 const button=e.target.querySelector('button[type=submit]');button.disabled=true;
 try{await addDoc(collection(db,'facebook_publications'),{propertyId,propertyTitle:p.title||'',groupId,groupName:g.textContent,ownerUid:current.uid,ownerEmail:current.email||'',publishedOn:date,postUrl:url,notes,createdAt:serverTimestamp()});e.target.reset();$('facebookPublicationDate').value=facebookDateLocal();status.textContent='Publicación registrada.';await loadFacebookPublications();}
 catch(err){status.textContent='No se pudo registrar: '+err.message;}
 finally{button.disabled=false;}
};
async function loadFacebookPublications(){
 const rows=$('facebookPublicationRows'),summary=$('facebookPublicationSummary');if(!rows)return;
 rows.replaceChildren();summary.textContent='Cargando historial...';
 try{
  const snap=await getDocs(profile?.role==='admin'?collection(db,'facebook_publications'):query(collection(db,'facebook_publications'),where('ownerUid','==',current.uid)));
  const records=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(b.publishedOn||'').localeCompare(String(a.publishedOn||'')));
  summary.textContent=`${records.length} publicación(es) · ${new Set(records.map(x=>x.propertyId)).size} propiedad(es) · ${new Set(records.map(x=>x.groupId)).size} grupo(s) · ${new Set(records.map(x=>x.ownerUid)).size} asesor(es)`;
  if(!records.length){const tr=rows.insertRow();const td=tr.insertCell();td.colSpan=5;td.textContent='Aún no hay publicaciones registradas.';return;}
  for(const r of records){const tr=rows.insertRow();for(const v of [r.publishedOn||'',r.propertyTitle||'',r.groupName||'',r.ownerEmail||''])tr.insertCell().textContent=v;
   const cell=tr.insertCell();if(r.postUrl){const a=document.createElement('a');a.textContent='Ver publicación';a.href=r.postUrl;a.target='_blank';a.rel='noopener noreferrer';cell.append(a)}else cell.textContent='Sin enlace';}
 }catch(err){summary.textContent='No se pudo cargar el historial: '+err.message;}
}
function wrapCanvasText(ctx,text,maxWidth){const words=String(text).split(/\s+/),lines=[];let line='';for(const word of words){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width>maxWidth&&line){lines.push(line);line=word}else line=candidate;}if(line)lines.push(line);return lines;}

async function downloadFacebookCard(p, descripcion, compartir = false) {
  const btn = $('facebookDownloadCard');
  btn.disabled = true;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;

    const ctx = canvas.getContext('2d');
    const navy = '#112f51';
    const orange = '#e87523';
    const white = '#ffffff';

    // Fondo general
    ctx.fillStyle = white;
    ctx.fillRect(0, 0, 1080, 1350);

    // Encabezado corporativo
    ctx.fillStyle = navy;
    ctx.fillRect(0, 0, 1080, 190);

    // Logotipo oficial
    try {
      const logo = new Image();
      logo.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        logo.onload = resolve;
        logo.onerror = reject;
        logo.src = './HABITA_NL_logo_transparente.png';
      });

      const scale = Math.min(245 / logo.width, 145 / logo.height);
      const logoWidth = logo.width * scale;
      const logoHeight = logo.height * scale;

      ctx.fillStyle = white;
      ctx.fillRect(40, 22, 265, 148);
      ctx.drawImage(
        logo,
        40 + (265 - logoWidth) / 2,
        22 + (148 - logoHeight) / 2,
        logoWidth,
        logoHeight
      );
    } catch (error) {
      ctx.fillStyle = white;
      ctx.font = 'bold 43px Arial';
      ctx.fillText('HABITA NL', 50, 105);
    }

    ctx.fillStyle = white;
    ctx.font = 'bold 46px Arial';
    ctx.fillText('PROPIEDAD', 345, 91);
    ctx.fillText('EN VENTA', 345, 145);

    ctx.fillStyle = orange;
    ctx.fillRect(0, 190, 1080, 12);

    // Fotografía principal del inventario
    const photo = Array.isArray(p.photos)
      ? p.photos[0]?.url
      : null;

    let hasPhoto = false;

    if (photo) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = photo;
        });

        const boxX = 35;
        const boxY = 225;
        const boxW = 1010;
        const boxH = 550;

        const scale = Math.max(
          boxW / img.width,
          boxH / img.height
        );

        const w = img.width * scale;
        const h = img.height * scale;

        ctx.save();
        ctx.beginPath();
        ctx.rect(boxX, boxY, boxW, boxH);
        ctx.clip();

        ctx.drawImage(
          img,
          boxX + (boxW - w) / 2,
          boxY + (boxH - h) / 2,
          w,
          h
        );

        ctx.restore();
        hasPhoto = true;
      } catch (error) {
        console.warn('No se pudo cargar la fotografía', error);
      }
    }

    if (!hasPhoto) {
      ctx.fillStyle = '#e9eef5';
      ctx.fillRect(35, 225, 1010, 610);
      ctx.fillStyle = navy;
      ctx.font = '32px Arial';
      ctx.fillText('Fotografía no disponible', 340, 530);
    }

    // Información del inmueble
    ctx.fillStyle = navy;
    ctx.font = 'bold 45px Arial';

    let y = 900;

    for (const line of wrapCanvasText(
      ctx,
      p.title || 'Propiedad',
      950
    ).slice(0, 2)) {
      ctx.fillText(line, 55, y);
      y += 52;
    }

    ctx.font = '28px Arial';

    const location = [
      p.colony,
      p.municipality
    ].filter(Boolean).join(', ');

    for (const line of wrapCanvasText(
      ctx,
      location,
      950
    ).slice(0, 2)) {
      ctx.fillText(line, 55, y + 5);
      y += 35;
    }

    // Precio actualizado desde Firestore
    const price = Number(p.price);

    ctx.fillStyle = orange;
    ctx.font = 'bold 68px Arial';

    const priceText = Number.isFinite(price) && price > 0
      ? price.toLocaleString('es-MX', {
          style: 'currency',
          currency: 'MXN',
          maximumFractionDigits: 0
        })
      : 'Precio a consultar';

    ctx.fillText(priceText, 55, 1020);

    
    // Características de la propiedad
    ctx.fillStyle = navy;
    ctx.font = '29px Arial';

    // Posiciones fijas de las características

const habitacionesY = 1080;
const tipoY = 1110;
const pagosY = 1140;

    ctx.fillText(
      `${p.beds ?? 'N/D'} habitaciones  ·  ${p.baths ?? 'N/D'} baños`,
      55,
      habitacionesY
    );

    ctx.font = '25px Arial';

    if (p.propertyType) {
      ctx.fillText(
        `Tipo: ${p.propertyType}`,
        55,
        tipoY
      );
    }

    if (Array.isArray(p.payments) && p.payments.length) {
      const textoPagos = `Formas de pago: ${p.payments.join(', ')}`;
      ctx.fillText(
        textoPagos,
        55,
        pagosY,
        970
      );
    }

    // Pie corporativo
    ctx.fillStyle = navy;
    ctx.fillRect(0, 1190, 1080, 160);

    ctx.fillStyle = white;
    ctx.font = 'bold 35px Arial';
    ctx.fillText('WhatsApp 8110798053', 55, 1255);

    ctx.font = '25px Arial';
    ctx.fillText('Grupo Inmobiliario HABITA NL', 55, 1302);

    ctx.fillStyle = orange;
    ctx.fillRect(0, 1180, 1080, 10);

    
    // Preparar archivo PNG
    const filename = String(p.title || 'propiedad')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/gi, '_');

    const nombreArchivo = `HABITA_NL_${filename}.png`;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        archivo => archivo
          ? resolve(archivo)
          : reject(new Error('No se pudo generar el PNG')),
        'image/png'
      );
    });

    if (compartir) {
      const archivo = new File([blob], nombreArchivo, {
        type: 'image/png'
      });

      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [archivo] })
      ) {
        await navigator.share({
          files: [archivo],
          title: p.title || 'Propiedad en venta',
          text: descripcion
        });

        msg('Ficha enviada al menú de compartir.');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nombreArchivo;
        link.click();

        setTimeout(() => URL.revokeObjectURL(url), 60000);

        msg('Tu navegador no permite compartir archivos directamente. Se descargó la ficha para adjuntarla manualmente en WhatsApp.');
      }
    } else {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nombreArchivo;
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 60000);

      msg('Ficha HABITA NL descargada correctamente.');
    }

  
  
    return true;

  } catch (err) {
    if (compartir && err.name === 'AbortError') {
      msg('Se canceló la acción de compartir.');
    } else {
      msg('No se pudo generar o compartir la ficha: ' + err.message);
    }

    return false;

  } finally {
    btn.disabled = false;
  }
}


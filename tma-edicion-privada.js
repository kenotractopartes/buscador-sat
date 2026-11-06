/* TMA: consultation remains available; server Rules decide who may write. */
'use strict';
window.TMAEditor=(function(){
  const OWNER='kenotractopartes@gmail.com';
  let auth=null,autorizado=false,leido=false,pendientes=0,version=0,iniciando=false;
  let aviso=null,entrar=null,salir=null,observador=null,detalle=null;
  const bloqueados=new Map();
  function puedeEditar(){return autorizado&&leido;}
  function pintar(){
    const texto=detalle||(autorizado?(leido?'🔓 Edición habilitada para Eugenio':'⏳ Esperando los datos de la nube antes de editar'):'🔒 Consulta · sólo Eugenio puede editar');
    if(aviso&&aviso.textContent!==texto)aviso.textContent=texto;
    if(entrar){entrar.hidden=autorizado;entrar.disabled=iniciando||!auth;}
    if(salir){salir.hidden=!autorizado;salir.disabled=iniciando;}
    document.querySelectorAll('[data-tma-editar]').forEach(el=>{
      if(!puedeEditar()){
        if(!bloqueados.has(el))bloqueados.set(el,el.disabled);
        el.disabled=true;el.setAttribute('aria-disabled','true');
      }else if(bloqueados.has(el)){
        el.disabled=bloqueados.get(el);el.removeAttribute('aria-disabled');bloqueados.delete(el);
      }
    });
    // Detached rows must not be retained while filtering large catalogs.
    for(const el of bloqueados.keys())if(!el.isConnected)bloqueados.delete(el);
  }
  function mensaje(texto){detalle=texto;pintar();}
  function permitir(){
    if(puedeEditar())return true;
    mensaje(autorizado?'⏳ Espera a que carguen los datos antes de editar.':'🔒 Para editar, entra con la cuenta de Google de Eugenio.');
    return false;
  }
  async function observarUsuario(user){
    const turno=++version;autorizado=false;detalle=null;pintar();
    if(!user)return;
    try{
      const result=await user.getIdTokenResult();
      if(turno!==version)return;
      autorizado=user.email?.toLowerCase()===OWNER&&user.emailVerified===true&&result.claims?.firebase?.sign_in_provider==='google.com';
      pintar();
      if(!autorizado)mensaje('🔒 Esta cuenta puede consultar. Sólo Eugenio puede editar; elige su cuenta de Google.');
    }catch(e){if(turno===version){autorizado=false;pintar();mensaje('No se pudo comprobar la sesión. La consulta sigue disponible.');}}
  }
  async function iniciarSesion(){
    if(!auth||iniciando)return;
    iniciando=true;detalle=null;pintar();
    try{
      const provider=new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({prompt:'select_account',login_hint:OWNER});
      await auth.signInWithPopup(provider);
    }catch(e){
      const mensajes={'auth/operation-not-allowed':'Google todavía no está activado para editar este sistema.','auth/unauthorized-domain':'Falta autorizar esta dirección en Firebase para el acceso de edición.','auth/popup-blocked':'Permite la ventana de Google y vuelve a pulsar Entrar para editar.','auth/popup-closed-by-user':'Se cerró el acceso de Google. Puedes seguir consultando.','auth/network-request-failed':'No hay conexión para iniciar sesión. Puedes seguir consultando.'};
      mensaje(mensajes[e.code]||'No se pudo iniciar sesión. Puedes seguir consultando y volver a intentar.');
    }finally{iniciando=false;if(entrar)entrar.disabled=false;}
  }
  async function cerrarSesion(){
    if(pendientes){mensaje('⏳ Hay cambios pendientes de sincronizar. Espera o conserva un respaldo antes de cerrar sesión.');return;}
    if(auth)await auth.signOut();
  }
  function guardar(operacion){
    if(!permitir())return Promise.reject(new Error('Edición no autorizada.'));
    pendientes++;
    return Promise.resolve().then(()=>{
      if(!puedeEditar())throw new Error('La sesión de edición cambió antes de guardar.');
      return operacion();
    }).finally(()=>{pendientes=Math.max(0,pendientes-1);});
  }
  function confirmarLectura(){leido=true;pintar();}
  function iniciar(app){
    const box=document.createElement('section');box.id='tma-edicion';box.setAttribute('aria-label','Acceso de edición');
    box.style.cssText='display:flex;gap:12px;align-items:center;flex-wrap:wrap;background:#edf4fb;border:1px solid #c3d7eb;border-radius:12px;padding:12px 18px;margin:12px auto;max-width:1400px;color:#18334e;font:14px/1.5 system-ui';
    aviso=document.createElement('span');aviso.setAttribute('role','status');aviso.setAttribute('aria-live','polite');aviso.style.flex='1';
    entrar=document.createElement('button');entrar.type='button';entrar.textContent='🔐 Entrar para editar';entrar.onclick=iniciarSesion;
    salir=document.createElement('button');salir.type='button';salir.textContent='Cerrar edición';salir.onclick=()=>cerrarSesion().catch(()=>mensaje('No se pudo cerrar la sesión. Vuelve a intentar.'));
    for(const btn of [entrar,salir])btn.style.cssText='border:0;border-radius:9px;background:#0b4f8a;color:white;padding:10px 15px;font:600 14px system-ui;cursor:pointer';
    box.append(aviso,entrar,salir);
    const cabecera=document.querySelector('header')||document.querySelector('.header');
    if(cabecera)cabecera.insertAdjacentElement('afterend',box);else document.body.prepend(box);
    pintar();
    observador=new MutationObserver(()=>pintar());observador.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('beforeunload',event=>{if(pendientes){event.preventDefault();event.returnValue='';}});
    try{
      auth=app.auth();
      auth.onIdTokenChanged(observarUsuario,()=>{autorizado=false;pintar();});
      pintar();
    }catch(e){mensaje('No se pudo abrir el acceso de edición. La consulta sigue disponible.');entrar.disabled=true;}
  }
  return {iniciar,puedeEditar,permitir,guardar,confirmarLectura};
})();

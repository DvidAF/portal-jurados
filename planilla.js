'use strict';
(() => {
const KEY = 'jurados-evaluacion-v2';
const config = window.PLANILLA_CONFIG || {};
const projects = [...window.GRUPOS_PLANILLA].sort((a,b) => a.orden-b.orden);
const criteria = [
 ['exposicion','Exposición','Claridad y organización de la presentación.'],
 ['demostracion','Demostración','Cómo se muestra la solución y su utilidad.'],
 ['respuestas','Respuestas','Claridad al responder las preguntas del jurado.']
];
const $ = id => document.getElementById(id);
let session = null, busy = false;
const cards = new Map();
try { const value = JSON.parse(localStorage.getItem(KEY)); if(value && typeof value.nombre === 'string' && /^[0-9a-f-]{36}$/i.test(value.id)) session = {...value, drafts:value.drafts||{}}; } catch {}
function persist() {
 try { localStorage.setItem(KEY, JSON.stringify(session)); }
 catch { $('estado').textContent = 'No se pudo conservar el borrador en este navegador. No cierres la página antes de enviar.'; }
}
async function rpc(name, data) {
 const controller = new AbortController();
 const timeout = setTimeout(() => controller.abort(), 20000);
 try {
 const r = await fetch(new URL('/rest/v1/rpc/'+name,config.supabaseUrl),{
 method:'POST', headers:{apikey:config.clavePublicable,'Content-Type':'application/json'},
 body:JSON.stringify(data), signal:controller.signal, cache:'no-store'});
 if(!r.ok) throw new Error('No se pudo guardar o consultar la evaluación. Revisá la conexión y la configuración; luego intentá otra vez.');
 return await r.json();
 } catch(e) { if(e.name==='AbortError') throw new Error('La conexión tardó demasiado. Intentá nuevamente; el reintento no duplica el envío.'); throw e; }
 finally {clearTimeout(timeout);}
}
function dataFor(form) {
 return Object.fromEntries([...criteria.map(([key])=>{const input=form.querySelector(`input[name="${key}"]:checked`);return [key,input?Number(input.value):null];}),['comentario',form.elements.comentario.value.trim()]]);
}
function updateProgress() {
 const count = [...cards.values()].filter(c=>c.saved).length;
 $('avance').textContent = `${count} de ${projects.length} grupos enviados`;
 $('barra').max=projects.length; $('barra').value=count;
}
function markSaved(card, record) {
 card.saved = true;
 for(const [key] of criteria) {const input=card.form.querySelector(`input[name="${key}"][value="${record[key]}"]`); if(input)input.checked=true;}
 card.form.elements.comentario.value=record.comentario || '';
 card.update();
 for(const input of card.form.querySelectorAll('input,textarea,button')) input.disabled=true;
 card.button.textContent='Evaluación enviada';
 card.badge.textContent='✓ Enviado'; card.badge.classList.add('sent');
 card.element.dataset.sent='true';
 card.status.textContent='Registrada a nombre de '+session.nombre+'.';
 card.status.classList.remove('error');
 card.nav.classList.add('done');
 delete session.drafts[card.project.grupo]; persist(); updateProgress();
}
function makeCard(project) {
 const element=document.createElement('article'); element.className='card'; element.id='grupo-'+project.grupo;
 element.innerHTML=`<div class="card-head"><div class="card-heading"><span class="eyebrow"></span><h3></h3></div><span class="badge">Por evaluar</span></div><form><div class="criteria"></div><label class="comments">Comentarios <small>· opcional</small><textarea name="comentario" maxlength="2000" rows="3" placeholder="Fortalezas, sugerencias o aspectos a mejorar…"></textarea></label><div class="card-bottom"><output class="total" aria-live="polite">— <small>/ 15 puntos</small></output><button type="submit">Enviar evaluación</button></div><p class="status" role="status" aria-live="polite"></p></form>`;
 element.querySelector('.eyebrow').textContent='GRUPO '+String(project.grupo).padStart(2,'0');
 element.querySelector('h3').textContent=project.nombre;
 const form=element.querySelector('form');
 form.setAttribute('aria-label','Evaluar '+project.nombre);
 for(const [key,title,description] of criteria){
 const field=document.createElement('fieldset');
 field.innerHTML='<legend></legend><p class="hint"></p><div class="scores"></div>';
 field.querySelector('legend').textContent=title;
 field.querySelector('.hint').textContent=description;
 for(let i=0;i<=5;i++){
 const label=document.createElement('label');label.className='score';
 const input=document.createElement('input');input.type='radio';input.name=key;input.value=i;input.required=true;input.setAttribute('aria-label',`${title}: ${i} de 5`);
 const span=document.createElement('span');span.textContent=i; label.append(input,span);field.querySelector('.scores').append(label);
 }
 form.querySelector('.criteria').append(field);
 }
 const draft=session.drafts[project.grupo];
 if(draft){for(const [key]of criteria){const input=form.querySelector(`input[name="${key}"][value="${Number(draft[key])}"]`);if(draft[key]!==null&&input)input.checked=true;} form.elements.comentario.value=draft.comentario||'';}
 const nav=document.createElement('a');nav.href='#'+element.id;nav.textContent='Grupo '+project.grupo;$('navegacion').append(nav);
 const card={project,element,form,nav,saved:false,button:form.querySelector('button'),badge:element.querySelector('.badge'),status:form.querySelector('.status')};
 card.update=()=>{const data=dataFor(form);const complete=criteria.every(([key])=>data[key]!==null);form.querySelector('output').innerHTML=(complete?criteria.reduce((a,[key])=>a+data[key],0):'—')+' <small>/ 15 puntos</small>';};
 card.update();
 form.addEventListener('input',()=>{if(card.saved)return;session.drafts[project.grupo]=dataFor(form);persist();card.update();card.badge.textContent='Borrador';card.status.textContent='Pendiente de envío.';});
 form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||card.saved||!form.reportValidity())return;
 const data=dataFor(form);busy=true;setBusy(true);card.status.classList.remove('error');card.status.textContent='Enviando evaluación…';
 try {
 const record=await rpc('jurados_enviar_v2',{p_sesion:session.id,p_evaluador:session.nombre,p_grupo:project.grupo,p_exposicion:data.exposicion,p_demostracion:data.demostracion,p_respuestas:data.respuestas,p_comentario:data.comentario});
 markSaved(card,record);
 }catch(error){card.status.textContent=error.message;card.status.classList.add('error');}
 finally{busy=false;setBusy(false);}
 });
 cards.set(project.grupo,card);$('grupos').append(element);
}
function setBusy(value){
 $('cambiar').disabled=value;
 for(const card of cards.values())for(const input of card.form.querySelectorAll('input,textarea,button'))input.disabled=value||card.saved;
}
async function openSession(){
 $('bienvenida').hidden=true;$('evaluacion').hidden=false;$('evaluador').textContent=session.nombre;
 $('grupos').replaceChildren();$('navegacion').replaceChildren();cards.clear();projects.forEach(makeCard);updateProgress();
 busy=true;setBusy(true);$('estado').textContent='Consultando tus evaluaciones enviadas…';
 try{const records=await rpc('jurados_cargar_v2',{p_sesion:session.id});for(const record of records){const card=cards.get(record.grupo);if(card)markSaved(card,record);} $('estado').textContent='';}
 catch(error){$('estado').textContent='No se pudieron consultar los envíos previos. Podés reintentar enviando cada grupo: no se duplicará un envío ya registrado.';}
 finally{busy=false;setBusy(false);}
}
$('inicio').addEventListener('submit',event=>{
 event.preventDefault();const name=$('nombre').value.trim();
 if(name.length<2){$('nombre').setCustomValidity('Ingresá tu nombre y apellido.');$('nombre').reportValidity();return;}
 session={id:crypto.randomUUID(),nombre:name,drafts:{}};persist();openSession();
});
$('nombre').addEventListener('input',()=>$('nombre').setCustomValidity(''));
$('cambiar').addEventListener('click',()=>{
 if(busy)return;
 if(!confirm('¿Comenzar con otro evaluador? Los envíos anteriores se conservarán en la base de datos. Los borradores de esta sesión se descartarán.'))return;
 try{localStorage.removeItem(KEY);}catch{}
 session=null;cards.clear();$('evaluacion').hidden=true;$('bienvenida').hidden=false;$('nombre').value='';$('nombre').focus();$('estado').textContent='';
});
if(!config.supabaseUrl||!config.clavePublicable){$('estado').textContent='Falta configurar la conexión en planilla-config.js.';$('inicio').querySelector('button').disabled=true;}
else if(session)openSession();
})();

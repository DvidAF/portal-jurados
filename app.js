'use strict';
const $ = id => document.getElementById(id);
const projects = Array.isArray(window.PROYECTOS) ? window.PROYECTOS : [];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function youtubeId(value) {
  try {
    const u = new URL(value); if (u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase(); let id;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (['youtube.com','www.youtube.com','m.youtube.com'].includes(host)) id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : null;
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
function drivePreviewUrl(value) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://drive.google.com') return null;

    const match = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
    if (!match) return null;

    const preview = new URL('/file/d/' + match[1] + '/preview', url.origin);
    const resourceKey = url.searchParams.get('resourcekey');
    if (resourceKey) preview.searchParams.set('resourcekey', resourceKey);
    return preview.href;
  } catch {
    return null;
  }
}

let reviewed = new Set();
try { const saved = JSON.parse(localStorage.getItem('jurados-iv-revisados') || '[]'); if (Array.isArray(saved)) reviewed = new Set(saved); } catch {}
const icons = {
 salud:'<path d="M12 5v14M5 12h14"/>',
 inventario:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
 asistencia:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 11h16m-12 5 3 3 5-5"/>'
};
function render() {
 const list = projects;
 $('grid').innerHTML = list.map(p => {
 const drivePreview = drivePreviewUrl(p.driveUrl);
 const id = drivePreview ? null : youtubeId(p.youtube);
 const hasVideo = Boolean(id || drivePreview);
 const thumbnail = drivePreview
   ? p.miniatura
   : id && `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
 const seen = reviewed.has(p.id); const index = p.grupo || projects.indexOf(p) + 1; const groupLabel = p.grupo ? 'GRUPO ' + String(p.grupo).padStart(2,'0') : 'VIDEO SIN ASIGNAR';
 return `<article class="project-card"><div class="project-visual visual-${index % 3}${thumbnail ? ' has-thumbnail' : ''}"><span class="project-number">${esc(groupLabel)}</span><svg class="project-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[p.icono] || icons.inventario}</svg><span class="visual-label">${esc(p.categoria)}</span>${p.ejemplo ? '<span class="example-tag">Ejemplo</span>' : ''}${thumbnail ? `<button class="thumbnail-watch watch" data-id="${esc(p.id)}" aria-label="Ver presentación de ${esc(p.nombre)}"><img class="video-thumbnail" src="${esc(thumbnail)}" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="thumbnail-shade"></span><span class="thumbnail-play" aria-hidden="true">▶</span><span class="thumbnail-caption">Ver presentación</span></button>` : ''}</div><div class="project-body"><div class="project-meta"><span>${esc(groupLabel)}</span><span class="status ${hasVideo ? 'available' : ''}">${hasVideo ? '● Video disponible' : '◌ Video pendiente'}</span></div><h3>${esc(p.nombre)}</h3><p class="intro">${esc(p.introduccion)}</p><div class="card-actions">${hasVideo ? `<button class="primary-btn watch" data-id="${esc(p.id)}"><span aria-hidden="true">▷</span> Ver presentación</button>` : '<button class="pending-btn" disabled>Enlace por confirmar</button>'}<label class="review-checkbox"><input type="checkbox" data-id="${esc(p.id)}" ${seen ? 'checked' : ''}> Revisado</label></div></div></article>`;
 }).join('');
 $('empty').hidden = !!list.length;
}
// Si YouTube no entrega la miniatura, se conserva el fondo original.
$('grid').addEventListener('error', e => {
 if (!e.target.matches('.video-thumbnail')) return;
 e.target.remove();
}, true);
$('grid').addEventListener('change',e=> {if (!e.target.matches('input[type=checkbox]')) return; const id=e.target.dataset.id; if(e.target.checked) reviewed.add(id); else reviewed.delete(id);try{localStorage.setItem('jurados-iv-revisados',JSON.stringify([...reviewed]));}catch{} render();});
$('grid').addEventListener('click', event => {
  const button = event.target.closest('.watch');
  if (!button) return;

  const project = projects.find(p => p.id === button.dataset.id);
  if (!project) return;

  const drivePreview = drivePreviewUrl(project.driveUrl);
  const id = youtubeId(project.youtube);
  if (!drivePreview && !id) return;

  $('videoTitle').textContent = project.nombre;
  $('videoDescription').textContent = project.introduccion;

  const externalLink = $('youtubeLink');
  externalLink.href = drivePreview
    ? project.driveUrl
    : 'https://www.youtube.com/watch?v=' + id;
  externalLink.textContent = drivePreview ? 'Abrir en Drive ↗' : 'Abrir en YouTube ↗';

  const dialog = $('videoDialog');
  const playbackNote = dialog.querySelector('.small');
  if (playbackNote) {
    playbackNote.textContent = 'Si el video no se reproduce aquí, use el enlace de arriba.';
  }

  const iframe = document.createElement('iframe');
  iframe.src = drivePreview || 'https://www.youtube-nocookie.com/embed/' + id;
  iframe.title = 'Presentación: ' + project.nombre;
  iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';

  $('player').replaceChildren(iframe);
  dialog.showModal();
});
['openGuide2'].forEach(id=>$(id).addEventListener('click',()=>$('guide').showModal()));
['closeGuide','doneGuide'].forEach(id=>$(id).addEventListener('click',()=>$('guide').close()));
$('closeVideo').addEventListener('click',()=>$('videoDialog').close());
$('videoDialog').addEventListener('close',()=>$('player').replaceChildren());
for (const d of document.querySelectorAll('dialog')) d.addEventListener('click',e=> {if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});
render();



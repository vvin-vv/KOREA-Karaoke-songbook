const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const ESCAPE = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESCAPE[c]);
const clean = v => String(v ?? '').trim().slice(0, 500);
const norm = v => clean(v).toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
const uid = () => (globalThis.crypto?.randomUUID?.() || `song-${Date.now()}-${Math.random().toString(36).slice(2)}`);
const brandText = brand => brand === 'tj' ? 'TJ' : 'KY';
const brandOther = brand => brand === 'tj' ? 'kumyoung' : 'tj';
const formatNumber = no => no ? esc(no) : '<span class="number-empty">번호 미등록</span>';
// Old backups used "팝송"; display them in the POP section without changing stored songs.
const canonicalGenre = value => {
  const g = clean(value);
  if (/^(팝송|pop|western pop)$/i.test(g)) return 'POP';
  if (/^(j[ -]?pop|일본팝)$/i.test(g)) return 'J-POP';
  return g;
};
const genreGroup = song => {
  const genre = canonicalGenre(song.genre);
  return ['POP','J-POP','발라드'].includes(genre) ? genre : 'other';
};

const state = { tab:'search', brand:localStorage.getItem('songbook-brand') === 'kumyoung' ? 'kumyoung' : 'tj', mode:'title', libraryFilter:'all', genreFilter:'all', pendingGenreSave:null, songs:[], search:{items:[], term:'', page:0, maxPage:0, loading:false, token:0} };

// IndexedDB is used for persistent offline storage; localStorage is only a recovery fallback.
let dbPromise;
function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open('my-songbook-db', 1);
    req.onupgradeneeded = () => {if (!req.result.objectStoreNames.contains('songs')) req.result.createObjectStore('songs',{keyPath:'id'});};
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Database blocked'));
  });
  return dbPromise;
}
async function transact(action, data) {
  try {
    const database = await db();
    return await new Promise((resolve, reject) => {
      const tx = database.transaction('songs', action === 'all' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('songs');
      const req = action === 'all' ? store.getAll() : action === 'put' ? store.put(data) : store.delete(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    // Last-resort fallback, e.g. storage disabled in some iOS modes.
    const fallbackKey = 'my-songbook-local-fallback';
    const all = JSON.parse(localStorage.getItem(fallbackKey) || '[]');
    if (action === 'all') return all;
    const filtered = all.filter(s => s.id !== (action === 'put' ? data.id : data));
    if (action === 'put') filtered.push(data);
    localStorage.setItem(fallbackKey, JSON.stringify(filtered));
    return undefined;
  }
}
async function refreshSaved() {state.songs = await transact('all'); renderLibrary(); updateCounts();}
async function save(song, quiet = false) {await transact('put',song);await refreshSaved();if (!quiet) toast('내 노래책에 저장했어!');}
async function remove(id) {await transact('delete',id);await refreshSaved();}
function updateCounts(){ $('#saved-count').textContent=state.songs.length;$('#favorite-count').textContent=state.songs.filter(s=>s.favorite).length; }
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>el.classList.remove('show'),2300);}
function matchingSong(result){return state.songs.find(s=>norm(s.title)===norm(result.title)&&norm(s.singer)===norm(result.singer));}
function makeSong(entry){return {id:uid(),title:clean(entry.title),singer:clean(entry.singer),numbers:{tj:entry.numbers?.tj||'',kumyoung:entry.numbers?.kumyoung||''},genre:canonicalGenre(entry.genre),key:clean(entry.key)||'원키',note:clean(entry.note),aliases:clean(entry.aliases),favorite:!!entry.favorite,createdAt:Date.now(),updatedAt:Date.now()};}
async function saveSearchResult(result, asFavorite=false, genre=''){
  const existing=matchingSong(result);
  if (existing){existing.numbers[result.brand]=result.no; if(asFavorite) existing.favorite=true; if(genre) existing.genre=canonicalGenre(genre); existing.updatedAt=Date.now(); await save(existing);}
  else await save(makeSong({...result,numbers:{[result.brand]:result.no},genre,favorite:asFavorite}));
  renderSearchResults();
}
function requestSaveGenre(result,asFavorite=false){
  const existing=matchingSong(result);
  if(existing && canonicalGenre(existing.genre)) return saveSearchResult(result,asFavorite);
  state.pendingGenreSave={result,asFavorite};
  $('#genre-song-name').textContent=`${result.title} · ${result.singer||'가수 미상'}`;
  $('#genre-layer').hidden=false;
  document.body.style.overflow='hidden';
  $('[data-choose-genre="POP"]').focus();
}
function hideGenrePicker(){
  $('#genre-layer').hidden=true;
  state.pendingGenreSave=null;
  document.body.style.overflow='';
}
async function toggleFavorite(id){const song=state.songs.find(s=>s.id===id);if(!song)return;song.favorite=!song.favorite;song.updatedAt=Date.now();await save(song,true);renderSearchResults();toast(song.favorite?'즐겨찾기에 추가했어 ♥':'즐겨찾기에서 제외했어');}
function showTab(tab){
  state.tab=tab;$$('.page').forEach(e=>{e.hidden=e.id!==`page-${tab}`;e.classList.toggle('active',!e.hidden);});
  $$('[data-tab]').forEach(e=>e.classList.toggle('active',e.dataset.tab===tab));
  if(tab==='library')renderLibrary();if(tab==='settings')refreshDevice();
  window.scrollTo({top:0,behavior:'auto'});
}
function updateBrand(){
  $$('[data-brand]').forEach(el=>el.classList.toggle('active',el.dataset.brand===state.brand));
  $('#settings-brand').value=state.brand;
  localStorage.setItem('songbook-brand',state.brand);
  renderLibrary();
  // Existing search numbers belong to the other brand; clear them when switching.
  state.search.items=[];state.search.page=0;state.search.maxPage=0;renderSearchResults();
  if(state.search.term)performSearch(false);
}
function searchCard(result,index){
  const saved=matchingSong(result);const savedNo=saved?.numbers?.[result.brand] === result.no;
  return `<article class="song-card">
    <div class="song-main"><div class="song-topline"><span class="mini-tag green">${brandText(result.brand)}</span>${savedNo?'<span class="mini-tag">내 노래책 ✓</span>':''}${saved?.genre?`<span class="mini-tag">${esc(canonicalGenre(saved.genre))}</span>`:''}</div>
      <h4>${esc(result.title)}</h4><p class="artist">${esc(result.singer||'가수 미상')}</p>
      <div class="number-line"><span class="song-number">${formatNumber(result.no)}</span><span class="number-label">노래번호</span></div>
    </div><div class="song-actions">
      <button type="button" data-result-action="favorite" data-result-index="${index}" class="${saved?.favorite?'favorited':''}" aria-label="즐겨찾기 저장" title="즐겨찾기 저장">${saved?.favorite?'♥':'♡'}</button>
      <button type="button" data-result-action="save" data-result-index="${index}" class="${savedNo?'saved':''}" aria-label="내 노래책 저장" title="내 노래책 저장">${savedNo?'✓':'＋'}</button>
    </div></article>`;
}
function libraryCard(song){
  const main=clean(song.numbers?.[state.brand]), other=clean(song.numbers?.[brandOther(state.brand)]);
  return `<article class="song-card">
   <div class="song-main"><div class="song-topline"><span class="mini-tag green">${brandText(state.brand)}</span>${song.genre?`<span class="mini-tag genre-tag">${esc(canonicalGenre(song.genre))}</span>`:'<span class="mini-tag">미분류</span>'}<span class="mini-tag">${esc(song.key||'원키')}</span></div><h4>${esc(song.title)}</h4><p class="artist">${esc(song.singer)}</p>
     <div class="number-line"><span class="song-number">${formatNumber(main)}</span>${main?`<span class="number-label">${brandText(state.brand)} 번호</span>`:''}${other?`<span class="other-number">${brandText(brandOther(state.brand))} ${esc(other)}</span>`:''}</div>
     ${song.note?`<p class="song-note">✎ ${esc(song.note)}</p>`:''}
   </div><div class="song-actions"><button class="${song.favorite?'favorited':''}" data-favorite-id="${esc(song.id)}" type="button" aria-label="즐겨찾기 토글">${song.favorite?'♥':'♡'}</button><button data-edit-id="${esc(song.id)}" type="button" aria-label="곡 편집">✎</button></div>
  </article>`;
}
function renderSearchResults(){
  const {items,page,maxPage,loading}=state.search;
  $('#results-title').hidden=items.length===0;
  $('#result-count').textContent=`${items.length}곡`;
  $('#search-results').innerHTML=items.map(searchCard).join('');
  $('#more-results').hidden=!items.length||page>=maxPage;
  $('#more-results').disabled=loading;
  $('#more-results').textContent=loading?'불러오는 중…':'검색 결과 더 보기 ↓';
}
function renderLibrary(){
  const query=norm($('#library-query')?.value||'');
  const counts={all:state.songs.length,POP:0,'J-POP':0,'발라드':0,other:0};
  for(const song of state.songs)counts[genreGroup(song)]++;
  $$('[data-genre-count]').forEach(el=>{el.textContent=counts[el.dataset.genreCount]||0;});
  let songs=[...state.songs].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(state.genreFilter!=='all') songs=songs.filter(song=>genreGroup(song)===state.genreFilter);
  if(state.libraryFilter==='favorite') songs=songs.filter(s=>s.favorite);
  if(state.libraryFilter==='all')songs.sort((a,b)=>a.title.localeCompare(b.title,'ko'));
  if(query)songs=songs.filter(s=>norm([s.title,s.singer,s.numbers?.tj,s.numbers?.kumyoung,canonicalGenre(s.genre),s.note,s.aliases].join(' ')).includes(query));
  const selectedName=state.genreFilter==='all'?'':state.genreFilter==='other'?'기타':state.genreFilter;
  $('#library-results').innerHTML=songs.length?songs.map(libraryCard).join(''):`<div class="empty-state"><span class="empty-icon">♫</span><strong>${state.songs.length?'조건에 맞는 노래가 없어':'아직 저장한 노래가 없어'}</strong><p>${state.songs.length?(selectedName?`${esc(selectedName)} 카테고리에 저장된 곡이 없어. 다른 장르를 눌러보거나 곡을 추가해 줘.`:'검색어 또는 필터를 바꿔봐.'):'전체 검색에서 노래를 찾고 ＋ 버튼을 눌러 저장해봐.'}</p><button class="secondary-btn" data-go-search="1" type="button">전체 검색으로 이동 ↗</button></div>`;
}
function showNotice(title,description, kind='normal'){
  const el=$('#search-state');el.hidden=false;
  el.innerHTML=`<span class="notice-icon">${kind==='error'?'!':kind==='loading'?'◌':'✦'}</span><div><strong>${esc(title)}</strong><p>${esc(description)}</p></div>`;
}
async function fetchKaraoke(keyword,brand,mode,page){
  const params=new URLSearchParams({brand,mode,keyword,page:String(page)});
  const direct=new URL('https://api.manana.kr/v2/karaoke/search.json');
  direct.searchParams.set('brand',brand);
  direct.searchParams.set(mode,keyword);
  direct.searchParams.set('limit','20');
  direct.searchParams.set('page',String(page));
  const proxy=new URL('./api/search',new URL('./',window.location.href));proxy.search=params.toString();
  let lastError;
  for (const endpoint of [proxy,direct]) {
    try{
      const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
      let response;
      try {response=await fetch(endpoint,{signal:controller.signal,headers:{'Accept':'application/json'}});}finally{clearTimeout(timeout);}
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const json=await response.json();
      if (!json||!Array.isArray(json.data))throw new Error('응답 형식이 올바르지 않음');
      return json;
    }catch(error){lastError=error;}
  }
  throw lastError||new Error('검색 불가');
}
async function performSearch(append=false){
  const term=$('#search-query').value.trim();
  if(!term){showNotice('검색어가 비어 있어','제목, 가수 또는 번호를 입력해 줘.');return;}
  if(!navigator.onLine){showNotice('오프라인이야','인터넷에 연결하면 전체 노래를 검색할 수 있어. 저장한 노래는 내 노래책에서 확인해.', 'error');return;}
  const token=++state.search.token;
  const page=append?state.search.page+1:1;
  if(!append){state.search.items=[];state.search.page=0;state.search.maxPage=0;}
  state.search.term=term;state.search.loading=true;
  showNotice('노래를 검색하고 있어','잠시 검색 결과를 불러오는 중이야.','loading');renderSearchResults();
  try{
    const response=await fetchKaraoke(term,state.brand,state.mode,page);
    if(token!==state.search.token)return;
    const rows=response.data.filter(r=>r&&r.brand===state.brand&&r.no&&r.title)
      .map(r=>({brand:state.brand,no:clean(r.no),title:clean(r.title),singer:clean(r.singer)}));
    const keys=new Set(state.search.items.map(r=>`${r.brand}:${r.no}`));
    for(const row of rows){const key=`${row.brand}:${row.no}`;if(!keys.has(key)){keys.add(key);state.search.items.push(row);}}
    const total=Number(response.total?.row||0);
    state.search.page=page;state.search.maxPage=total?Math.min(100,Math.ceil(total/20)):page+(rows.length>=20?1:0);
    $('#search-state').hidden=state.search.items.length>0;
    if(!state.search.items.length)showNotice('검색 결과가 없어','다른 검색 기준이나 검색어로 다시 시도해봐. 공식 검색 링크도 확인할 수 있어.');
    renderSearchResults();
  }catch(error){
    if(token!==state.search.token)return;
    showNotice('전체곡 검색에 연결하지 못했어','검색 API 장애 또는 브라우저 통신 제한일 수 있어. 아래 공식 검색 링크를 이용하거나 잠시 후 다시 시도해 줘.','error');
  }finally{if(token===state.search.token){state.search.loading=false;renderSearchResults();}}
}
function sanitizeImport(raw){
  if(!raw||typeof raw!=='object'||typeof raw.title!=='string'||typeof raw.singer!=='string')return null;
  const s=makeSong({title:raw.title.slice(0,120),singer:raw.singer.slice(0,120),numbers:{tj:clean(raw.numbers?.tj).slice(0,20),kumyoung:clean(raw.numbers?.kumyoung).slice(0,20)},key:raw.key||'원키',note:raw.note,genre:raw.genre,aliases:raw.aliases,favorite:raw.favorite});
  if(!s.title||!s.singer)return null;
  return s;
}
function editSong(id){
  const song=state.songs.find(s=>s.id===id);if(!song)return;
  const f=$('#edit-form');f.elements.id.value=song.id;f.elements.title.value=song.title;f.elements.singer.value=song.singer;f.elements.tj.value=song.numbers?.tj||'';f.elements.ky.value=song.numbers?.kumyoung||'';f.elements.genre.value=['','POP','J-POP','발라드','K-POP','락','기타'].includes(canonicalGenre(song.genre))?canonicalGenre(song.genre):'기타';f.elements.key.value=song.key||'원키';f.elements.note.value=song.note||'';f.elements.aliases.value=song.aliases||'';f.elements.favorite.checked=!!song.favorite;
  $('#modal-layer').hidden=false;document.body.style.overflow='hidden';
}
function hideSheet(){$('#modal-layer').hidden=true;document.body.style.overflow='';}
function formSong(f){return {title:f.elements.title.value.trim(),singer:f.elements.singer.value.trim(),numbers:{tj:f.elements.tj.value.trim(),kumyoung:f.elements.ky.value.trim()},genre:canonicalGenre(f.elements.genre.value),key:f.elements.key.value,note:f.elements.note.value.trim(),aliases:f.elements.aliases.value.trim(),favorite:f.elements.favorite.checked};}
function refreshDevice(){
  $('#network-info').textContent=navigator.onLine?'온라인 · 전체곡 검색 가능':'오프라인 · 저장한 노래만 이용 가능';
  $('#install-info').textContent=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone?'홈 화면 앱으로 실행 중':'Safari에서 홈 화면에 추가 가능';
}
function bind(){
  $$('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>showTab(btn.dataset.tab)));
  $('#top-settings').addEventListener('click',()=>showTab('settings'));
  $$('[data-brand]').forEach(btn=>btn.addEventListener('click',()=>{if(state.brand!==btn.dataset.brand){state.brand=btn.dataset.brand;updateBrand();}}));
  $$('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{$$('[data-mode]').forEach(b=>b.classList.toggle('active',b===btn));state.mode=btn.dataset.mode;if($('#search-query').value.trim())performSearch();}));
  $('#search-form').addEventListener('submit',e=>{e.preventDefault();performSearch();});
  $('#clear-search').addEventListener('click',()=>{$('#search-query').value='';$('#search-query').focus();$('#clear-search').hidden=true;state.search.items=[];state.search.term='';state.search.token++;renderSearchResults();showNotice('노래를 찾아볼까?','검색어를 입력하면 TJ·금영 노래번호를 찾아줘.');});
  $('#search-query').addEventListener('input',()=>{$('#clear-search').hidden=!$('#search-query').value;});
  $('#more-results').addEventListener('click',()=>{if(!state.search.loading)performSearch(true);});
  $('#search-results').addEventListener('click',async e=>{const btn=e.target.closest('[data-result-action]');if(!btn)return;const r=state.search.items[Number(btn.dataset.resultIndex)];if(!r)return;if(btn.dataset.resultAction==='save'){await requestSaveGenre(r,false);}else{const s=matchingSong(r);if(s?.favorite){await toggleFavorite(s.id);}else await requestSaveGenre(r,true);}});
  $$('[data-choose-genre]').forEach(btn=>btn.addEventListener('click',async()=>{
    const pending=state.pendingGenreSave;
    hideGenrePicker();
    if(pending)await saveSearchResult(pending.result,pending.asFavorite,btn.dataset.chooseGenre);
  }));
  $('#cancel-genre').addEventListener('click',hideGenrePicker);
  $('#genre-backdrop').addEventListener('click',hideGenrePicker);
  $('#library-query').addEventListener('input',renderLibrary);
  $$('[data-genre-filter]').forEach(btn=>btn.addEventListener('click',()=>{
    $$('[data-genre-filter]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn));});
    state.genreFilter=btn.dataset.genreFilter;renderLibrary();
  }));
  $$('[data-library-filter]').forEach(btn=>btn.addEventListener('click',()=>{$$('[data-library-filter]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn));});state.libraryFilter=btn.dataset.libraryFilter;renderLibrary();}));
  $('#library-results').addEventListener('click',async e=>{const fav=e.target.closest('[data-favorite-id]');const edit=e.target.closest('[data-edit-id]');if(fav)await toggleFavorite(fav.dataset.favoriteId);else if(edit)editSong(edit.dataset.editId);else if(e.target.closest('[data-go-search]'))showTab('search');});
  $('#add-form').addEventListener('submit',async e=>{e.preventDefault();const payload=formSong(e.currentTarget);const match=matchingSong(payload);if(match){toast('같은 제목과 가수의 노래가 이미 있어. 내 노래책에서 편집해 줘.');return;}await save(makeSong(payload));e.currentTarget.reset();showTab('library');});
  $('#settings-brand').addEventListener('change',e=>{state.brand=e.target.value;updateBrand();toast('기본 반주기를 변경했어.');});
  $('#edit-form').addEventListener('submit',async e=>{e.preventDefault();const song=state.songs.find(s=>s.id===e.currentTarget.elements.id.value);if(!song)return;const payload=formSong(e.currentTarget);Object.assign(song,payload,{updatedAt:Date.now()});await save(song);hideSheet();});
  $('#delete-song').addEventListener('click',async()=>{const id=$('#edit-form').elements.id.value;const song=state.songs.find(s=>s.id===id);if(!song)return;if(!confirm(`「${song.title}」 곡을 삭제할까?`))return;await remove(id);hideSheet();toast('노래를 삭제했어.');});
  $('#close-sheet').addEventListener('click',hideSheet);$('#modal-backdrop').addEventListener('click',hideSheet);
  $('#export-data').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({app:'my-songbook',version:1,exportedAt:new Date().toISOString(),songs:state.songs},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`my-songbook-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('백업 파일을 저장해 줘.');});
  $('#import-data').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5_000_000)throw Error('파일이 너무 커.');const obj=JSON.parse(await file.text());if(!Array.isArray(obj.songs))throw Error('올바른 백업 파일이 아니야.');let count=0;for(const raw of obj.songs.slice(0,3000)){const song=sanitizeImport(raw);if(!song)continue;const existing=matchingSong(song);if(existing){existing.numbers.tj=song.numbers.tj||existing.numbers.tj;existing.numbers.kumyoung=song.numbers.kumyoung||existing.numbers.kumyoung;existing.favorite=existing.favorite||song.favorite;existing.key=song.key!=='원키'?song.key:existing.key;existing.note=song.note||existing.note;existing.genre=song.genre||existing.genre;existing.aliases=song.aliases||existing.aliases;await transact('put',existing);}else await transact('put',song);count++;}await refreshSaved();toast(`${count}곡의 백업 데이터를 처리했어.`);}catch(error){toast(error.message||'백업 파일을 읽지 못했어.');}finally{e.target.value='';}});
  $('#refresh-app').addEventListener('click',async()=>{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();await reg?.update();}location.reload();});
  window.addEventListener('online',refreshDevice);window.addEventListener('offline',refreshDevice);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('#genre-layer').hidden)hideGenrePicker();else if(!$('#modal-layer').hidden)hideSheet();}});
}
async function init(){
  bind();updateBrand();await refreshSaved();refreshDevice();
  if('serviceWorker' in navigator && location.protocol==='https:') navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init().catch(e=>{console.error(e);toast('초기화에 문제가 발생했어. 새로고침해 줘.');});

'use strict';
(function () {
  const DB_NAME = 'mach-nho-memory';
  const DB_VERSION = 1;
  const STORES = ['conversations', 'memories', 'tasks'];
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean = (v) => String(v == null ? '' : v).replace(/\u0000/g, '').trim();
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(16).slice(2));
  const now = () => new Date().toISOString();
  const date = (v) => { const d = v ? new Date(v) : new Date(); return isNaN(d) ? 'Chưa rõ ngày' : new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'short',year:'numeric'}).format(d); };
  const short = (v, n) => { const t = clean(v).replace(/\s+/g,' '); return t.length > n ? t.slice(0,n-1).trim() + '…' : t; };
  const TOPICS = [
    ['Học tập','study',['học tập','bài tập','ôn thi','giảng viên','sinh viên','môn học','công thức','phương pháp','đề thi','giáo trình']],
    ['Lập trình & công nghệ','tech',['github','repo','repository','javascript','python','code','lập trình','website','apk','api','server','database','bug','deploy','html','css','android']],
    ['Viết & nội dung','writing',['viết','soạn thảo','chỉnh sửa','biên tập','bài viết','dịch','email','kịch bản','rewrite','draft','translate']],
    ['Công việc & kế hoạch','work',['công việc','kế hoạch','deadline','mục tiêu','dự án','ưu tiên','to-do','task','project','việc cần làm']],
    ['Tài chính','finance',['ngân sách','chi tiêu','tiết kiệm','đầu tư','doanh thu','lợi nhuận','giá thành','chi phí','budget','revenue','profit']],
    ['Du lịch & địa điểm','travel',['du lịch','khách sạn','nhà hàng','địa điểm','chuyến đi','vé máy bay','travel','hotel','restaurant']],
    ['Sở thích & đời sống','life',['sở thích','thói quen','gia đình','sức khỏe','phim ảnh','giải trí','hobby','book','music','movie']]
  ];
  const SECRET = /(mật khẩu|password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|private key|seed phrase|mnemonic phrase|số thẻ|cvv|cccd|căn cước|chứng minh nhân dân)/i;
  const TASK_RE = /(việc cần làm|todo|to-do|deadline|hạn chót|hoàn thành|cần sửa|cần làm|phải làm|đừng quên|nhớ làm|triển khai|kiểm tra lại|rà soát|nộp bài|ôn thi)/i;
  const MEM_RE = /(hãy nhớ|nhớ rằng|ghi nhớ|sở thích của tôi|tôi thích|tôi không thích|tôi đang học|tôi đang làm|mục tiêu của tôi|tôi muốn|ưu tiên của tôi|tôi thường|tôi cần|từ nay|luôn luôn|đừng gọi tôi|gọi tôi là)/i;
  let db;
  let state = { conversations: [], memories: [], tasks: [], page: 'home', q: '', selected: null, category: 'all', taskFilter: 'open' };

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        STORES.forEach(name => { if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name, { keyPath: 'id' }); });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Kho dữ liệu bị chặn bởi tab khác.'));
    });
  }
  function request(store, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode); let result;
      result = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(result && result.result);
      tx.onerror = () => reject(tx.error || new Error('Không thể lưu dữ liệu.'));
      tx.onabort = () => reject(tx.error || new Error('Đã hủy thao tác.'));
    });
  }
  const all = (store) => new Promise((resolve,reject) => {
    const tx = db.transaction(store,'readonly'), r = tx.objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result || []); r.onerror = () => reject(r.error);
  });
  const put = (store, value) => request(store,'readwrite',o=>o.put(value));
  const del = (store, id) => request(store,'readwrite',o=>o.delete(id));
  const clearStore = (store) => request(store,'readwrite',o=>o.clear());

  function classify(messages) {
    const corpus = messages.map(m=>m.text).join('\n').toLocaleLowerCase('vi');
    const scored = TOPICS.map(([name,category,words])=>({name,category,score:words.filter(w=>corpus.includes(w)).length}))
      .filter(t=>t.score).sort((a,b)=>b.score-a.score).slice(0,3);
    return scored.length ? scored : [{name:'Chủ đề khác',category:'other',score:0}];
  }
  function makeAnalysis(messages) {
    const topics = classify(messages);
    const users = messages.filter(m=>m.role==='user' && m.text);
    const assistant = messages.filter(m=>m.role==='assistant' && m.text);
    let summary = 'Cuộc trò chuyện có ' + messages.length + ' tin nhắn (' + users.length + ' của bạn, ' + assistant.length + ' phản hồi).';
    if (users.length) summary += ' Nội dung bạn nêu: ' + users.slice(0,3).map(m=>short(m.text,120)).join(' • ') + '.';
    if (assistant.length) summary += ' Phản hồi cuối: ' + short(assistant[assistant.length-1].text,180) + '.';
    return { method:'local-rules-v1', summary, topics, candidateMemories: memoryCandidates(messages), taskCandidates: taskCandidates(messages) };
  }
  function memoryCandidates(messages) {
    const out=[], seen=new Set();
    messages.filter(m=>m.role==='user').forEach(m=>{
      m.text.split(/\n+/).map(clean).filter(Boolean).forEach(line=>{
        if(line.length<18 || line.length>240 || SECRET.test(line) || !MEM_RE.test(line)) return;
        const key=line.toLocaleLowerCase('vi');
        if(seen.has(key)) return; seen.add(key);
        let category='other';
        if(/học|sinh viên|môn học|ôn thi/i.test(line)) category='study';
        else if(/dự án|đang làm|công việc|github|website|repo/i.test(line)) category='project';
        else if(/thích|không thích|ưu tiên|gọi tôi/i.test(line)) category='preference';
        else if(/mục tiêu|tôi muốn|tôi cần/i.test(line)) category='goal';
        out.push({id:uid(),title:short(line,70),content:line,category,status:'pending'});
      });
    });
    return out.slice(0,8);
  }
  function taskCandidates(messages) {
    const out=[],seen=new Set();
    messages.filter(m=>m.role==='user').forEach(m=>m.text.split(/\n+/).map(clean).forEach(line=>{
      if(line.length<12 || line.length>220 || SECRET.test(line) || !TASK_RE.test(line)) return;
      const key=line.toLocaleLowerCase('vi'); if(seen.has(key)) return; seen.add(key);
      out.push({id:uid(),title:short(line,180),sourceRole:m.role,accepted:false,done:false,createdAt:now()});
    }));
    return out.slice(0,12);
  }
  function contentText(v) {
    if(typeof v==='string') return v;
    if(Array.isArray(v)) return v.map(x=>typeof x==='string'?x:(x && (x.text || x.content) || '')).filter(Boolean).join('\n');
    if(v && Array.isArray(v.parts)) return v.parts.map(x=>typeof x==='string'?x:(x && x.text || '')).filter(Boolean).join('\n');
    return v && (v.text || v.content) || '';
  }
  function messagesFrom(obj) {
    if(obj && obj.mapping && typeof obj.mapping==='object') {
      return Object.values(obj.mapping).map(node=>{
        const m=node && node.message; if(!m) return null;
        let role=m.author && m.author.role || 'user';
        return {role:['user','assistant','system'].includes(role)?role:'user',text:clean(contentText(m.content)),timestamp:m.create_time||null};
      }).filter(m=>m && m.text).sort((a,b)=>Number(a.timestamp||0)-Number(b.timestamp||0));
    }
    if(Array.isArray(obj && obj.messages)) return obj.messages.map(m=>{
      let role=String(m.role||m.author?.role||m.speaker||'user').toLowerCase();
      if(['human','you'].includes(role)) role='user'; if(['gpt','chatgpt','bot','model'].includes(role)) role='assistant';
      if(!['user','assistant','system'].includes(role)) role='user';
      return {role,text:clean(contentText(m.content ?? m.text ?? m.parts)),timestamp:m.timestamp||m.create_time||null};
    }).filter(m=>m.text);
    return [];
  }
  function parseTranscript(text) {
    const out=[]; let current=null;
    String(text).replace(/\r/g,'').split('\n').forEach(line=>{
      const m=line.match(/^\s*(?:[-*]\s*)?(User|Assistant|System|Human|ChatGPT|GPT|You|Trợ lý|Người dùng)\s*[:：]\s*(.*)$/i);
      if(m) {
        if(current && clean(current.text)) out.push({...current,text:clean(current.text)});
        const r=m[1].toLowerCase();
        current={role:/assistant|chatgpt|gpt|trợ lý/.test(r)?'assistant':/system/.test(r)?'system':'user',text:m[2]};
      } else if(current) current.text += (current.text?'\n':'')+line;
      else if(clean(line)) { if(!current) current={role:'user',text:''}; current.text+=(current.text?'\n':'')+line; }
    });
    if(current && clean(current.text)) out.push({...current,text:clean(current.text)});
    return out.filter(m=>m.text);
  }
  function safeHTML(text) {
    const doc=new DOMParser().parseFromString(text,'text/html');
    doc.querySelectorAll('script,style,iframe,object,svg').forEach(n=>n.remove());
    return clean(doc.body.innerText || doc.body.textContent);
  }
  async function fingerprint(messages) {
    const raw=messages.map(m=>m.role+'|'+m.text).join('\n').slice(0,2000000);
    if(crypto.subtle) {
      const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }
    return raw.length+':'+raw.slice(0,100);
  }
  async function readFile(file) {
    const raw=await file.text(), ext=file.name.split('.').pop().toLowerCase();
    if(ext==='json') {
      let obj; try {obj=JSON.parse(raw);} catch {throw new Error(file.name+': JSON không hợp lệ.');}
      if(obj && obj.appName==='mach-nho-memory') return {backup:obj};
      const list=Array.isArray(obj)?obj:Array.isArray(obj.conversations)?obj.conversations:Array.isArray(obj.data)?obj.data:[obj];
      const records=list.map(o=>({title:clean(o.title||o.name||file.name.replace(/\.json$/i,'')),createdAt:o.create_time||o.created_at||o.createdAt||now(),source:file.name,messages:messagesFrom(o)})).filter(r=>r.messages.length);
      if(!records.length) throw new Error(file.name+': không tìm thấy cuộc trò chuyện. Với dữ liệu ChatGPT, hãy dùng conversations.json trong gói export.');
      return {records};
    }
    const text=(ext==='html'||ext==='htm')?safeHTML(raw):raw;
    const messages=parseTranscript(text);
    if(!messages.length) throw new Error(file.name+': file trống hoặc không có nội dung đọc được.');
    return {records:[{title:file.name.replace(/\.[^.]+$/,''),createdAt:now(),source:file.name,messages}]};
  }
  async function refresh() {
    const sets=await Promise.all(STORES.map(all));
    state.conversations=sets[0].sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    state.memories=sets[1].sort((a,b)=>Number(!!b.pinned)-Number(!!a.pinned)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    state.tasks=sets[2].sort((a,b)=>Number(!!a.done)-Number(!!b.done)||String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
    $('#navConversations').textContent=state.conversations.length;
    $('#navMemories').textContent=state.memories.length;
    $('#navTasks').textContent=state.tasks.filter(t=>t.accepted&&!t.done).length;
  }
  function toast(text,kind) {
    const el=$('#toast'); el.textContent=text; el.className='toast show '+(kind||'');
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.className='toast',3800);
  }
  function button(label,action,attrs,cls) {
    return '<button class="'+(cls||'btn btn-soft')+'" data-action="'+action+'" '+(attrs||'')+'>'+label+'</button>';
  }
  function heading(k,t,d,actions) {
    return '<div class="page-head"><div><div class="eyebrow">'+esc(k)+'</div><h1>'+esc(t)+'</h1><p>'+esc(d)+'</p></div><div class="head-actions">'+(actions||'')+'</div></div>';
  }
  function empty(icon,title,body,action) {
    return '<div class="empty"><div class="empty-icon">'+icon+'</div><h3>'+esc(title)+'</h3><p>'+esc(body)+'</p>'+(action||'')+'</div>';
  }
  function tag(topic) {
    const c={tech:'blue',writing:'sand',study:'rust',finance:'sand',travel:'blue',life:'gray',work:'rust',project:'blue',goal:'rust',preference:'sand'}[topic.category]||'gray';
    return '<span class="tag '+c+'">'+esc(topic.name||topic.category||'Khác')+'</span>';
  }
  function convCard(c) {
    return '<article class="conv-card" role="button" tabindex="0" data-action="open-conversation" data-id="'+esc(c.id)+'"><div class="conv-icon">▤</div><div class="conv-main"><h3>'+esc(c.title)+'</h3><p>'+esc(short(c.analysis?.summary||c.messages?.[0]?.text||'',150))+'</p><div class="meta"><span>'+esc(date(c.createdAt))+'</span><span>'+((c.messages||[]).length)+' tin nhắn</span>'+(c.analysis?.topics||[]).slice(0,2).map(tag).join('')+'</div></div><span class="chevron">↗</span></article>';
  }
  function renderHome() {
    const topics={}; state.conversations.forEach(c=>(c.analysis?.topics||[]).forEach(t=>{topics[t.name]=(topics[t.name]||0)+1;}));
    const tops=Object.entries(topics).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const pending=state.conversations.flatMap(c=>(c.analysis?.candidateMemories||[]).filter(m=>m.status==='pending').map(m=>({...m,conversationId:c.id,conversationTitle:c.title}))).filter(m=>!state.memories.some(x=>x.content===m.content)).slice(0,4);
    return '<div class="welcome"><div><div class="eyebrow">KHO KÝ ỨC CỦA BẠN <span class="spark">✳</span></div><h1>Những điều quan trọng,<br>được giữ lại.</h1><p>Gom cuộc trò chuyện thành hiểu biết có tổ chức: tìm kiếm nhanh, ghi nhớ có chọn lọc và biến ý tưởng thành việc cần làm.</p><div class="welcome-actions">'+button('＋ Thêm ghi nhớ','new-memory','','btn btn-outline')+button('Nhập hội thoại','import-chat','','btn btn-primary')+'</div></div><div class="welcome-art"><div class="orbit orbit-a"></div><div class="orbit orbit-b"></div><div class="art-core">✳</div><span class="art-dot dot-a"></span><span class="art-dot dot-b"></span><span class="art-dot dot-c"></span></div></div>'+
    '<div class="stats-grid"><article class="stat-card"><div class="stat-label">Hội thoại đã lưu <span>▤</span></div><div class="stat-number">'+state.conversations.length+'</div><div class="stat-note">Tư liệu bạn có thể tìm lại</div></article><article class="stat-card"><div class="stat-label">Ghi nhớ đã chọn <span>✳</span></div><div class="stat-number">'+state.memories.length+'</div><div class="stat-note">Điều bạn muốn giữ lâu dài</div></article><article class="stat-card"><div class="stat-label">Việc đang mở <span>↗</span></div><div class="stat-number">'+state.tasks.filter(t=>t.accepted&&!t.done).length+'</div><div class="stat-note">Từ ý tưởng thành hành động</div></article><article class="stat-card"><div class="stat-label">Chủ đề đã nhận diện <span>◌</span></div><div class="stat-number">'+Object.keys(topics).length+'</div><div class="stat-note">Phân loại bằng quy tắc tại máy</div></article></div>'+
    '<div class="content-grid"><section class="panel"><div class="panel-heading"><div><h2>Gần đây</h2><p>Các cuộc trò chuyện mới nhất</p></div>'+button('Xem tất cả →','nav','','btn btn-text')+'</div><div class="conversation-list">'+(state.conversations.length?state.conversations.slice(0,5).map(convCard).join(''):empty('▤','Kho đang trống','Nhập conversations.json từ gói dữ liệu ChatGPT hoặc thêm một đoạn hội thoại TXT/Markdown.',button('Nhập hội thoại','import-chat','','btn btn-primary')))+'</div></section><div class="right-stack"><section class="panel"><div class="panel-heading"><div><h2>Gợi ý ghi nhớ</h2><p>Chỉ lưu khi bạn đồng ý</p></div><span class="tag sand">'+pending.length+'</span></div><div class="mini-section">'+(pending.length?pending.map(m=>'<div class="suggestion"><strong>'+esc(m.title)+'</strong><p>'+esc(short(m.content,120))+'</p><small>Từ: '+esc(short(m.conversationTitle,50))+'</small><div class="suggestion-actions">'+button('Lưu','approve-memory','data-cid="'+esc(m.conversationId)+'" data-mid="'+esc(m.id)+'"','btn btn-soft btn-sm')+button('Bỏ qua','dismiss-memory','data-cid="'+esc(m.conversationId)+'" data-mid="'+esc(m.id)+'"','btn btn-quiet btn-sm')+'</div></div>').join(''):empty('✳','Chưa có gợi ý mới','Gợi ý xuất hiện khi bạn nhập cuộc trò chuyện có thông tin đáng nhớ.'))+'</div></section><section class="panel"><div class="panel-heading"><div><h2>Chủ đề nổi bật</h2><p>Phân bố từ nội dung đã lưu</p></div></div><div class="topic-list">'+(tops.length?tops.map(([n,c])=>'<div class="topic-row"><span>'+esc(n)+'</span><div class="topic-bar"><i style="width:'+Math.max(8,c/Math.max(1,tops[0][1])*100)+'%"></i></div><b>'+c+'</b></div>').join(''):'<p class="muted">Nhập hội thoại để tạo bản đồ chủ đề.</p>')+'</div></section></div></div>';
  }
  function renderConversations() {
    let list=state.conversations.filter(c=>matches(c));
    return heading('THƯ VIỆN HỘI THOẠI','Tư liệu đã lưu','Tìm lại ý tưởng, câu trả lời và quyết định từ các cuộc trò chuyện.',button('＋ Nhập hội thoại','import-chat','','btn btn-primary'))+
      '<div class="filter-line"><span class="pill-note">'+list.length+' hội thoại</span><span class="pill-note">Tìm kiếm trong cả nội dung</span></div><div class="library-list">'+(list.length?list.map(convCard).join(''):empty('⌕',state.q?'Không tìm thấy kết quả':'Chưa có hội thoại',state.q?'Thử từ khóa khác hoặc xóa bộ lọc.':'Nhập conversations.json hoặc file TXT/Markdown để bắt đầu.',button('Nhập dữ liệu','import-chat','','btn btn-primary')) )+'</div>';
  }
  function matches(item) {
    if(!state.q) return true;
    const hay=[item.title,item.content,item.analysis?.summary,item.source,...(item.messages||[]).map(m=>m.text),...(item.analysis?.topics||[]).map(t=>t.name)].join(' ').toLocaleLowerCase('vi');
    return hay.includes(state.q.toLocaleLowerCase('vi'));
  }
  function renderMemories() {
    const ms=state.memories.filter(m=>(state.category==='all'||m.category===state.category)&&matches(m));
    const cats=[['all','Tất cả'],['preference','Sở thích'],['study','Học tập'],['project','Dự án'],['goal','Mục tiêu'],['other','Khác']];
    return heading('KHO SỰ CÁ NHÂN','Bộ nhớ của bạn','Ghi nhớ chỉ được thêm sau khi bạn xác nhận. Sửa, ghim hoặc xóa bất kỳ lúc nào.',button('Xuất gói nhớ','copy-pack','','btn btn-outline')+button('＋ Thêm ghi nhớ','new-memory','','btn btn-primary'))+
      '<div class="filter-line">'+cats.map(c=>'<button class="filter-chip '+(state.category===c[0]?'active':'')+'" data-action="mem-filter" data-value="'+c[0]+'">'+c[1]+'</button>').join('')+'</div><div class="library-list">'+(ms.length?ms.map(m=>'<article class="memory-card"><div class="memory-symbol">'+(m.pinned?'◆':'✳')+'</div><div class="memory-body"><h3>'+esc(m.title)+'</h3><p>'+esc(m.content)+'</p><div class="meta">'+tag({name:({preference:'Sở thích',study:'Học tập',project:'Dự án',goal:'Mục tiêu'}[m.category]||'Khác'),category:m.category})+'<span>Cập nhật '+esc(date(m.updatedAt))+'</span></div><div class="card-actions">'+button(m.pinned?'Bỏ ghim':'Ghim','pin-memory','data-id="'+esc(m.id)+'"','btn btn-soft btn-sm')+button('Sửa','edit-memory','data-id="'+esc(m.id)+'"','btn btn-soft btn-sm')+button('Xóa','delete-memory','data-id="'+esc(m.id)+'"','btn btn-quiet btn-sm')+'</div></div></article>').join(''):empty('✳','Chưa có ghi nhớ','Có thể thêm thủ công hoặc duyệt những gợi ý được rút ra từ hội thoại.',button('Thêm ghi nhớ','new-memory','','btn btn-primary')) )+'</div>';
  }
  function renderTasks() {
    const tasks=state.tasks.filter(t=>(state.taskFilter==='all'||(state.taskFilter==='open'?!t.done:t.done))&&(state.q===''||matches(t)));
    return heading('TỪ Ý TƯỞNG ĐẾN HÀNH ĐỘNG','Việc cần làm','Các đề xuất trích xuất từ hội thoại phải được bạn duyệt trước khi vào danh sách.',button('＋ Thêm việc','new-task','','btn btn-primary'))+
      '<div class="filter-line">'+[['open','Đang mở'],['done','Đã xong'],['all','Tất cả']].map(c=>'<button class="filter-chip '+((state.taskFilter||'open')===c[0]?'active':'')+'" data-action="task-filter" data-value="'+c[0]+'">'+c[1]+'</button>').join('')+'</div><div class="task-list">'+(tasks.length?tasks.map(t=>'<article class="task-item '+(t.done?'done':'')+'"><button class="check-circle" data-action="toggle-task" data-id="'+esc(t.id)+'" aria-label="Đánh dấu hoàn thành">'+(t.done?'✓':'')+'</button><div class="task-copy"><strong>'+esc(t.title)+'</strong><small>'+(t.accepted?'Đã duyệt':'Đề xuất chờ duyệt')+(t.conversationTitle?' · '+esc(t.conversationTitle):'')+'</small></div><div class="task-actions">'+(!t.accepted?button('Duyệt','accept-task','data-id="'+esc(t.id)+'"','btn btn-primary btn-sm'):'')+button('Xóa','delete-task','data-id="'+esc(t.id)+'"','btn btn-quiet btn-sm')+'</div></article>').join(''):empty('↗','Không có việc nào','Gợi ý việc cần làm sẽ hiện ở đây sau khi bạn nhập hội thoại.'))+'</div>';
  }
  function renderDetail(c) {
    return heading('HỘI THOẠI','', '',button('← Quay lại','nav','','btn btn-outline')+button('Sao chép','copy-transcript','data-id="'+esc(c.id)+'"','btn btn-primary'))+
      '<section class="panel detail-panel"><div class="detail-title"><div class="eyebrow">'+esc(date(c.createdAt))+' · '+c.messages.length+' TIN NHẮN</div><h2>'+esc(c.title)+'</h2><div class="tag-row">'+(c.analysis?.topics||[]).map(tag).join('')+'</div><p>'+esc(c.analysis?.summary||'')+'</p></div><div class="transcript">'+(c.messages||[]).map(m=>'<article class="message '+esc(m.role)+'"><div class="message-role">'+(m.role==='assistant'?'TRỢ LÝ':m.role==='system'?'HỆ THỐNG':'BẠN')+'</div><div class="message-text">'+esc(m.text).replace(/\n/g,'<br>')+'</div></article>').join('')+'</div></section>';
  }
  function renderSettings() {
    return heading('KIỂM SOÁT DỮ LIỆU','Thiết lập & sao lưu','Dữ liệu được lưu trong IndexedDB của trình duyệt này. Hãy sao lưu trước khi xóa dữ liệu trình duyệt.', '')+
      '<div class="settings-grid"><section class="panel setting-panel"><div class="setting-icon">⇩</div><h2>Sao lưu dữ liệu</h2><p>Xuất cuộc trò chuyện, ghi nhớ và danh sách việc thành một file JSON do bạn giữ.</p>'+button('Tải bản sao lưu','export-backup','','btn btn-primary')+button('Xuất toàn bộ hội thoại Markdown','export-markdown','','btn btn-outline')+'</section><section class="panel setting-panel"><div class="setting-icon">⇧</div><h2>Khôi phục bản sao lưu</h2><p>Nhập file sao lưu JSON đã tạo trong Mạch Nhớ. Dữ liệu có cùng mã sẽ được cập nhật.</p><label class="btn btn-outline file-button">Chọn file sao lưu<input id="backupFile" type="file" accept=".json,application/json" hidden></label></section><section class="panel setting-panel"><div class="setting-icon">✳</div><h2>Gói nhớ cho ChatGPT</h2><p>Tạo phần tóm tắt các ghi nhớ đã chọn để dán vào cuộc trò chuyện mới.</p>'+button('Sao chép gói nhớ','copy-pack','','btn btn-primary')+button('Tạo prompt phân tích hội thoại','copy-prompt','','btn btn-outline')+'</section><section class="panel setting-panel danger-panel"><div class="setting-icon">!</div><h2>Xóa dữ liệu trên thiết bị này</h2><p>Thao tác không thể hoàn tác. Xuất bản sao lưu trước khi thực hiện.</p>'+button('Xóa toàn bộ dữ liệu','clear-all','','btn btn-danger')+'</section></div><section class="privacy-note"><h3>Quyền riêng tư & giới hạn</h3><p>Không có máy chủ và không tự gửi nội dung lên dịch vụ bên ngoài. Phân loại và tóm tắt mặc định dùng quy tắc tại máy, có thể bỏ sót ý nghĩa. Không nhập mật khẩu, thông tin ngân hàng hoặc dữ liệu bí mật. Bản sao lưu JSON không được mã hóa.</p><p>Mạch Nhớ không tự đọc lịch sử ChatGPT và không thay thế bộ nhớ nội bộ của ChatGPT. Để tiếp tục giữa các cuộc trò chuyện, hãy tải tệp ngữ cảnh dành cho ChatGPT rồi cập nhật tệp /Mạch Nhớ/Bộ nhớ làm việc.md trong ChatGPT Library. Ở cuộc trò chuyện mới, yêu cầu trợ lý “xem Mạch Nhớ”. Để AI phân tích sâu, hãy sao chép prompt và nội dung cần thiết rồi chủ động dán vào cuộc trò chuyện.</p></section>';
  }
  function render() {
    document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===state.page));
    $('#globalSearch').value=state.q;
    const c=state.conversations.find(x=>x.id===state.selected);
    let html=state.page==='home'?renderHome():state.page==='conversations'?renderConversations():state.page==='memories'?renderMemories():state.page==='tasks'?renderTasks():state.page==='detail'&&c?renderDetail(c):renderSettings();
    $('#view').innerHTML=html;
    const title={home:'Tổng quan',conversations:'Hội thoại',memories:'Ghi nhớ',tasks:'Việc cần làm',settings:'Thiết lập',detail:c?c.title:'Hội thoại'}[state.page]||'Mạch Nhớ';
    $('#breadcrumb').textContent=title;
  }
  async function importFiles(files) {
    if(!files || !files.length) return;
    $('#busy').classList.remove('hidden'); let added=0,dupes=0,errors=[];
    try {
      const existing=new Set(state.conversations.map(c=>c.fingerprint));
      for(const file of files) {
        try {
          const parsed=await readFile(file);
          if(parsed.backup) { await restoreBackup(parsed.backup); added++; continue; }
          for(const r of parsed.records) {
            const fp=await fingerprint(r.messages);
            if(existing.has(fp)) {dupes++;continue;}
            existing.add(fp);
            const c={id:uid(),title:short(r.title||'Hội thoại mới',150),createdAt:r.createdAt||now(),updatedAt:now(),source:r.source||file.name,fingerprint:fp,messages:r.messages.map(m=>({role:m.role==='assistant'?'assistant':m.role==='system'?'system':'user',text:clean(m.text),timestamp:m.timestamp||null})),analysis:null};
            c.analysis=makeAnalysis(c.messages);
            await put('conversations',c); added++;
            for(const t of c.analysis.taskCandidates) await put('tasks',{...t,conversationId:c.id,conversationTitle:c.title});
          }
        } catch(e) { errors.push(e.message||file.name); }
      }
      await refresh(); state.page='conversations'; state.q=''; render();
      toast('Đã nhập '+added+' mục'+(dupes?' · bỏ qua '+dupes+' bản trùng':'')+(errors.length?' · lỗi '+errors.length+' file':''),errors.length?'warn':'');
      if(errors.length) console.warn('Import issues:',errors);
    } finally { $('#busy').classList.add('hidden'); }
  }
  async function restoreBackup(data) {
    if(!data || data.appName!=='mach-nho-memory') throw new Error('Không phải bản sao lưu Mạch Nhớ.');
    for(const name of STORES) if(Array.isArray(data[name])) for(const item of data[name]) if(item && item.id) await put(name,item);
    await refresh();
  }
  function download(filename,text,type) {
    const blob=new Blob([text],{type:type||'text/plain;charset=utf-8'}), url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  async function clipboard(text) {
    if(navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();
    const ok=document.execCommand('copy');ta.remove();if(!ok) throw new Error('Không sao chép được. Hãy chọn và sao chép thủ công.');
  }
  function memoriesPack() {
    const m=state.memories;
    return 'GÓI GHI NHỚ CỦA TÔI — được tôi chọn lưu trong Mạch Nhớ\n\n'+(m.length?m.map((x,i)=>(i+1)+'. ['+({preference:'Sở thích',study:'Học tập',project:'Dự án',goal:'Mục tiêu'}[x.category]||'Khác')+'] '+x.content).join('\n'):'Chưa có ghi nhớ được chọn.')+'\n\nHãy coi đây là ngữ cảnh do người dùng cung cấp; nếu có điểm lỗi thời hoặc mâu thuẫn, hãy hỏi lại trước khi giả định.';
  }
  function analysisPrompt() {
    const c=state.conversations.find(x=>x.id===state.selected);
    const body=c?c.messages.map(m=>(m.role==='assistant'?'Trợ lý':m.role==='system'?'Hệ thống':'Người dùng')+': '+m.text).join('\n\n'):'';
    return 'Hãy phân tích cuộc trò chuyện dưới đây và trả về bằng tiếng Việt theo cấu trúc: (1) tóm tắt ngắn, (2) thông tin có khả năng hữu ích lâu dài, phân biệt sự kiện với suy luận, (3) sở thích/yêu cầu đã nói rõ, (4) quyết định và việc cần làm, (5) câu hỏi chưa giải quyết, (6) chi tiết nhạy cảm nên loại khỏi bộ nhớ. Không tự bịa; gắn mức độ chắc chắn và đề xuất nội dung để người dùng duyệt trước khi lưu.\n\n'+(body||'Dán nội dung hội thoại vào sau phần hướng dẫn này.');
  }
  async function exportBackup() {
    const data={appName:'mach-nho-memory',version:1,exportedAt:now(),conversations:state.conversations,memories:state.memories,tasks:state.tasks};
    download('mach-nho-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');
    toast('Đã tạo file sao lưu JSON.');
  }
  async function action(name,el) {
    const id=el.dataset.id, cid=el.dataset.cid, mid=el.dataset.mid;
    if(name==='nav') { state.page=state.page==='detail'?'conversations':'conversations'; state.selected=null; }
    else if(name==='open-conversation') {state.selected=id;state.page='detail';}
    else if(name==='import-chat') {$('#fileInput').click();return;}
    else if(name==='new-memory') {openEditor('memory');return;}
    else if(name==='new-task') {openEditor('task');return;}
    else if(name==='mem-filter') {state.category=el.dataset.value;render();return;}
    else if(name==='task-filter') {state.taskFilter=el.dataset.value;render();return;}
    else if(name==='approve-memory'||name==='dismiss-memory') {
      const c=state.conversations.find(x=>x.id===cid), m=(c?.analysis?.candidateMemories||[]).find(x=>x.id===mid);
      if(m && name==='approve-memory') await put('memories',{id:uid(),title:m.title,content:m.content,category:m.category,pinned:false,createdAt:now(),updatedAt:now(),sourceConversation:cid});
      if(m) {m.status='reviewed';c.updatedAt=now();await put('conversations',c);}
      await refresh();render();toast(name==='approve-memory'?'Đã lưu ghi nhớ.':'Đã bỏ qua gợi ý.');return;
    }
    else if(name==='edit-memory') {openEditor('memory',state.memories.find(x=>x.id===id));return;}
    else if(name==='pin-memory') {const m=state.memories.find(x=>x.id===id);if(m){m.pinned=!m.pinned;m.updatedAt=now();await put('memories',m);}}
    else if(name==='delete-memory') {if(confirm('Xóa ghi nhớ này?')) await del('memories',id);}
    else if(name==='accept-task') {const t=state.tasks.find(x=>x.id===id);if(t){t.accepted=true;await put('tasks',t);}}
    else if(name==='toggle-task') {const t=state.tasks.find(x=>x.id===id);if(t){if(!t.accepted)t.accepted=true;t.done=!t.done;await put('tasks',t);}}
    else if(name==='delete-task') {await del('tasks',id);}
    else if(name==='copy-pack') {await clipboard(memoriesPack());toast('Đã sao chép gói nhớ.');return;}
    else if(name==='copy-prompt') {await clipboard(analysisPrompt());toast('Đã sao chép prompt phân tích.');return;}
    else if(name==='copy-transcript') {const c=state.conversations.find(x=>x.id===id);if(c){await clipboard('# '+c.title+'\n\n'+c.messages.map(m=>(m.role==='assistant'?'Trợ lý':m.role==='system'?'Hệ thống':'Người dùng')+':\n'+m.text).join('\n\n'));toast('Đã sao chép hội thoại.');}return;}
    else if(name==='export-backup') {await exportBackup();return;}
    else if(name==='export-markdown') {download('mach-nho-hoi-thoai.md',state.conversations.map(c=>'# '+c.title+'\n\n'+date(c.createdAt)+'\n\n'+c.messages.map(m=>'**'+(m.role==='assistant'?'Trợ lý':m.role==='system'?'Hệ thống':'Người dùng')+'**\n\n'+m.text).join('\n\n')).join('\n\n---\n\n'));toast('Đã xuất Markdown.');return;}
    else if(name==='clear-all') {if(confirm('Xóa vĩnh viễn toàn bộ hội thoại, ghi nhớ và việc cần làm khỏi trình duyệt này? Nên sao lưu trước.')){for(const n of STORES)await clearStore(n);state.selected=null;state.page='home';state.q='';}}
    await refresh();render();
  }
  function openEditor(type,item) {
    const dialog=$('#editorDialog');
    $('#editorTitle').textContent=item?(type==='memory'?'Sửa ghi nhớ':'Sửa việc cần làm'):(type==='memory'?'Thêm ghi nhớ':'Thêm việc cần làm');
    $('#editorKind').value=type;$('#editorId').value=item?.id||'';
    $('#editorName').value=item?.title||'';$('#editorContent').value=item?.content||'';
    $('#editorCategory').value=item?.category||'preference';
    $('#editorContentWrap').classList.toggle('hidden',type!=='memory');
    $('#editorCategoryWrap').classList.toggle('hidden',type!=='memory');
    dialog.showModal();$('#editorName').focus();
  }
  $('#editorForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const type=$('#editorKind').value,id=$('#editorId').value,title=clean($('#editorName').value),content=clean($('#editorContent').value);
    if(!title || (type==='memory'&&!content)) return;
    if(type==='memory') {
      const old=state.memories.find(m=>m.id===id);
      await put('memories',{id:id||uid(),title,content,category:$('#editorCategory').value,pinned:old?.pinned||false,createdAt:old?.createdAt||now(),updatedAt:now()});
      state.page='memories';
    } else {
      await put('tasks',{id:id||uid(),title,accepted:true,done:false,createdAt:now()});state.page='tasks';
    }
    $('#editorDialog').close();await refresh();render();toast('Đã lưu.');
  });
  $('#fileInput').addEventListener('change',e=>importFiles([...e.target.files]).finally(()=>e.target.value=''));
  $('#backupFile').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    try{const data=JSON.parse(await f.text());await restoreBackup(data);state.page='home';render();toast('Đã khôi phục bản sao lưu.');}
    catch(err){toast(err.message||'Không thể khôi phục file.','error');}
    e.target.value='';
  });
  $('#globalSearch').addEventListener('input',e=>{state.q=clean(e.target.value);if(state.page==='detail')state.page='conversations';render();});
  document.addEventListener('click',e=>{
    const nav=e.target.closest('[data-nav]');
    if(nav){state.page=nav.dataset.nav;state.selected=null;state.q='';render();return;}
    const el=e.target.closest('[data-action]');if(!el)return;
    action(el.dataset.action,el).catch(err=>{console.error(err);toast(err.message||'Có lỗi xảy ra.','error');});
  });
  document.addEventListener('keydown',e=>{
    const card=e.target.closest('[data-action="open-conversation"]');
    if(card && (e.key==='Enter'||e.key===' ')){e.preventDefault();action('open-conversation',card);}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#globalSearch').focus();}
  });
  const drop=$('#dropzone');
  ['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('drag');}));
  ['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('drag');}));
  drop.addEventListener('drop',e=>importFiles([...e.dataTransfer.files]));
  $('#installHelp').addEventListener('click',()=>$('#importHelp').showModal());
  async function init() {
    try {db=await openDB();await refresh();render();}
    catch(e){toast('Không mở được kho dữ liệu. Hãy dùng trình duyệt hiện đại và bật lưu trữ trang. '+e.message,'error');}
    if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
  init();
})();
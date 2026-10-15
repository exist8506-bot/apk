'use strict';
(function () {
  const DB_NAME = 'mach-nho-memory';
  const STORE_NAMES = ['conversations', 'memories', 'tasks'];
  const SECRET = /(mật khẩu|password|api[_ -]?key|access[_ -]?token|refresh[_ -]?token|private key|seed phrase|mnemonic phrase|số thẻ|cvv|cccd|căn cước|chứng minh nhân dân)/i;
  const $ = (s, root=document) => root.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = (v) => {
    const d = v ? new Date(v) : new Date();
    return isNaN(d) ? 'Chưa rõ ngày' : new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'short',year:'numeric'}).format(d);
  };
  function toast(message, error=false) {
    const el=$('#toast');
    if (!el) { window.alert(message); return; }
    el.textContent=message;
    el.className='toast show'+(error?' error':'');
    window.clearTimeout(toast.timer);
    toast.timer=window.setTimeout(()=>{el.className='toast';},4500);
  }
  function openDB() {
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{
        STORE_NAMES.forEach(name=>{
          if(!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name,{keyPath:'id'});
        });
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('Không mở được kho Mạch Nhớ.'));
    });
  }
  function readAll(db,name) {
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(name,'readonly');
      const req=tx.objectStore(name).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error||new Error('Không đọc được dữ liệu '+name));
    });
  }
  function download(text) {
    const blob=new Blob([text],{type:'text/markdown;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='mach-nho-bo-nho-chatgpt.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  function makeDocument(conversations,memories,tasks) {
    const safeMemories=memories.filter(m=>!SECRET.test(String(m.title||'')+'\n'+String(m.content||'')));
    const openTasks=tasks.filter(t=>t.accepted&&!t.done&&!SECRET.test(String(t.title||'')));
    const recent=conversations.slice().sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,30);
    const lines=[
      '# Mạch Nhớ — Tệp ngữ cảnh cho ChatGPT',
      '',
      '> Bản xuất: '+new Date().toLocaleString('vi-VN')+'. Đây là ảnh chụp ngữ cảnh đã lưu trong ứng dụng, không phải bản ghi toàn bộ hội thoại.',
      '',
      '## Hướng dẫn cho trợ lý',
      '',
      '- Khi câu hỏi liên quan đến công việc cũ, hãy tìm trong tệp này trước khi yêu cầu người dùng nhắc lại.',
      '- Phân biệt sự kiện đã xác nhận, suy luận và thông tin cần kiểm tra; không giả vờ nhớ nguyên văn nội dung không có trong tệp.',
      '- Với dữ liệu học thuật, ưu tiên đề gốc, ảnh và lời chữa của giảng viên. Đối chiếu công thức, dấu, đơn vị và phép tính.',
      '- Khi kết thúc một cuộc trò chuyện dài, nếu người dùng yêu cầu cập nhật, ghi lại kết luận, quyết định, trạng thái, việc tiếp theo và câu hỏi còn mở.',
      '- Không lưu mật khẩu, token, thông tin thanh toán hoặc dữ liệu cực kỳ nhạy cảm.',
      '- Đây là bộ nhớ ngoài do người dùng quản lý, không phải bộ nhớ nội bộ của ChatGPT. Chỉ dùng dữ liệu được cung cấp và hỏi lại khi chưa chắc.',
      '',
      '## Cách làm việc ổn định',
      '',
      '- Giữ đủ các ý quan trọng, công thức và cách diễn giải; không rút gọn đến mức mất ý.',
      '- Với bài tập, trình bày theo thứ tự: dữ liệu đề bài, công thức, thay số/tính toán, kết quả, ý nghĩa và kết luận.',
      '- Khi rà lại bài, kiểm tra công thức, dấu, đơn vị, tỷ lệ phần trăm và tính nhất quán.',
      '- Khi chép lời từ ảnh/âm thanh, không đoán phần không rõ; ưu tiên đề gốc và lời chữa của giảng viên.',
      '',
      '## Ngữ cảnh nền đã có từ lần thiết lập',
      '',
      '### Môn Phân tích hoạt động kinh doanh',
      '',
      '- Các nội dung đang ôn: so sánh thay thế liên hoàn, số chênh lệch và liên hệ cân đối; bài mẫu phương pháp cân đối; phân tích doanh thu; phân tích mức hạ giá thành.',
      '- Với phương pháp cân đối, xác định quan hệ giữa các chỉ tiêu, tính ảnh hưởng từng nhân tố và kiểm tra tổng ảnh hưởng có khớp biến động chung.',
      '- Một trao đổi ghi nhận doanh thu thuần tăng 13,8 tỷ đồng (11,75%) và các ký hiệu M_H, f_H trong bài mức hạ giá thành; đối chiếu đề gốc trước khi dùng như số liệu chính thức.',
      '',
      '### Dự án Mạch Nhớ',
      '',
      '- Repo: https://github.com/exist8506-bot/apk ; ứng dụng web này là bộ nhớ hội thoại bên ngoài.',
      '- Dữ liệu trong app nằm trong trình duyệt; để ChatGPT dùng ở phiên mới, xuất tệp ngữ cảnh và đưa tệp đó vào ChatGPT Library hoặc đính kèm.',
      '- Phân loại/tóm tắt mặc định là quy tắc tại máy, không phải AI. Không đưa hội thoại riêng tư vào repo GitHub công khai.',
      '',
      '## Ghi nhớ đã được người dùng chọn',
      ''
    ];
    lines.push(safeMemories.length ? safeMemories.map((m,i)=>(i+1)+'. **'+(m.title||'Ghi nhớ')+'** ['+(({preference:'Sở thích',study:'Học tập',project:'Dự án',goal:'Mục tiêu'}[m.category])||'Khác')+']\n   '+String(m.content||'').replace(/\n/g,'\n   ')).join('\n') : '_Chưa có ghi nhớ nào được duyệt trong ứng dụng._');
    lines.push('', '## Việc đang mở đã được duyệt', '');
    lines.push(openTasks.length ? openTasks.map((t,i)=>(i+1)+'. '+t.title+(t.conversationTitle?' — nguồn: '+t.conversationTitle:'')).join('\n') : '_Chưa có việc đang mở đã được duyệt._');
    lines.push('', '## Chỉ mục hội thoại gần đây', '', 'Các tóm tắt dưới đây được ứng dụng tạo bằng quy tắc cục bộ nên có thể thiếu ngữ cảnh. Mở lại hội thoại gốc khi cần số liệu hoặc chứng cứ chính xác.', '');
    lines.push(recent.length ? recent.map((c,i)=>{
      const summary=String(c.analysis&&c.analysis.summary||'').trim();
      const safeSummary=SECRET.test(summary)?'[Đã ẩn tóm tắt vì có thể chứa dữ liệu nhạy cảm.]':summary;
      const topics=(c.analysis&&c.analysis.topics||[]).map(t=>t.name).filter(Boolean).join(', ');
      return '### '+(i+1)+'. '+String(c.title||'Hội thoại chưa đặt tên')+'\n- Ngày: '+date(c.updatedAt||c.createdAt)+'\n- Tin nhắn: '+((c.messages||[]).length)+'\n- Chủ đề: '+(topics||'Chưa phân loại')+'\n- Tóm tắt: '+(safeSummary||'Chưa có tóm tắt');
    }).join('\n\n') : '_Chưa có hội thoại nào được nhập._');
    lines.push('', '## Cách cập nhật tệp này', '', 'Sau khi thêm dữ liệu trong Mạch Nhớ, hãy xuất lại tệp này rồi đưa bản mới vào ChatGPT Library. Có thể lưu tại /Mạch Nhớ/Bộ nhớ làm việc.md; nếu thay bản cũ, cần giữ lại những ghi chú thủ công quan trọng. Khi tiếp tục trong cuộc trò chuyện khác, người dùng có thể yêu cầu trợ lý “xem Mạch Nhớ”.');
    return lines.join('\n');
  }
  async function exportMemory() {
    const button=$('[data-memory-bridge-export]');
    if(button) { button.disabled=true; button.textContent='Đang tạo tệp…'; }
    try {
      const db=await openDB();
      const [conversations,memories,tasks]=await Promise.all(STORE_NAMES.map(name=>readAll(db,name)));
      db.close();
      download(makeDocument(conversations,memories,tasks));
      toast('Đã tải tệp ngữ cảnh. Đưa tệp này vào ChatGPT Library để dùng ở cuộc trò chuyện khác.');
    } catch(err) {
      toast(err&&err.message||'Không xuất được tệp ngữ cảnh.',true);
    } finally {
      if(button) { button.disabled=false; button.textContent='Tải tệp ngữ cảnh ChatGPT'; }
    }
  }
  function makeButton(container) {
    if(!container||$('[data-memory-bridge-export]',container)) return;
    const b=document.createElement('button');
    b.type='button';
    b.className='btn btn-outline';
    b.dataset.memoryBridgeExport='true';
    b.textContent='Tải tệp ngữ cảnh ChatGPT';
    container.prepend(b);
  }
  function injectControls() {
    const view=$('#view');
    if(!view) return;
    makeButton($('.page-head .head-actions',view));
    const cards=[...view.querySelectorAll('.setting-panel')];
    const chatCard=cards.find(c=>(($('h2',c)||{}).textContent||'').includes('ChatGPT'));
    if(chatCard) {
      const p=$('p',chatCard);
      if(p&&!$('[data-memory-bridge-export]',chatCard)) {
        const b=document.createElement('button');
        b.type='button';
        b.className='btn btn-primary';
        b.dataset.memoryBridgeExport='true';
        b.textContent='Tải tệp ngữ cảnh ChatGPT';
        p.insertAdjacentElement('afterend',b);
      }
    }
  }
  document.addEventListener('click',e=>{
    const b=e.target&&e.target.closest&&e.target.closest('[data-memory-bridge-export]');
    if(!b) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    exportMemory();
  },true);
  const init=()=>{
    const root=$('#view');
    if(root) new MutationObserver(injectControls).observe(root,{childList:true,subtree:true});
    injectControls();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
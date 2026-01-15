const App = {
    currentFilter: 'all',
    transFilterType: 'all',
    transSortMode: 'date-desc',
    bookingStatus: 'pending',

    init() {
        console.log('App Init Start');
        try {
            DB.init(); 
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('open'));
            const loginBtn = document.getElementById('btn-login-action');
            if(loginBtn) loginBtn.onclick = App.login;
            const passInput = document.getElementById('login-pass');
            if(passInput) passInput.addEventListener('keypress', e => { if (e.key === 'Enter') App.login(); });
            if(localStorage.getItem('konok_theme') === 'light') { document.body.classList.add('light-theme'); const ts=document.getElementById('theme-status'); if(ts)ts.innerText='Light'; }
            if(localStorage.getItem('konok_auth_token')) { window.currentUserRole = localStorage.getItem('konok_auth_token'); const userDisplay = document.getElementById('dash-username-display'); if(userDisplay) userDisplay.innerText = window.currentUserRole === 'admin' ? 'Admin' : 'Agent'; Router.go('screen-dashboard'); }
            document.querySelectorAll('.closable-modal').forEach(m => { m.addEventListener('click', (e) => { if(e.target === m) App.closeModal(m.id); }); });
        } catch (e) { console.error('Init Error:', e); alert('Ошибка запуска: ' + e.message); }
    },

    notify(msg) { const c = document.getElementById('toast-container'); if(!c) return; const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg; c.appendChild(t); setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(), 300); }, 3000); },
    hardReset() { const pass = prompt("СБРОС СИСТЕМЫ\n\nВсе данные будут удалены.\nВведите пароль (123):"); if (pass === '123') { DB.clear(); alert("Система сброшена."); location.reload(); } else { alert("Неверный пароль."); } },

    makeDeposit(){ 
        const amt = +document.getElementById('deposit-amount').value; 
        const id = window.depositGuideId; 
        if(amt > 0 && id) { 
            const staffList = DB.load(DB.KEYS.STAFF);
            const s = staffList.find(x => x.id == id);
            if(s) {
                s.balance -= amt; 
                DB.save(DB.KEYS.STAFF, staffList); 
                document.getElementById('modal-deposit').classList.remove('open'); 
                View.renderCashPage(); 
                View.renderStaff(); 
                App.notify(`Принято ${amt} с`);
            }
        } else { App.notify('Введите сумму'); }
    },

    goToTour(id) { 
        console.log('Going to tour:', id);
        try {
            window.currentTourId = id; 
            const tours = DB.load(DB.KEYS.TOURS);
            let t = tours.find(x => x.id == id);
            if(t) {
                let modified = false;
                if (!t.seats || !Array.isArray(t.seats) || t.seats.length === 0) { const staff = DB.load(DB.KEYS.STAFF).find(s => s.id == t.driverId); const cap = staff ? staff.capacity : 18; t.seats = Array(cap).fill({status:'free'}); modified = true; }
                if (!t.expenses) { t.expenses = { driver:0, guide:0, other:0, otherDesc:'', vipList:[] }; modified = true; }
                if (!t.destinations || t.destinations.length === 0) { t.destinations = ['Маршрут']; modified = true; }
                if (modified) DB.save(DB.KEYS.TOURS, tours);
                View.renderDetails(t); 
                Router.go('screen-details'); 
            } else { App.notify('Ошибка: Тур не найден в базе'); }
        } catch (e) { console.error(e); alert('Критическая ошибка при открытии тура: ' + e.message); }
    },

    toggleFab() { 
        const fab = document.getElementById('fab-menu'); 
        if(fab) fab.style.display = fab.style.display === 'flex' ? 'none' : 'flex'; 
    },
    
    setPayStatus(status) {
        this.bookingStatus = status;
        ['pending', 'partial', 'taken'].forEach(s => {
            const btn = document.getElementById(`st-${s}`);
            if(btn) {
                if (s === status) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });
    },

    changeSeatCount(delta) {
        const el = document.getElementById('book-count');
        let val = parseInt(el.innerText) || 1;
        val += delta;
        if (val < 1) val = 1;
        el.innerText = val;
    },

    saveBooking() { 
        try {
            const tours = DB.load(DB.KEYS.TOURS); 
            const t = tours.find(x => x.id == window.currentTourId); 
            const name = document.getElementById('book-name').value; 
            const phone = document.getElementById('book-phone').value; 
            const method = document.getElementById('book-method').value; 
            const isGift = document.getElementById('book-is-gift').checked; 
            const count = parseInt(document.getElementById('book-count').innerText);

            if(!name) { App.notify('Введите имя'); return; }

            if (t.seats[window.currentSeatIndex].status !== 'free') { 
                t.seats[window.currentSeatIndex] = { status: this.bookingStatus, name, phone, method, isGift }; 
            } else {
                let availableCount = 0;
                for(let i = window.currentSeatIndex; i < t.seats.length; i++) {
                    if(t.seats[i].status === 'free') availableCount++;
                    if(availableCount >= count) break;
                }
                if(availableCount < count) { App.notify(`Мало мест! Подряд свободно: ${availableCount}`); return; }
                let needed = count;
                for(let i = window.currentSeatIndex; i < t.seats.length; i++) {
                    if(t.seats[i].status === 'free' && needed > 0) {
                        const displayName = count > 1 ? `${name} (${count - needed + 1})` : name;
                        t.seats[i] = { status: this.bookingStatus, name: displayName, phone, method, isGift }; 
                        needed--;
                    }
                }
            }
            DB.save(DB.KEYS.TOURS, tours); 
            App.closeModal('modal-booking'); 
            View.renderDetails(t); 
            App.notify('Бронь сохранена');
        } catch (e) { console.error(e); App.notify('Ошибка сохранения'); }
    },

    openBookingModal(idx, s) { 
        window.currentSeatIndex = idx; 
        const t = DB.load(DB.KEYS.TOURS).find(x=>x.id==window.currentTourId);
        if(!t) return;
        if(idx === null) { const freeIdx = t.seats.findIndex(st => st.status === 'free'); if(freeIdx === -1) { App.notify('Нет мест!'); return; } window.currentSeatIndex = freeIdx; s = t.seats[freeIdx]; }
        s = s || { name:'', phone:'', status:'free', method:'cash', isGift: false };
        document.getElementById('modal-booking-title').innerText = s.status === 'free' ? 'НОВАЯ БРОНЬ' : 'РЕДАКТИРОВАНИЕ';
        document.getElementById('book-name').value = s.name || ''; 
        document.getElementById('book-phone').value = s.phone || ''; 
        document.getElementById('book-method').value = s.method || 'cash'; 
        document.getElementById('book-is-gift').checked = s.isGift || false; 
        document.getElementById('book-count').innerText = "1";
        const initialStatus = s.status === 'free' ? 'pending' : s.status;
        this.setPayStatus(initialStatus);
        document.getElementById('btn-cancel-booking').style.display = s.status!=='free' ? 'block' : 'none'; 
        document.getElementById('modal-booking').classList.add('open'); 
    },

    cancelBooking() { if(!confirm('Освободить это место?')) return; const tours = DB.load(DB.KEYS.TOURS); const t = tours.find(x=>x.id==window.currentTourId); t.seats[window.currentSeatIndex] = {status:'free'}; DB.save(DB.KEYS.TOURS, tours); App.closeModal('modal-booking'); View.renderDetails(t); },
    openQuickBookModal() { View.renderQuickBookList(); document.getElementById('modal-quick-book').classList.add('open'); this.toggleFab(); },
    saveQuickBook(tourId) { try { const name = document.getElementById(`qb-name-${tourId}`).value; const phone = document.getElementById(`qb-phone-${tourId}`).value; const method = document.getElementById(`qb-method-${tourId}`).value; if(!name) { App.notify('Введите имя'); return; } const tours = DB.load(DB.KEYS.TOURS); const t = tours.find(x => x.id == tourId); const freeIdx = t.seats.findIndex(s => s.status === 'free'); if(freeIdx === -1) { App.notify('Нет свободных мест!'); return; } t.seats[freeIdx] = { status: 'pending', name, phone, method, isGift: false }; DB.save(DB.KEYS.TOURS, tours); App.notify('Пассажир записан!'); View.renderQuickBookList(); } catch (e) { console.error(e); } },
    deleteCurrentTour() { if(!confirm('Удалить этот тур?')) return; let tours = DB.load(DB.KEYS.TOURS); tours = tours.filter(t => t.id != window.currentTourId); DB.save(DB.KEYS.TOURS, tours); Router.go('screen-tours'); App.notify('Тур удален'); },
    openEmployeeModal(id) { window.editingStaffId = id || null; ['emp-name','emp-phone','emp-commission'].forEach(fid => { const el = document.getElementById(fid); if(el) el.value = ''; }); const roleEl = document.getElementById('emp-role'); if(roleEl) roleEl.value = 'driver'; const capEl = document.getElementById('emp-capacity'); if(capEl) capEl.value = 18; if(id) { const s = DB.load(DB.KEYS.STAFF).find(x => x.id == id); if(s) { if(document.getElementById('emp-name')) document.getElementById('emp-name').value = s.name; if(document.getElementById('emp-phone')) document.getElementById('emp-phone').value = s.phone; if(document.getElementById('emp-role')) document.getElementById('emp-role').value = s.role; if(document.getElementById('emp-capacity')) document.getElementById('emp-capacity').value = s.capacity || 18; if(document.getElementById('emp-commission')) document.getElementById('emp-commission').value = s.commission || 0; } } App.toggleCapacityField(); document.getElementById('modal-employee').classList.add('open'); document.getElementById('fab-menu').style.display='none'; },
    saveEmployee() { const n = document.getElementById('emp-name').value; const p = document.getElementById('emp-phone').value; const r = document.getElementById('emp-role').value; const c = +document.getElementById('emp-capacity').value; const cm = +document.getElementById('emp-commission').value; if(!n) { App.notify('Введите имя'); return; } const l = DB.load(DB.KEYS.STAFF); if(window.editingStaffId) { const idx = l.findIndex(x => x.id == window.editingStaffId); if(idx > -1) { l[idx].name = n; l[idx].phone = p; l[idx].role = r; l[idx].capacity = c; l[idx].commission = cm; } } else { l.push({ id: Date.now(), name: n, phone: p, role: r, capacity: c, commission: cm, balance: 0 }); } DB.save(DB.KEYS.STAFF, l); App.closeModal('modal-employee'); View.renderStaff(); App.notify('Сотрудник сохранен'); },
    deleteStaff(id) { if(!confirm('Удалить сотрудника?')) return; let staff = DB.load(DB.KEYS.STAFF); staff = staff.filter(s => s.id !== id); DB.save(DB.KEYS.STAFF, staff); View.renderStaff(); App.notify('Сотрудник удален'); },
    toggleVipMode() { const cb = document.getElementById('is-vip-tour'); const isVip = cb ? cb.checked : false; const vipBlock = document.getElementById('vip-options-block'); const stdBlock = document.getElementById('std-options-block'); if(vipBlock) vipBlock.style.display = isVip ? 'block' : 'none'; if(stdBlock) stdBlock.style.display = isVip ? 'none' : 'block'; },
    toggleRecurring() { const cb = document.getElementById('is-recurring'); const isRec = cb ? cb.checked : false; const blk = document.getElementById('recurring-days-block'); if(blk) blk.style.display = isRec ? 'flex' : 'none'; },
    addVipItem() { const container = document.getElementById('vip-items-container'); if(!container) return; const div = document.createElement('div'); div.className = 'vip-row'; div.innerHTML = `<input type="text" class="vip-name" placeholder="Услуга"><input type="number" class="vip-cost" placeholder="Цена"><button class="btn-text" onclick="this.parentElement.remove()" style="color:red">x</button>`; container.appendChild(div); },
    toggleNewPointInput() { const div = document.getElementById('new-point-custom-div'); if(!div) return; const isHidden = div.style.display === 'none'; div.style.display = isHidden ? 'block' : 'none'; if(isHidden) setTimeout(()=>document.getElementById('new-tour-point-custom').focus(), 100); },
    openDateSelector() { View.renderCalendar(true); document.getElementById('modal-calendar').classList.add('open'); },
    selectDateForTour(dateStr) { document.getElementById('new-tour-date-display').value = dateStr; App.closeModal('modal-calendar'); },
    prepareCreateTour(d='') { window.editingTourId = null; const vipToggle = document.getElementById('is-vip-tour'); if(vipToggle) vipToggle.checked = false; App.toggleVipMode(); const recToggle = document.getElementById('is-recurring'); if(recToggle) recToggle.checked = false; App.toggleRecurring(); if(document.getElementById('recurring-block')) document.getElementById('recurring-block').style.display = 'flex'; const inputIds = [ 'new-tour-price', 'new-tour-driver', 'new-tour-guide', 'fee-driver', 'fee-guide', 'fee-other', 'fee-other-desc', 'new-tour-point-custom', 'new-tour-duration' ]; inputIds.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; }); const dateDisplay = document.getElementById('new-tour-date-display'); if(dateDisplay) dateDisplay.value = d || ''; const multiDay = document.getElementById('is-multiday'); if(multiDay) multiDay.checked = false; App.toggleDuration(); const destWrapper = document.getElementById('destinations-wrapper'); if(destWrapper) { destWrapper.innerHTML = ''; App.addDestInput(); } const recCheckboxes = document.querySelectorAll('input[name="rec-day"]'); recCheckboxes.forEach(c => c.checked = false); const customPointDiv = document.getElementById('new-point-custom-div'); if(customPointDiv) customPointDiv.style.display = 'none'; View.renderTimeOptions(); View.renderStaffOptions(); View.renderPointOptions(); Router.go('screen-add-tour'); const fab = document.getElementById('fab-menu'); if(fab) fab.style.display='none'; },
    toggleDuration(){ const cb = document.getElementById('is-multiday'); const blk = document.getElementById('duration-block'); if(cb && blk) blk.style.display = cb.checked ? 'block' : 'none'; },
    onDriverChange(){ const el = document.getElementById('new-tour-driver'); if(!el) return; const id = el.value; const s = DB.load(DB.KEYS.STAFF).find(x => x.id == id); const capEl = document.getElementById('new-tour-capacity'); if(s && capEl) capEl.value = s.capacity; },
    addDestInput(){ const w = document.getElementById('destinations-wrapper'); if(!w) return; const div = document.createElement('div'); const s = document.createElement('select'); s.className = 'dest-select wireframe-input'; s.innerHTML = '<option value="">Выбрать</option>'; DB.load(DB.KEYS.DESTS).forEach(d => { const o = document.createElement('option'); o.value = d.name; o.innerText = d.name; s.appendChild(o); }); div.appendChild(s); w.appendChild(div); },
    editCurrentTour() { const t=DB.load(DB.KEYS.TOURS).find(x=>x.id==window.currentTourId); if(!t)return; window.editingTourId=t.id; const isVip = t.type === 'vip'; const vipToggle = document.getElementById('is-vip-tour'); if(vipToggle) vipToggle.checked = isVip; App.toggleVipMode(); document.getElementById('recurring-block').style.display = 'none'; document.getElementById('destinations-wrapper').innerHTML=''; t.destinations.forEach(d=>{const w=document.createElement('div');const s=document.createElement('select');s.className='dest-select wireframe-input';DB.load(DB.KEYS.DESTS).forEach(o=>{const op=document.createElement('option');op.value=o.name;op.innerText=o.name;if(o.name===d)op.selected=true;s.appendChild(op)});w.appendChild(s);document.getElementById('destinations-wrapper').appendChild(w)}); if(document.getElementById('new-tour-date-display')) document.getElementById('new-tour-date-display').value = t.date.slice(0,10); if(document.getElementById('new-tour-price')) document.getElementById('new-tour-price').value = t.price; if(t.expenses) { if(document.getElementById('fee-driver')) document.getElementById('fee-driver').value = t.expenses.driver || ''; if(document.getElementById('fee-guide')) document.getElementById('fee-guide').value = t.expenses.guide || ''; if(document.getElementById('fee-other')) document.getElementById('fee-other').value = t.expenses.other || ''; if(document.getElementById('fee-other-desc')) document.getElementById('fee-other-desc').value = t.expenses.otherDesc || ''; } View.renderStaffOptions(); View.renderPointOptions(); const sel = document.getElementById('new-tour-point-select'); const points = DB.load(DB.KEYS.POINTS)||[]; if (sel) { if (points.includes(t.meetingPoint)) { sel.value = t.meetingPoint; if(document.getElementById('new-point-custom-div')) document.getElementById('new-point-custom-div').style.display='none'; } else { sel.value = 'Выбрать'; App.toggleNewPointInput(); if(document.getElementById('new-tour-point-custom')) document.getElementById('new-tour-point-custom').value = t.meetingPoint; } } if(document.getElementById('new-tour-driver')) document.getElementById('new-tour-driver').value = t.driverId || ''; if(document.getElementById('new-tour-guide')) document.getElementById('new-tour-guide').value = t.guideId || ''; Router.go('screen-add-tour'); },
    openDestModal(id) { window.editingDestId = id; const n = document.getElementById('new-dest-name'); const d = document.getElementById('new-dest-desc'); if(n && d) { if(id) { const dest = DB.load(DB.KEYS.DESTS).find(x => x.id == id); n.value = dest.name; d.value = dest.desc; } else { n.value = ''; d.value = ''; } } const typeSel = document.getElementById('new-dest-type'); if(typeSel) typeSel.value = (id && DB.load(DB.KEYS.DESTS).find(x => x.id == id).type) || 'one_day'; document.getElementById('modal-destinations').classList.add('open'); document.getElementById('fab-menu').style.display='none'; },
    addDestinationToDb() { const n = document.getElementById('new-dest-name').value; const d = document.getElementById('new-dest-desc').value; const type = document.getElementById('new-dest-type').value; if(n) { const l = DB.load(DB.KEYS.DESTS); if(window.editingDestId) { Object.assign(l.find(x => x.id == window.editingDestId), {name:n, desc:d, type:type}); } else { l.push({id:Date.now(), name:n, desc:d, type:type}); } DB.save(DB.KEYS.DESTS, l); App.closeModal('modal-destinations'); View.renderLocations(); } },
    toggleCapacityField(){ const r=document.getElementById('emp-role').value; document.getElementById('emp-extra-fields').style.display = (r==='driver' || r==='agent')?'block':'none'; document.getElementById('emp-commission').style.display = r==='agent'?'block':'none'; document.getElementById('emp-capacity').style.display = r==='driver'?'block':'none'; },
    openCalendarModal() { View.renderCalendar(); document.getElementById('modal-calendar').classList.add('open'); },
    openDepositModal(id){ window.depositGuideId=id; document.getElementById('deposit-amount').value=''; document.getElementById('modal-deposit').classList.add('open'); },
    generateManifest(){ alert('Скопировано'); },
    openWaModal(){ const t = DB.load(DB.KEYS.TOURS).find(x=>x.id==window.currentTourId); if(!t) return; const txt = `Здравствуйте! 👋\n\nВы записаны на тур: *${t.destinations[0]}*\n📅 Дата: ${View.formatDate(t.date)}\n📍 Сбор: ${t.meetingPoint || 'Уточняется'}\n💰 К оплате: ${t.price} сом\n\nЕсли возникнут вопросы — мы на связи! 😊`; document.getElementById('wa-text-area').value = txt; document.getElementById('modal-whatsapp').classList.add('open'); },
    copyWaText(){ document.getElementById('wa-text-area').select(); document.execCommand('copy'); alert('Текст скопирован'); },
    openNotifications(){View.renderNotifications(); document.getElementById('modal-notifications').classList.add('open')},
    saveTour() { try { const price = +document.getElementById('new-tour-price').value; const driverId = document.getElementById('new-tour-driver').value; const guideId = document.getElementById('new-tour-guide').value; const dateVal = document.getElementById('new-tour-date-display').value; const timeVal = document.getElementById('new-tour-time-picker').value; const dests = Array.from(document.querySelectorAll('.dest-select')).map(s=>s.value).filter(v=>v); const isVip = document.getElementById('is-vip-tour').checked; const otherDesc = document.getElementById('fee-other-desc').value; let meetingPoint = document.getElementById('new-tour-point-select').value; const customPoint = document.getElementById('new-tour-point-custom').value; if (customPoint) { meetingPoint = customPoint; const points = DB.load(DB.KEYS.POINTS) || []; if (!points.includes(customPoint)) { points.push(customPoint); DB.save(DB.KEYS.POINTS, points); } } if (!dests.length || !dateVal || !price || !driverId || !guideId || (!meetingPoint || meetingPoint === 'Выбрать')) { App.notify('Заполните все обязательные поля'); return; } let expenses = { driver: +document.getElementById('fee-driver').value||0, guide: +document.getElementById('fee-guide').value||0, other: +document.getElementById('fee-other').value||0, otherDesc: otherDesc, vipList: [] }; if (isVip) { document.querySelectorAll('.vip-row').forEach(row => { const name = row.querySelector('.vip-name').value; const cost = +row.querySelector('.vip-cost').value; if(name && cost) expenses.vipList.push({name, cost}); }); expenses.other = 0; } const isMulti = document.getElementById('is-multiday').checked; const duration = isMulti ? (+document.getElementById('new-tour-duration').value || 1) : 1; const capacity = +document.getElementById('new-tour-capacity').value || 18; const createTourObj = (dateStr) => ({ id: Date.now() + Math.random(), type: isVip ? 'vip' : 'std', destinations: dests, date: `${dateStr} ${timeVal}`, price: price, duration: duration, meetingPoint: meetingPoint, driverId: driverId, guideId: guideId, expenses: expenses, seats: Array(capacity).fill({ status: 'free' }) }); const tours = DB.load(DB.KEYS.TOURS); if (window.editingTourId) { const idx = tours.findIndex(t => t.id == window.editingTourId); if (idx > -1) { const oldSeats = tours[idx].seats; const newTour = createTourObj(dateVal); if (oldSeats && oldSeats.length === capacity) newTour.seats = oldSeats; else if (oldSeats) { newTour.seats = Array(capacity).fill({status:'free'}); oldSeats.forEach((s, i) => { if(i < capacity) newTour.seats[i] = s; }); } newTour.id = window.editingTourId; tours[idx] = newTour; App.notify('Тур обновлен'); } } else { const isRec = document.getElementById('is-recurring').checked; if (isRec) { const daysChecked = Array.from(document.querySelectorAll('input[name="rec-day"]:checked')).map(cb => +cb.value); if (daysChecked.length === 0) { App.notify('Выберите дни недели'); return; } const startDate = new Date(dateVal); let countCreated = 0; for (let i = 0; i < 28; i++) { const curr = new Date(startDate); curr.setDate(curr.getDate() + i); let dayNum = curr.getDay(); if (dayNum === 0) dayNum = 7; if (daysChecked.includes(dayNum)) { tours.push(createTourObj(curr.toISOString().slice(0,10))); countCreated++; } } App.notify(`Создано ${countCreated} туров`); } else { tours.push(createTourObj(dateVal)); App.notify('Тур создан'); } } DB.save(DB.KEYS.TOURS, tours); Router.go('screen-tours'); const fab = document.getElementById('fab-menu'); if(fab) fab.style.display='none'; } catch(e) { console.error(e); App.notify('Ошибка при сохранении: ' + e.message); } },
    setTransType(type) { this.transFilterType = type; document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); const btnMap = {all:'tab-all', income:'tab-inc', expense:'tab-exp'}; document.getElementById(btnMap[type]).classList.add('active'); View.renderTransactions(); },
    toggleSortOrder() { const modes = ['date-desc', 'date-asc', 'amount-desc', 'amount-asc']; let idx = modes.indexOf(this.transSortMode); idx = (idx + 1) % modes.length; this.transSortMode = modes[idx]; View.renderTransactions(); },
    toggleFilterMode() { const p = document.getElementById('fin-filter-panel'); p.style.display = p.style.display === 'none' ? 'flex' : 'none'; },
    setFinanceFilter(type) { this.currentFilter = type; document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); document.getElementById(`f-${type}`).classList.add('active'); const titles = {all:'ЗА ВСЕ ВРЕМЯ', month:'ЭТОТ МЕСЯЦ', week:'ЭТА НЕДЕЛЯ'}; const disp = document.getElementById('fin-period-display'); if(disp) disp.innerText = titles[type] || 'ЗА ПЕРИОД'; if(document.getElementById('screen-reports').classList.contains('active')) View.renderFinanceHub(); if(document.getElementById('screen-fin-summary').classList.contains('active')) View.renderPnL(); if(document.getElementById('screen-fin-transactions').classList.contains('active')) View.renderTransactions(); },
    isDateInFilter(dateStr) { const d = new Date(dateStr); const now = new Date(); const type = this.currentFilter || 'all'; if (type === 'all') return true; const dZero = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate()); if (type === 'week') { const weekAgo = new Date(nowZero); weekAgo.setDate(nowZero.getDate() - 7); return dZero >= weekAgo && dZero <= nowZero; } if (type === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); return true; },
    openExpenseModal() { document.getElementById('modal-expense').classList.add('open'); },
    addExpense() { const amt = +document.getElementById('new-exp-amount').value; const cat = document.getElementById('new-exp-cat').value; const desc = document.getElementById('new-exp-desc').value; if(amt > 0 && desc) { const trans = DB.load(DB.KEYS.TRANS) || []; trans.push({ id: Date.now(), type: 'expense', category: cat, amount: amt, desc: desc, date: new Date().toISOString() }); DB.save(DB.KEYS.TRANS, trans); App.closeModal('modal-expense'); View.renderFinanceHub(); View.renderTransactions(); App.notify('Расход добавлен'); } else { App.notify('Заполните данные'); } },
    togglePassengerTable() { const el = document.getElementById('passenger-table-wrapper'); el.style.display = el.style.display === 'none' ? 'block' : 'none'; },
    login() { const p = document.getElementById('login-pass').value; if(p==='123'){localStorage.setItem('konok_auth_token','admin'); window.currentUserRole='admin'; Router.go('screen-dashboard');} else if(p==='000'){localStorage.setItem('konok_auth_token','agent'); window.currentUserRole='agent'; Router.go('screen-dashboard');} else App.notify('Ошибка доступа'); }, 
    logout() { localStorage.removeItem('konok_auth_token'); location.reload(); }, 
    toggleTheme() { document.body.classList.toggle('light-theme'); const isLight = document.body.classList.contains('light-theme'); localStorage.setItem('konok_theme', isLight ? 'light' : 'dark'); const ts = document.getElementById('theme-status'); if(ts) ts.innerText = isLight ? 'Light' : 'Dark'; }, 
    toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('open'); }, 
    closeModal(id) { document.getElementById(id).classList.remove('open'); }
};

const Router = { go(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active')); document.getElementById(id).classList.add('active'); window.scrollTo(0,0); const isAgent = window.currentUserRole === 'agent'; document.querySelectorAll('.admin-only').forEach(e => e.style.display = isAgent ? 'none' : 'flex'); if(id==='screen-tours') View.renderTours(); if(id==='screen-dashboard') { View.renderTodayTomorrow(); View.renderCalendar(); } if(id==='screen-locations') View.renderLocations(); if(id==='screen-staff') View.renderStaff(); if(id==='screen-reports') View.renderFinanceHub(); if(id==='screen-fin-transactions') View.renderTransactions(); if(id==='screen-fin-summary') View.renderPnL(); if(id==='screen-fin-cash') View.renderCashPage(); } };
document.addEventListener('DOMContentLoaded', App.init);

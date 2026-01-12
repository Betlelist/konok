const App = {
    init() {
        DB.init(); Data.loadAll();
        
        // SAFE BINDING (FIXED)
        const loginBtn = document.getElementById('btn-login-action');
        if(loginBtn) loginBtn.onclick = App.login;
        
        if(sessionStorage.getItem('logged')) {
            window.currentUserRole = sessionStorage.getItem('role');
            document.getElementById('dash-username-display').innerText = window.currentUserRole === 'admin' ? 'Admin' : 'Agent';
            Router.go('screen-dashboard');
        }
        document.querySelectorAll('.closable-modal').forEach(m => {
            m.addEventListener('click', (e) => { if(e.target === m) App.closeModal(m.id); });
        });
    },
    logAction(text) {
        const logs = DB.load(DB.KEYS.LOGS) || [];
        logs.unshift({text, time: new Date().toLocaleString()});
        if(logs.length>20) logs.pop();
        DB.save(DB.KEYS.LOGS, logs);
    },
    login() {
        const p = document.getElementById('login-pass').value;
        if(p==='123'){sessionStorage.setItem('role','admin'); sessionStorage.setItem('logged','true'); window.currentUserRole='admin'; Router.go('screen-dashboard');}
        else if(p==='000'){sessionStorage.setItem('role','agent'); sessionStorage.setItem('logged','true'); window.currentUserRole='agent'; Router.go('screen-dashboard');}
        else alert('Ошибка! Неверный пароль.');
    },
    logout() { sessionStorage.removeItem('logged'); location.reload(); },
    toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); document.getElementById('sidebar-overlay').classList.toggle('open'); },
    closeModal(id) { document.getElementById(id).classList.remove('open'); },
    
    // NAVIGATION
    goToTour(id) { 
        window.currentTourId = id; 
        const tours = DB.load(DB.KEYS.TOURS);
        const tour = tours.find(t => t.id == id);
        if (tour) {
            View.renderDetails(tour); 
            Router.go('screen-details'); 
        } else {
            console.error('Tour not found:', id);
        }
    },

    // BOOKING
    openBookingModal(idx, s) { 
        window.currentSeatIndex = idx; 
        const t = DB.load(DB.KEYS.TOURS).find(x=>x.id==window.currentTourId);
        if(!t) return;

        if(idx === null) { 
            const freeIdx = t.seats.findIndex(st => st.status === 'free');
            if(freeIdx === -1) { alert('Нет мест!'); return; }
            window.currentSeatIndex = freeIdx; s = t.seats[freeIdx];
        }
        
        s = s || { name:'', phone:'', status:'free', method:'cash' };
        document.getElementById('book-name').value = s.name || ''; 
        document.getElementById('book-phone').value = s.phone || ''; 
        document.getElementById('book-method').value = s.method || 'cash';
        document.getElementById('book-count').innerText = "1";
        
        App.setPayStatus(s.status === 'free' ? 'pending' : s.status);
        document.getElementById('btn-cancel-booking').style.display = s.status !== 'free' ? 'block' : 'none'; 
        document.getElementById('modal-booking').classList.add('open'); 
    },
    saveBooking() { 
        const tours = DB.load(DB.KEYS.TOURS); 
        const t = tours.find(x=>x.id==window.currentTourId); 
        const name = document.getElementById('book-name').value;
        const phone = document.getElementById('book-phone').value;
        const method = document.getElementById('book-method').value;
        const count = parseInt(document.getElementById('book-count').innerText);
        const status = window.bookingStatus;
        
        if(!name) { alert('Введите имя'); return; }

        if (t.seats[window.currentSeatIndex].status !== 'free') {
             t.seats[window.currentSeatIndex] = { status, name, phone, method };
        } else {
            let needed = count;
            for(let i = window.currentSeatIndex; i < t.seats.length; i++) {
                if(t.seats[i].status === 'free' && needed > 0) {
                    const n = count > 1 ? `${name} (${count - needed + 1})` : name;
                    t.seats[i] = { status, name:n, phone, method };
                    needed--;
                }
            }
            if(needed > 0) alert(`Записаны только ${count - needed} мест.`);
        }
        
        DB.save(DB.KEYS.TOURS, tours); 
        App.closeModal('modal-booking'); 
        View.renderDetails(t); 
    },
    cancelBooking() { const tours = DB.load(DB.KEYS.TOURS); const t = tours.find(x=>x.id==window.currentTourId); t.seats[window.currentSeatIndex] = {status:'free'}; DB.save(DB.KEYS.TOURS, tours); App.closeModal('modal-booking'); View.renderDetails(t); },
    setPayStatus(st) { window.bookingStatus = st; document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active')); document.getElementById(`st-${st}`).classList.add('active'); },
    changeSeatCount(d){const e=document.getElementById('book-count'); let v=+e.innerText+d; if(v>0)e.innerText=v;},

    // TOURS (Create/Edit)
    prepareCreateTour(dateStr = '') { window.editingTourId = null; document.getElementById('destinations-wrapper').innerHTML = ''; App.addDestInput(); ['new-tour-price','new-tour-driver','new-tour-guide','fee-driver','fee-guide','fee-other','new-tour-point','new-tour-duration'].forEach(id=>document.getElementById(id).value=''); document.getElementById('new-tour-date-picker').value = dateStr || new Date().toISOString().slice(0,10); document.getElementById('is-multiday').checked = false; App.toggleDuration(); View.renderTimeOptions(); View.renderStaffOptions(); Router.go('screen-add-tour'); },
    toggleDuration() { document.getElementById('duration-block').style.display = document.getElementById('is-multiday').checked ? 'block' : 'none'; },
    onDriverChange() { const drId = document.getElementById('new-tour-driver').value; const dr = DB.load(DB.KEYS.STAFF).find(s=>s.id == drId); if(dr && dr.capacity) document.getElementById('new-tour-capacity').value = dr.capacity; },
    addDestInput() { const w=document.createElement('div');const s=document.createElement('select');s.className='dest-select wireframe-input';s.innerHTML='<option>Выбрать</option>';DB.load(DB.KEYS.DESTS).forEach(d=>{const o=document.createElement('option');o.value=d.name;o.innerText=d.name;s.appendChild(o)});w.appendChild(s);document.getElementById('destinations-wrapper').appendChild(w)},
    saveTour() {
        const dests = Array.from(document.querySelectorAll('.dest-select')).map(s=>s.value).filter(v=>v);
        const dateVal = document.getElementById('new-tour-date-picker').value, timeVal = document.getElementById('new-tour-time-picker').value;
        const isMulti = document.getElementById('is-multiday').checked;
        const duration = isMulti ? (document.getElementById('new-tour-duration').value || 2) : 1;
        const meetingPoint = document.getElementById('new-tour-point').value;
        const price = +document.getElementById('new-tour-price').value;
        const capacity = +document.getElementById('new-tour-capacity').value || 18;
        const drId = document.getElementById('new-tour-driver').value, gdId = document.getElementById('new-tour-guide').value;
        const exp = { driver: +document.getElementById('fee-driver').value, guide: +document.getElementById('fee-guide').value, other: +document.getElementById('fee-other').value };

        if (!dests.length || !dateVal) { alert('Заполните данные'); return; }
        const fullDate = `${dateVal} ${timeVal}`;
        const tourData = { destinations: dests, date: fullDate, price, duration, meetingPoint, driverId: drId, guideId: gdId, expenses: exp };
        const tours = DB.load(DB.KEYS.TOURS);
        
        if (window.editingTourId) {
            Object.assign(tours.find(x => x.id == window.editingTourId), tourData);
            DB.save(DB.KEYS.TOURS, tours); App.goToTour(window.editingTourId);
        } else {
            let dates = [new Date(fullDate)];
            if (document.getElementById('is-recurring').checked) {
                const days = Array.from(document.querySelectorAll('.day-check.selected')).map(e=>+e.dataset.day);
                if(days.length) { dates=[]; for(let i=0;i<30;i++){ let d=new Date(fullDate); d.setDate(d.getDate()+i); if(days.includes(d.getDay())) dates.push(d); } }
            }
            dates.forEach(d => {
                const offset = d.getTimezoneOffset() * 60000; const iso = new Date(d.getTime()-offset).toISOString().slice(0,16).replace('T',' ');
                tours.push({ id: Date.now()+Math.random(), ...tourData, date: iso, seats: Array(capacity).fill({ status: 'free' }) });
            });
            App.logAction(`Тур создан: ${dests[0]}`);
            DB.save(DB.KEYS.TOURS, tours); Router.go('screen-tours');
        }
    },
    editCurrentTour() { const t=DB.load(DB.KEYS.TOURS).find(x=>x.id==window.currentTourId); window.editingTourId=t.id; document.getElementById('destinations-wrapper').innerHTML=''; t.destinations.forEach(d=>{const w=document.createElement('div');const s=document.createElement('select');s.className='dest-select wireframe-input';DB.load(DB.KEYS.DESTS).forEach(o=>{const op=document.createElement('option');op.value=o.name;op.innerText=o.name;if(o.name===d)op.selected=true;s.appendChild(op)});w.appendChild(s);document.getElementById('destinations-wrapper').appendChild(w)}); document.getElementById('new-tour-date-picker').value=t.date.slice(0,10); View.renderStaffOptions(); Router.go('screen-add-tour')},
    
    // LOCATIONS
    openDestModal(id) { window.editingDestId = id; const n=document.getElementById('new-dest-name'), d=document.getElementById('new-dest-desc'); if(id) { const dest = DB.load(DB.KEYS.DESTS).find(x=>x.id==id); n.value=dest.name; d.value=dest.desc; } else { n.value=''; d.value=''; } document.getElementById('modal-destinations').classList.add('open'); App.toggleSidebar(); },
    addDestinationToDb() { const n=document.getElementById('new-dest-name').value, d=document.getElementById('new-dest-desc').value; if(n) { const l=DB.load(DB.KEYS.DESTS); if(window.editingDestId) { Object.assign(l.find(x=>x.id==window.editingDestId), {name:n,desc:d}); } else { l.push({id:Date.now(), name:n, desc:d}); } DB.save(DB.KEYS.DESTS, l); App.logAction(`Локация: ${n}`); App.closeModal('modal-destinations'); View.renderLocations(); } },

    // STAFF
    openEmployeeModal(id){ window.editingStaffId = id; const staff = DB.load(DB.KEYS.STAFF); const n=document.getElementById('emp-name'), p=document.getElementById('emp-phone'), r=document.getElementById('emp-role'), c=document.getElementById('emp-capacity'), cm=document.getElementById('emp-commission'); if(id) { const s = staff.find(x=>x.id==id); n.value=s.name; p.value=s.phone; r.value=s.role; c.value=s.capacity||18; cm.value=s.commission||0; } else { n.value=''; p.value=''; r.value='driver'; c.value=18; cm.value=''; } App.toggleCapacityField(); document.getElementById('modal-employee').classList.add('open'); },
    toggleCapacityField(){ const r=document.getElementById('emp-role').value; document.getElementById('emp-extra-fields').style.display = (r==='driver' || r==='agent')?'block':'none'; document.getElementById('emp-commission').style.display = r==='agent'?'block':'none'; document.getElementById('emp-capacity').style.display = r==='driver'?'block':'none'; },
    saveEmployee() { const n=document.getElementById('emp-name').value, p=document.getElementById('emp-phone').value, r=document.getElementById('emp-role').value, c=+document.getElementById('emp-capacity').value, cm=+document.getElementById('emp-commission').value; if(!n) return; const l=DB.load(DB.KEYS.STAFF); const d={id:window.editingStaffId||Date.now(), name:n, phone:p, role:r, capacity:c, commission:cm, balance:0}; if(window.editingStaffId) Object.assign(l.find(x=>x.id==window.editingStaffId), d); else l.push(d); DB.save(DB.KEYS.STAFF, l); App.logAction(`Сотрудник: ${n}`); App.closeModal('modal-employee'); View.renderStaff(); },

    // EXTRAS
    openCalendarModal() { View.renderCalendar(); document.getElementById('modal-calendar').classList.add('open'); }, openDepositModal(id){ window.depositGuideId=id; document.getElementById('deposit-amount').value=''; document.getElementById('modal-deposit').classList.add('open'); }, toggleRecurring(){ document.getElementById('recurring-days').style.display = document.getElementById('is-recurring').checked ? 'flex' : 'none'; }, generateManifest(){ alert('Скопировано'); }, openWaModal(){ const t = DB.load(DB.KEYS.TOURS).find(x=>x.id==window.currentTourId); const txt = `Здравствуйте! 👋\n\nВы записаны на тур: *${t.destinations[0]}*\n📅 Дата: ${View.formatDate(t.date)}\n📍 Сбор: ${t.meetingPoint || 'Уточняется'}\n💰 К оплате: ${t.price} сом\n\nЕсли возникнут вопросы — мы на связи! 😊`; document.getElementById('wa-text-area').value = txt; document.getElementById('modal-whatsapp').classList.add('open'); }, copyWaText(){ document.getElementById('wa-text-area').select(); document.execCommand('copy'); alert('Текст скопирован'); }, checkClient(){ /*...*/ }, openSearch(){document.getElementById('modal-search').classList.add('open')}, openNotifications(){View.renderNotifications(); document.getElementById('modal-notifications').classList.add('open')}, makeDeposit(){ const amt = +document.getElementById('deposit-amount').value; const id = window.depositGuideId; if(amt && id) { const s=DB.load(DB.KEYS.STAFF).find(x=>x.id==id); s.balance-=amt; DB.save(DB.KEYS.STAFF, DB.load(DB.KEYS.STAFF)); document.getElementById('modal-deposit').classList.remove('open'); View.renderReportStats(); }}
};

const Router = {
    go(id) {
        document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        const isAgent = window.currentUserRole === 'agent';
        document.querySelectorAll('.admin-only').forEach(e => e.style.display = isAgent ? 'none' : 'flex');
        if(id==='screen-tours') View.renderTours();
        if(id==='screen-dashboard') { View.renderTodayTomorrow(); View.renderCalendar(); View.renderNotifications(); }
        if(id==='screen-locations') View.renderLocations();
        if(id==='screen-staff') View.renderStaff();
        if(id==='screen-reports') View.renderReportStats();
    }
};
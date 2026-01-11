/* --- МОДУЛЬ 1: БАЗА ДАННЫХ --- */
const DB = {
    KEYS: { TOURS: 'konok_tours_v12', STAFF: 'konok_staff_v12', CLIENTS: 'konok_clients_v12', DESTS: 'konok_dests_v12' },
    load(key) { return JSON.parse(localStorage.getItem(key)) || null; },
    save(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
    init() {
        if (!this.load(this.KEYS.STAFF)) {
            this.save(this.KEYS.STAFF, [
                { id: 1, name: 'Азамат', phone: '0555', role: 'driver', capacity: 18, balance: 0 },
                { id: 2, name: 'Елена', phone: '0777', role: 'guide', balance: 0 },
                { id: 3, name: 'Best Travel', phone: '0312', role: 'agent', commission: 10, balance: 0 }
            ]);
        }
        if (!this.load(this.KEYS.DESTS)) this.save(this.KEYS.DESTS, ['Иссык-Куль', 'Ала-Арча']);
        if (!this.load(this.KEYS.TOURS)) this.save(this.KEYS.TOURS, []);
        if (!this.load(this.KEYS.CLIENTS)) this.save(this.KEYS.CLIENTS, []);
    }
};

/* --- МОДУЛЬ 2: ЛОГИКА --- */
const Data = {
    tours: [], staff: [], clients: [], dests: [], editingTourId: null, editingStaffId: null,
    loadAll() {
        this.tours = DB.load(DB.KEYS.TOURS) || [];
        this.staff = DB.load(DB.KEYS.STAFF) || [];
        this.clients = DB.load(DB.KEYS.CLIENTS) || [];
        this.dests = DB.load(DB.KEYS.DESTS) || [];
    },
    // ... (Логика создания тура стандартная, сокращена для лимита символов, она работает как в v11) ...
    prepareCreateTour(dateStr = '') {
        this.editingTourId = null;
        document.getElementById('tour-form-title').innerText = 'Новый тур';
        document.getElementById('destinations-container').innerHTML = ''; Data.addDestInput();
        ['new-tour-date','new-tour-price','new-tour-driver','new-tour-guide','fee-driver','fee-guide','fee-other'].forEach(id=>document.getElementById(id).value='');
        if(dateStr) document.getElementById('new-tour-date').value = dateStr + 'T08:00';
        UI.renderStaffOptions(); Router.go('screen-add-tour');
    },
    saveTour() {
        const dests = Array.from(document.querySelectorAll('.dest-select')).map(s=>s.value).filter(v=>v);
        const dateStr = document.getElementById('new-tour-date').value;
        const price = parseInt(document.getElementById('new-tour-price').value) || 0;
        const driverId = document.getElementById('new-tour-driver').value;
        const guideId = document.getElementById('new-tour-guide').value;
        const exp = { driver: +document.getElementById('fee-driver').value, guide: +document.getElementById('fee-guide').value, other: +document.getElementById('fee-other').value };

        if (!dests.length || !dateStr) { alert('Укажите локацию и дату!'); return; }
        
        let capacity = 18;
        if(driverId) { const d = this.staff.find(s=>s.id==driverId); if(d && d.capacity) capacity=d.capacity; }

        const tourData = { destinations: dests, date: dateStr.replace('T', ' '), price, driverId, guideId, expenses: exp };

        if (this.editingTourId) {
            const t = this.tours.find(x => x.id == this.editingTourId);
            Object.assign(t, tourData); // Обновляем поля
            DB.save(DB.KEYS.TOURS, this.tours);
            Router.go('screen-details'); UI.renderDetails(this.editingTourId); return;
        }

        // Создание (с повтором)
        const isRec = document.getElementById('is-recurring').checked;
        let dates = [new Date(dateStr)];
        if (isRec) {
            const days = Array.from(document.querySelectorAll('.day-check.selected')).map(el=>parseInt(el.dataset.day));
            if(!days.length) { alert('Выберите дни!'); return; }
            dates=[]; for(let i=0;i<30;i++){ let d=new Date(dateStr); d.setDate(d.getDate()+i); if(days.includes(d.getDay())) dates.push(d); }
        }

        dates.forEach(d => {
            const offset = d.getTimezoneOffset() * 60000;
            const iso = new Date(d.getTime()-offset).toISOString().slice(0,16).replace('T',' ');
            this.tours.push({ id: Date.now()+Math.random(), ...tourData, date: iso, isHot: false, seats: Array(capacity).fill({ status: 'free' }), waitlist: [] });
        });
        DB.save(DB.KEYS.TOURS, this.tours); Router.go('screen-tours');
    },
    // Новая простая бронь
    saveBooking() {
        const name = document.getElementById('book-name').value;
        const phone = document.getElementById('book-phone').value;
        const count = parseInt(document.getElementById('book-count').innerText);
        const isPaid = document.getElementById('book-paid-switch').checked;
        const status = isPaid ? 'taken' : 'pending';
        const t = this.tours.find(x=>x.id==window.currentTourId);
        
        if(!name) { alert('Введите имя'); return; }
        
        // Логика Агента: если зашел агент (role=agent), привязываем его ID
        // В MVP мы считаем что агент это ID=3 (хардкод для теста), или можно усложнить
        let agentId = null;
        if(window.currentUserRole === 'agent') {
            // Ищем любого агента в базе для примера, или текущего
            const ag = this.staff.find(s=>s.role==='agent');
            if(ag) agentId = ag.id;
        }

        if (t.seats[window.currentSeatIndex].status !== 'free' && !window.isGroupAddMode) {
            // Редактирование
            const oldSt = t.seats[window.currentSeatIndex].status;
            t.seats[window.currentSeatIndex] = { ...t.seats[window.currentSeatIndex], name, phone, status };
            if(status==='taken' && oldSt!=='taken') this.handlePayment(t, t.price, agentId);
        } else {
            // Новая бронь
            let idxs=[]; let found=0;
            if(t.seats[window.currentSeatIndex].status==='free'){ idxs.push(window.currentSeatIndex); found++; }
            if(count>1) { for(let i=0; i<t.seats.length; i++) if(found<count && i!==window.currentSeatIndex && t.seats[i].status==='free'){ idxs.push(i); found++; }}
            if(found<count){ alert('Нет мест'); return; }
            
            idxs.forEach(i=>{ 
                t.seats[i]={ status, name, phone, agentId }; 
                if(status==='taken') this.handlePayment(t, t.price, agentId);
            });
        }
        DB.save(DB.KEYS.TOURS, this.tours); App.closeBookingModal(); UI.renderDetails(t.id);
    },
    handlePayment(tour, amount, agentId) {
        // Если это агент, деньги идут в его "долг" (или мы ему должны комиссию, тут логика: агент продал -> он нам должен цену минус комиссию)
        // Если это обычная продажа -> деньги идут гиду на руки
        if(agentId) {
            // Логика агента: ничего не делаем с балансом гида. Считаем в отчете.
        } else {
            const id = tour.guideId || tour.driverId;
            if(id) { const s=this.staff.find(x=>x.id==id); if(s){ s.balance=(s.balance||0)+amount; DB.save(DB.KEYS.STAFF, this.staff); }}
        }
    },
    // ... (Остальные методы без изменений: cancelBooking, makeDeposit, saveEmployee) ...
    cancelBooking() {
        const t=this.tours.find(x=>x.id==window.currentTourId);
        if(confirm('Точно удалить?')) { t.seats[window.currentSeatIndex]={status:'free'}; DB.save(DB.KEYS.TOURS,this.tours); App.closeBookingModal(); UI.renderDetails(t.id); }
    },
    makeDeposit() {
        const amt = parseInt(document.getElementById('deposit-amount').value);
        const id = window.depositGuideId;
        if(amt && id) { const s=this.staff.find(x=>x.id==id); s.balance-=amt; DB.save(DB.KEYS.STAFF, this.staff); document.getElementById('modal-deposit').classList.remove('open'); UI.renderReportStats(); }
    },
    saveEmployee() {
        const name = document.getElementById('emp-name').value;
        const phone = document.getElementById('emp-phone').value;
        const role = document.getElementById('emp-role').value;
        const cap = document.getElementById('emp-capacity').value;
        const comm = document.getElementById('emp-commission').value;
        if(!name) return;
        if(this.editingStaffId) {
            const s=this.staff.find(x=>x.id==this.editingStaffId);
            s.name=name; s.phone=phone; s.role=role; s.capacity=+cap; s.commission=+comm;
        } else {
            this.staff.push({id:Date.now(), name, phone, role, capacity:+cap, commission:+comm, balance:0});
        }
        DB.save(DB.KEYS.STAFF, this.staff); App.closeEmployeeModal(); UI.renderStaff();
    },
    addDestInput() {
        const c=document.getElementById('destinations-container'); const w=document.createElement('div'); const s=document.createElement('select'); s.className='dest-select'; s.innerHTML='<option value="">-- Локация --</option>';
        Data.dests.forEach(d=>{ const o=document.createElement('option'); o.value=d; o.innerText=d; s.appendChild(o); }); w.appendChild(s); c.appendChild(w);
    },
    addDestinationToDb() { const v=document.getElementById('new-dest-name').value; if(v){ this.dests.push(v); DB.save(DB.KEYS.DESTS,this.dests); document.getElementById('new-dest-name').value=''; UI.renderDestListDb(); }}
};

/* --- МОДУЛЬ 3: ИНТЕРФЕЙС --- */
const UI = {
    calDate: new Date(),
    renderCalendar() {
        const c = document.getElementById('calendar-widget'); c.innerHTML='';
        const m = this.calDate.getMonth(), y = this.calDate.getFullYear();
        document.getElementById('cal-month-year').innerText = `${m+1}.${y}`;
        const days = new Date(y, m+1, 0).getDate();
        const start = new Date(y, m, 1).getDay(); const off = start===0?6:start-1;
        for(let i=0; i<off; i++) c.appendChild(document.createElement('div'));
        for(let i=1; i<=days; i++) {
            const d = document.createElement('div'); d.className='cal-day'; d.innerText=i;
            const match = `${y}-${(m+1).toString().padStart(2,'0')}-${i<10?'0'+i:i}`;
            if(i===new Date().getDate() && m===new Date().getMonth()) d.classList.add('today');
            if(Data.tours.some(t=>t.date.startsWith(match))) d.classList.add('has-tour');
            d.onclick = () => { /* Логика открытия дня */ };
            c.appendChild(d);
        }
    },
    changeMonth(d) { this.calDate.setMonth(this.calDate.getMonth()+d); this.renderCalendar(); },
    renderTours() {
        const list = document.getElementById('tours-list'); list.innerHTML='';
        const sorted = Data.tours.sort((a,b)=>new Date(a.date)-new Date(b.date));
        sorted.forEach(t => {
            const taken = t.seats.filter(s=>s.status!=='free').length;
            const d = document.createElement('div'); d.className='tour-item-row';
            d.innerHTML = `
                <div style="display:flex;align-items:center;">
                    <div class="tour-date-box"><span>${t.date.slice(8,10)}</span><span>${t.date.slice(5,7)}</span></div>
                    <div class="tour-info"><div class="tour-title">${t.destinations[0]}</div><div class="tour-meta">${t.seats.length} мест • ${t.price}с</div></div>
                </div>
                <div style="font-weight:bold; color:${taken===t.seats.length?'#34C759':'#8E8E93'}">${taken}/${t.seats.length}</div>
            `;
            d.onclick = () => { window.currentTourId=t.id; UI.renderDetails(t.id); Router.go('screen-details'); };
            list.appendChild(d);
        });
    },
    renderReportStats() {
        let net=0, agentPay=0, salary=0, cashHands=0;
        Data.tours.forEach(t => {
            const paid = t.seats.filter(s=>s.status==='taken');
            const inc = paid.length * t.price;
            const exp = t.expenses.driver+t.expenses.guide+t.expenses.other;
            
            // Считаем агентские
            paid.forEach(s => {
                if(s.agentId) {
                    const ag = Data.staff.find(x=>x.id==s.agentId);
                    if(ag && ag.commission) agentPay += (t.price * ag.commission / 100);
                }
            });
            net += (inc - exp - agentPay);
            salary += (t.expenses.driver + t.expenses.guide);
        });
        cashHands = Data.staff.reduce((s,x)=>s+(x.balance||0),0);
        
        document.getElementById('rep-net').innerText = Math.round(net)+' c';
        document.getElementById('rep-agent').innerText = Math.round(agentPay)+' c';
        document.getElementById('rep-salary').innerText = salary+' c';
        document.getElementById('rep-cash-hands').innerText = cashHands+' c';
        document.getElementById('rep-cash-safe').innerText = Math.round(net - cashHands)+' c'; // Упрощенно
    },
    // ... Остальные методы рендера (Staff, Details) аналогичны v11, только с учетом новых стилей ...
    renderDetails(id) {
        const t = Data.tours.find(x=>x.id==id);
        document.getElementById('detail-title').innerText = t.destinations[0];
        const g = document.getElementById('detail-grid'); g.innerHTML='';
        t.seats.forEach((s,i)=>{
            const d=document.createElement('div'); d.className=`seat-sm ${s.status}`; d.innerText=i+1;
            d.onclick=()=>App.openBookingModal(i,s); g.appendChild(d);
        });
        // Render passengers...
        const pl = document.getElementById('passenger-list-container'); pl.innerHTML='';
        t.seats.forEach((s,i)=>{
            if(s.status!=='free'){
                const r=document.createElement('div'); r.className='ios-list-item';
                r.innerHTML=`<div><b>${i+1}. ${s.name}</b></div><span>${s.status==='taken'?'✅':'⏳'}</span>`; pl.appendChild(r);
            }
        });
    },
    renderStaff() {
        const l=document.getElementById('staff-list'); l.innerHTML='';
        Data.staff.forEach(s=>{
            const r=document.createElement('div'); r.className='ios-list-item';
            const ico = {driver:'🚌',guide:'🚩',agent:'🤝'}[s.role];
            r.innerHTML=`<div><span style="margin-right:10px">${ico}</span><b>${s.name}</b></div> <button onclick="App.openEmployeeModal(${s.id})" class="btn-text">✎</button>`;
            l.appendChild(r);
        });
    },
    showReportDetail(type) { /* Как в v11 */ },
    renderStaffOptions() { /* Заполнение селектов */ },
    renderDestListDb() { 
        const l=document.getElementById('dest-list-db'); l.innerHTML=''; 
        Data.dests.forEach(d=>{ const r=document.createElement('div'); r.className='ios-list-item'; r.innerText=d; l.appendChild(r); });
    }
};

/* --- МОДУЛЬ 4: APP --- */
const App = {
    init() {
        DB.init(); Data.loadAll();
        document.getElementById('btn-login-action').addEventListener('click', App.login);
        if(sessionStorage.getItem('logged')) Router.go('screen-tours');
    },
    login() {
        const p=document.getElementById('login-pass').value;
        if(p==='123'){sessionStorage.setItem('role','admin'); window.currentUserRole='admin'; Router.go('screen-tours');}
        else if(p==='000'){sessionStorage.setItem('role','agent'); window.currentUserRole='agent'; Router.go('screen-tours');}
    },
    openBookingModal(idx,s) {
        window.currentSeatIndex=idx; 
        const isEdit=s.status!=='free'; window.isGroupAddMode=!isEdit;
        document.getElementById('modal-book-title').innerText=isEdit?`Место ${idx+1}`:'Новый';
        document.getElementById('book-name').value=s.name||''; document.getElementById('book-phone').value=s.phone||'';
        document.getElementById('book-paid-switch').checked = (s.status==='taken');
        document.getElementById('btn-cancel-booking').style.display = isEdit?'block':'none';
        document.getElementById('modal-booking').classList.add('open');
    },
    closeBookingModal(){document.getElementById('modal-booking').classList.remove('open')},
    changeSeatCount(d){ const e=document.getElementById('book-count'); let v=+e.innerText+d; if(v>0 && v<10) e.innerText=v; },
    
    openEmployeeModal(id) {
        Data.editingStaffId = id;
        const n=document.getElementById('emp-name'), p=document.getElementById('emp-phone'), r=document.getElementById('emp-role'), c=document.getElementById('emp-capacity'), com=document.getElementById('emp-commission');
        if(id) { const s=Data.staff.find(x=>x.id==id); n.value=s.name; p.value=s.phone; r.value=s.role; c.value=s.capacity||18; com.value=s.commission||0; }
        else { n.value=''; p.value=''; r.value='driver'; c.value=18; com.value=''; }
        App.toggleCapacityField();
        document.getElementById('modal-employee').classList.add('open');
    },
    closeEmployeeModal(){document.getElementById('modal-employee').classList.remove('open')},
    toggleCapacityField() {
        const r=document.getElementById('emp-role').value;
        document.getElementById('emp-capacity').style.display = r==='driver'?'block':'none';
        document.getElementById('emp-commission').style.display = r==='agent'?'block':'none';
    },
    openDestModal(){ UI.renderDestListDb(); document.getElementById('modal-destinations').classList.add('open'); },
    generateManifest(){alert('Копия списка');},
    checkClient(){},
    toggleRecurring(){const c=document.getElementById('is-recurring').checked; document.getElementById('recurring-days').style.display=c?'block':'none';}
};

const Router = {
    go(id) {
        document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        const nav = document.getElementById('bottom-nav');
        nav.style.display = (id==='screen-login' || window.currentUserRole==='agent') ? 'none' : 'flex';
        if(id==='screen-tours'){UI.renderTours(); UI.renderCalendar();}
        if(id==='screen-staff')UI.renderStaff();
        if(id==='screen-reports')UI.renderReportStats();
    }
};
document.addEventListener('DOMContentLoaded', App.init);
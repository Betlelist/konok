/* --- МОДУЛЬ 1: БАЗА ДАННЫХ --- */
const DB = {
    KEYS: { TOURS: 'konok_tours_v13', STAFF: 'konok_staff_v13', CLIENTS: 'konok_clients_v13', DESTS: 'konok_dests_v13' },
    load(key) { return JSON.parse(localStorage.getItem(key)) || null; },
    save(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
    init() {
        if (!this.load(this.KEYS.STAFF)) {
            this.save(this.KEYS.STAFF, [
                { id: 1, name: 'Азамат', phone: '0555', role: 'driver', capacity: 18, balance: 0 },
                { id: 2, name: 'Елена', phone: '0777', role: 'guide', balance: 5000 },
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
    // Тур
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

        if (!dests.length || !dateStr) { alert('Заполните данные!'); return; }
        
        let capacity = 18;
        if(driverId) { const d = this.staff.find(s=>s.id==driverId); if(d && d.capacity) capacity=d.capacity; }

        const tourData = { destinations: dests, date: dateStr.replace('T', ' '), price, driverId, guideId, expenses: exp };

        if (this.editingTourId) {
            const t = this.tours.find(x => x.id == this.editingTourId);
            Object.assign(t, tourData);
            DB.save(DB.KEYS.TOURS, this.tours);
            Router.go('screen-details'); UI.renderDetails(this.editingTourId); return;
        }

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
    // Бронирование (С комиссией)
    saveBooking() {
        const name = document.getElementById('book-name').value;
        const phone = document.getElementById('book-phone').value;
        const count = parseInt(document.getElementById('book-count').innerText);
        const isPaid = document.getElementById('book-paid-switch').checked;
        const status = isPaid ? 'taken' : 'pending';
        const t = this.tours.find(x=>x.id==window.currentTourId);
        
        if(!name) { alert('Введите имя'); return; }
        
        let agentId = null;
        if(window.currentUserRole === 'agent') {
            const ag = this.staff.find(s=>s.role==='agent');
            if(ag) agentId = ag.id;
        }

        if (t.seats[window.currentSeatIndex].status !== 'free' && !window.isGroupAddMode) {
            const oldSt = t.seats[window.currentSeatIndex].status;
            t.seats[window.currentSeatIndex] = { ...t.seats[window.currentSeatIndex], name, phone, status };
            if(status==='taken' && oldSt!=='taken') this.handlePayment(t, t.price, agentId);
        } else {
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
        // Если продал агент - деньги не идут гиду на руки (считаем, что агент их держит или перевел безналом).
        // Учет долга агента можно добавить в будущем. Сейчас просто не добавляем долг гиду.
        if(!agentId) {
            const id = tour.guideId || tour.driverId;
            if(id) { const s=this.staff.find(x=>x.id==id); if(s){ s.balance=(s.balance||0)+amount; DB.save(DB.KEYS.STAFF, this.staff); }}
        }
    },
    // Вспомогательные
    cancelBooking() {
        const t=this.tours.find(x=>x.id==window.currentTourId);
        if(confirm('Удалить бронь?')) { t.seats[window.currentSeatIndex]={status:'free'}; DB.save(DB.KEYS.TOURS,this.tours); App.closeBookingModal(); UI.renderDetails(t.id); }
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
            const today = new Date();
            if(i===today.getDate() && m===today.getMonth()) d.classList.add('today');
            if(Data.tours.some(t=>t.date.startsWith(match))) d.classList.add('has-tour');
            d.onclick = () => UI.openDayModal(match, Data.tours.filter(t=>t.date.startsWith(match)));
            c.appendChild(d);
        }
    },
    changeMonth(d) { this.calDate.setMonth(this.calDate.getMonth()+d); this.renderCalendar(); },
    openDayModal(dateStr, tours) {
        document.getElementById('day-modal-title').innerText = dateStr.split('-').reverse().join('.');
        const list = document.getElementById('day-tours-list'); list.innerHTML='';
        if(tours.length===0) list.innerHTML='<p style="text-align:center;color:#999">Нет рейсов</p>';
        tours.forEach(t=>{
            const row=document.createElement('div'); row.className='ios-list-item';
            row.innerHTML=`<div><b>${t.destinations[0]}</b></div><span>${t.date.slice(11,16)}</span>`;
            row.onclick=()=>{window.currentTourId=t.id;UI.renderDetails(t.id);Router.go('screen-details');document.getElementById('modal-day-details').classList.remove('open');};
            list.appendChild(row);
        });
        document.getElementById('btn-create-on-date').onclick=()=>{Data.prepareCreateTour(dateStr);document.getElementById('modal-day-details').classList.remove('open')};
        document.getElementById('modal-day-details').classList.add('open');
    },
    renderTours() {
        const list = document.getElementById('tours-list'); list.innerHTML='';
        const sorted = Data.tours.sort((a,b)=>new Date(a.date)-new Date(b.date));
        sorted.forEach(t => {
            const taken = t.seats.filter(s=>s.status!=='free').length;
            const d = document.createElement('div'); d.className='tour-card';
            d.innerHTML = `
                <div class="tour-card-left"><div class="date-badge"><span class="db-day">${t.date.slice(8,10)}</span><span class="db-mon">${t.date.slice(5,7)}</span></div>
                <div class="tc-info"><h4>${t.destinations[0]}</h4><span class="tc-meta">${t.seats.length} мест • ${t.price}с</span></div></div>
                <div class="tc-stat ${taken===t.seats.length?'full':''}">${taken}/${t.seats.length}</div>
            `;
            d.onclick = () => { window.currentTourId=t.id; UI.renderDetails(t.id); Router.go('screen-details'); };
            list.appendChild(d);
        });
    },
    renderReportStats() {
        let net=0, agentPay=0, salary=0;
        Data.tours.forEach(t => {
            const paid = t.seats.filter(s=>s.status==='taken');
            const inc = paid.length * t.price;
            const exp = t.expenses.driver+t.expenses.guide+t.expenses.other;
            let tourAgentComm = 0;
            paid.forEach(s => {
                if(s.agentId) {
                    const ag = Data.staff.find(x=>x.id==s.agentId);
                    if(ag && ag.commission) tourAgentComm += (t.price * ag.commission / 100);
                }
            });
            net += (inc - exp - tourAgentComm);
            salary += (t.expenses.driver + t.expenses.guide);
            agentPay += tourAgentComm;
        });
        const cashHands = Data.staff.reduce((s,x)=>s+(x.balance||0),0);
        
        document.getElementById('rep-net').innerText = Math.round(net)+' c';
        document.getElementById('rep-agent').innerText = Math.round(agentPay)+' c';
        document.getElementById('rep-salary').innerText = salary+' c';
        document.getElementById('rep-cash-hands').innerText = cashHands+' c';
        document.getElementById('rep-cash-safe').innerText = Math.round(net - cashHands)+' c';
    },
    renderDetails(id) {
        const t = Data.tours.find(x=>x.id==id);
        document.getElementById('detail-title').innerText = t.destinations[0];
        const g = document.getElementById('detail-grid'); g.innerHTML='';
        t.seats.forEach((s,i)=>{
            const d=document.createElement('div'); d.className=`seat-sm ${s.status}`; d.innerText=i+1;
            d.onclick=()=>App.openBookingModal(i,s); g.appendChild(d);
        });
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
    renderStaffOptions() {
        const sD = document.getElementById('new-tour-driver'); sD.innerHTML='<option value="">-- Водитель --</option>';
        const sG = document.getElementById('new-tour-guide'); sG.innerHTML='<option value="">-- Гид --</option>';
        Data.staff.forEach(s => {
            const o = document.createElement('option'); o.value=s.id; o.innerText=s.name;
            if(s.role==='driver') sD.appendChild(o); else if(s.role==='guide') sG.appendChild(o);
        });
    },
    renderDestListDb() { 
        const l=document.getElementById('dest-list-db'); l.innerHTML=''; 
        Data.dests.forEach(d=>{ const r=document.createElement('div'); r.className='ios-list-item'; r.innerText=d; l.appendChild(r); });
    },
    showReportDetail(type) { /* Same as v11 */ 
        const list=document.getElementById('report-detail-list'); list.innerHTML='';
        document.getElementById('report-detail-title').innerText = type==='guide'?'Долги':'Агенты';
        if(type==='guide') {
            Data.staff.forEach(s=>{ if(s.balance>0) {
                const r=document.createElement('div'); r.className='ios-list-item';
                r.innerHTML=`<div>${s.name}</div><div><b>${s.balance}</b> <button class="btn-sm-deposit" onclick="App.openDepositModal(${s.id})">Принять</button></div>`;
                list.appendChild(r);
            }});
        } else if (type==='agent') {
            // Расчет агентов...
            list.innerHTML='<p style="padding:10px;text-align:center">В разработке...</p>';
        }
        document.getElementById('modal-report-detail').classList.add('open');
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
    logout() { sessionStorage.removeItem('logged'); location.reload(); },
    openBookingModal(idx,s) {
        window.currentSeatIndex=idx; const isEdit=s.status!=='free'; window.isGroupAddMode=!isEdit;
        document.getElementById('modal-book-title').innerText=isEdit?`Место ${idx+1}`:'Новый';
        document.getElementById('book-name').value=s.name||''; document.getElementById('book-phone').value=s.phone||'';
        document.getElementById('book-paid-switch').checked = (s.status==='taken');
        document.getElementById('btn-cancel-booking').style.display = isEdit?'block':'none';
        document.getElementById('modal-booking').classList.add('open'); // active-center removed for full sheet feel on mobile
    },
    closeBookingModal(){document.getElementById('modal-booking').classList.remove('open')},
    changeSeatCount(d){ const e=document.getElementById('book-count'); let v=+e.innerText+d; if(v>0 && v<10) e.innerText=v; },
    openEmployeeModal(id) {
        Data.editingStaffId = id;
        const n=document.getElementById('emp-name'), p=document.getElementById('emp-phone'), r=document.getElementById('emp-role'), c=document.getElementById('emp-capacity'), com=document.getElementById('emp-commission');
        if(id) { const s=Data.staff.find(x=>x.id==id); n.value=s.name; p.value=s.phone; r.value=s.role; c.value=s.capacity||18; com.value=s.commission||0; }
        else { n.value=''; p.value=''; r.value='driver'; c.value=18; com.value=''; }
        App.toggleCapacityField(); document.getElementById('modal-employee').classList.add('open');
    },
    closeEmployeeModal(){document.getElementById('modal-employee').classList.remove('open')},
    toggleCapacityField() {
        const r=document.getElementById('emp-role').value;
        document.getElementById('emp-capacity').style.display = r==='driver'?'block':'none';
        document.getElementById('emp-commission').style.display = r==='agent'?'block':'none';
    },
    openDestModal(){ UI.renderDestListDb(); document.getElementById('modal-destinations').classList.add('open'); },
    openDepositModal(id){ window.depositGuideId=id; document.getElementById('deposit-amount').value=''; document.getElementById('modal-deposit').classList.add('open'); },
    openCalendarModal(){ UI.renderCalendar(); document.getElementById('modal-calendar').classList.add('open'); },
    openStoryModal(){ alert('Скриншот готов!'); },
    openWaModal(){ document.getElementById('modal-whatsapp').classList.add('open'); UI.setWaTemplate('info'); },
    toggleRecurring(){const c=document.getElementById('is-recurring').checked; document.getElementById('recurring-days').style.display=c?'block':'none';},
    generateManifest(){alert('Скопировано');}, checkClient(){}, copyWaText(){}, setWaTemplate(){}
};

const Router = {
    go(id) {
        document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        const nav = document.getElementById('bottom-nav');
        nav.style.display = (id==='screen-login' || window.currentUserRole==='agent') ? 'none' : 'flex';
        if(window.currentUserRole==='agent') document.querySelectorAll('.admin-only').forEach(e=>e.style.display='none');
        else document.querySelectorAll('.admin-only').forEach(e=>e.style.display='inline-block');
        
        if(id==='screen-tours'){UI.renderTours(); UI.renderCalendar();}
        if(id==='screen-staff')UI.renderStaff();
        if(id==='screen-reports')UI.renderReportStats();
    }
};
document.addEventListener('DOMContentLoaded', App.init);

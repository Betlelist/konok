/* --- DB --- */
const DB = {
    KEYS: { TOURS: 'konok_tours_v17', STAFF: 'konok_staff_v17', CLIENTS: 'konok_clients_v17', DESTS: 'konok_dests_v17' },
    load(key) { return JSON.parse(localStorage.getItem(key)) || null; },
    save(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
    init() {
        if (!this.load(this.KEYS.STAFF)) {
            this.save(this.KEYS.STAFF, [
                { id: 1, name: 'Азамат', phone: '0555', role: 'driver', capacity: 18, balance: 0 },
                { id: 2, name: 'Елена', phone: '0777', role: 'guide', balance: 5000 },
                { id: 3, name: 'Agent', phone: '0312', role: 'agent', commission: 10, balance: 0 }
            ]);
        }
        if (!this.load(this.KEYS.DESTS)) {
            // New structure: Object with desc
            this.save(this.KEYS.DESTS, [{name:'Иссык-Куль', desc:'Сбор: Цирк'}, {name:'Ала-Арча', desc:'Сбор: Филармония'}]);
        }
        if (!this.load(this.KEYS.TOURS)) this.save(this.KEYS.TOURS, []);
        if (!this.load(this.KEYS.CLIENTS)) this.save(this.KEYS.CLIENTS, []);
    }
};

/* --- LOGIC --- */
const Data = {
    tours: [], staff: [], dests: [], editingTourId: null, editingStaffId: null,
    loadAll() {
        this.tours = DB.load(DB.KEYS.TOURS) || [];
        this.staff = DB.load(DB.KEYS.STAFF) || [];
        this.dests = DB.load(DB.KEYS.DESTS) || [];
    },
    // Tour Logic
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
        const date = document.getElementById('new-tour-date').value;
        const price = +document.getElementById('new-tour-price').value;
        const dr = document.getElementById('new-tour-driver').value, gd = document.getElementById('new-tour-guide').value;
        const exp = { driver: +document.getElementById('fee-driver').value, guide: +document.getElementById('fee-guide').value, other: +document.getElementById('fee-other').value };

        if (!dests.length || !date) { alert('Заполните данные'); return; }
        
        let capacity = 18;
        if(dr) { const d = this.staff.find(s=>s.id==dr); if(d && d.capacity) capacity=d.capacity; }
        const tourData = { destinations: dests, date: date.replace('T', ' '), price, driverId: dr, guideId: gd, expenses: exp };

        if (this.editingTourId) {
            Object.assign(this.tours.find(x => x.id == this.editingTourId), tourData);
            DB.save(DB.KEYS.TOURS, this.tours);
            Router.go('screen-details'); UI.renderDetails(this.editingTourId);
        } else {
            let dates = [new Date(date)];
            if (document.getElementById('is-recurring').checked) {
                const days = Array.from(document.querySelectorAll('.day-check.selected')).map(e=>+e.dataset.day);
                if(days.length) { dates=[]; for(let i=0;i<30;i++){ let d=new Date(date); d.setDate(d.getDate()+i); if(days.includes(d.getDay())) dates.push(d); } }
            }
            dates.forEach(d => {
                const offset = d.getTimezoneOffset() * 60000;
                const iso = new Date(d.getTime()-offset).toISOString().slice(0,16).replace('T',' ');
                this.tours.push({ id: Date.now()+Math.random(), ...tourData, date: iso, seats: Array(capacity).fill({ status: 'free' }) });
            });
            DB.save(DB.KEYS.TOURS, this.tours); Router.go('screen-tours');
        }
    },
    // Locations Logic (Updated)
    addDestInput() {
        const c=document.getElementById('destinations-container'); const w=document.createElement('div'); w.className='ios-input-cell'; w.style.padding='0'; w.style.border='none';
        const s=document.createElement('select'); s.className='dest-select ios-input-cell'; s.innerHTML='<option value="">-- Локация --</option>';
        Data.dests.forEach(d=>{const o=document.createElement('option'); o.value=d.name; o.innerText=d.name; s.appendChild(o)});
        w.appendChild(s); c.appendChild(w);
    },
    addDestinationToDb() {
        const name = document.getElementById('new-dest-name').value;
        const desc = document.getElementById('new-dest-desc').value;
        if(name) {
            this.dests.push({ name, desc });
            DB.save(DB.KEYS.DESTS, this.dests);
            document.getElementById('new-dest-name').value = ''; document.getElementById('new-dest-desc').value = '';
            UI.renderDestListDb();
        }
    },
    // Booking Logic
    saveBooking() {
        const name = document.getElementById('book-name').value;
        const phone = document.getElementById('book-phone').value;
        const count = +document.getElementById('book-count').innerText;
        const status = document.getElementById('book-paid-switch').checked ? 'taken' : 'pending';
        const t = this.tours.find(x => x.id == window.currentTourId);
        
        if (!name) { alert('Введите имя'); return; }
        let agentId = window.currentUserRole === 'agent' ? this.staff.find(s=>s.role==='agent')?.id : null;

        if (t.seats[window.currentSeatIndex].status !== 'free' && !window.isGroupAddMode) {
            const oldSt = t.seats[window.currentSeatIndex].status;
            t.seats[window.currentSeatIndex] = { ...t.seats[window.currentSeatIndex], name, phone, status };
            if (status === 'taken' && oldSt !== 'taken') this.handlePayment(t, t.price, agentId);
        } else {
            let found=0, idxs=[];
            if (t.seats[window.currentSeatIndex].status === 'free') { idxs.push(window.currentSeatIndex); found++; }
            if (count > 1) { for (let i=0; i<t.seats.length; i++) if (found<count && i!==window.currentSeatIndex && t.seats[i].status === 'free') { idxs.push(i); found++; } }
            if (found < count) { alert('Нет мест'); return; }
            idxs.forEach(i => { t.seats[i]={status, name, phone, agentId}; if(status==='taken') this.handlePayment(t, t.price, agentId); });
        }
        DB.save(DB.KEYS.TOURS, this.tours); App.closeBookingModal(); UI.renderDetails(t.id);
    },
    handlePayment(tour, amount, agentId) {
        if (!agentId) {
            const id = tour.guideId || tour.driverId;
            if (id) { const s = this.staff.find(x => x.id == id); if (s) { s.balance = (s.balance || 0) + amount; DB.save(DB.KEYS.STAFF, this.staff); }}
        }
    },
    cancelBooking() {
        const t = this.tours.find(x => x.id == window.currentTourId);
        if (confirm('Удалить?')) { t.seats[window.currentSeatIndex] = { status: 'free' }; DB.save(DB.KEYS.TOURS, this.tours); App.closeBookingModal(); UI.renderDetails(t.id); }
    },
    // ... Other logic same as v15 ...
    editCurrentTour() { /* ... */ const t=this.tours.find(x=>x.id==window.currentTourId); this.editingTourId=t.id; document.getElementById('tour-form-title').innerText='Редактирование'; document.getElementById('destinations-container').innerHTML=''; t.destinations.forEach(d=>{const w=document.createElement('div'); w.className='ios-input-cell'; w.style.padding='0'; w.style.border='none'; const s=document.createElement('select'); s.className='dest-select ios-input-cell'; Data.dests.forEach(ov=>{const o=document.createElement('option');o.value=ov.name;o.innerText=ov.name;if(ov.name===d)o.selected=true;s.appendChild(o)}); w.appendChild(s); document.getElementById('destinations-container').appendChild(w);}); document.getElementById('new-tour-date').value=t.date.replace(' ','T'); document.getElementById('new-tour-price').value=t.price; document.getElementById('new-tour-driver').value=t.driverId; document.getElementById('new-tour-guide').value=t.guideId; document.getElementById('fee-driver').value=t.expenses.driver; document.getElementById('fee-guide').value=t.expenses.guide; document.getElementById('fee-other').value=t.expenses.other; UI.renderStaffOptions(); Router.go('screen-add-tour'); },
    makeDeposit() { const amt = +document.getElementById('deposit-amount').value; const id = window.depositGuideId; if(amt && id) { const s=this.staff.find(x=>x.id==id); s.balance-=amt; DB.save(DB.KEYS.STAFF, this.staff); document.getElementById('modal-deposit').classList.remove('open'); UI.renderReportStats(); } },
    saveEmployee() { const n=document.getElementById('emp-name').value, p=document.getElementById('emp-phone').value, r=document.getElementById('emp-role').value, c=+document.getElementById('emp-capacity').value; if(!n) return; if(Data.editingStaffId) { const s=Data.staff.find(x=>x.id==Data.editingStaffId); s.name=n; s.phone=p; s.role=r; s.capacity=c; } else { Data.staff.push({id:Date.now(), name:n, phone:p, role:r, capacity:c, balance:0}); } DB.save(DB.KEYS.STAFF, Data.staff); App.closeEmployeeModal(); UI.renderStaff(); }
};

/* --- UI --- */
const UI = {
    calDate: new Date(),
    renderCalendar() {
        const c=document.getElementById('calendar-widget'); c.innerHTML='';
        const m=this.calDate.getMonth(), y=this.calDate.getFullYear();
        document.getElementById('cal-month-year').innerText = `${m+1}.${y}`;
        const days=new Date(y, m+1, 0).getDate(), start=new Date(y, m, 1).getDay(), off=start===0?6:start-1;
        for(let i=0;i<off;i++)c.appendChild(document.createElement('div'));
        for(let i=1;i<=days;i++){
            const d=document.createElement('div'); d.className='cal-day'; d.innerText=i;
            const match=`${y}-${(m+1).toString().padStart(2,'0')}-${i<10?'0'+i:i}`;
            if(Data.tours.some(t=>t.date.startsWith(match))) d.classList.add('has-tour');
            if(i===new Date().getDate()&&m===new Date().getMonth())d.classList.add('today');
            d.onclick=()=>UI.openDayModal(match, Data.tours.filter(t=>t.date.startsWith(match)));
            c.appendChild(d);
        }
    },
    changeMonth(d){ this.calDate.setMonth(this.calDate.getMonth()+d); this.renderCalendar(); },
    openDayModal(dateStr, tours) {
        document.getElementById('day-modal-title').innerText = dateStr.split('-').reverse().join('.');
        const list = document.getElementById('day-tours-list'); list.innerHTML='';
        if(tours.length===0) list.innerHTML='<p style="text-align:center;color:#999">Нет рейсов</p>';
        tours.forEach(t=>{
            const row=document.createElement('div'); row.className='ios-list-item';
            row.innerHTML=`<div><b>${t.destinations[0]}</b></div><span>${t.date.slice(11,16)}</span>`;
            row.onclick=()=>{window.currentTourId=t.id;UI.renderDetails(t.id);Router.go('screen-details');document.getElementById('modal-day-details').classList.remove('open');document.getElementById('modal-calendar').classList.remove('open');};
            list.appendChild(row);
        });
        document.getElementById('btn-create-on-date').onclick=()=>{Data.prepareCreateTour(dateStr);document.getElementById('modal-day-details').classList.remove('open');document.getElementById('modal-calendar').classList.remove('open');};
        document.getElementById('modal-day-details').classList.add('open');
    },
    renderTours() {
        const list = document.getElementById('tours-list'); list.innerHTML='';
        Data.tours.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t => {
            const taken = t.seats.filter(s=>s.status!=='free').length;
            const d = document.createElement('div'); d.className='tour-card';
            d.innerHTML = `
                <div class="tour-left"><div class="date-box"><span class="db-day">${t.date.slice(8,10)}</span><span class="db-mon">${t.date.slice(5,7)}</span></div>
                <div class="tour-info"><h4>${t.destinations[0]}</h4><span class="tour-meta">${t.seats.length} мест • ${t.price}с</span></div></div>
                <div class="tour-stat ${taken===t.seats.length?'full':''}">${taken}/${t.seats.length}</div>
            `;
            d.onclick = () => { window.currentTourId=t.id; UI.renderDetails(t.id); Router.go('screen-details'); };
            list.appendChild(d);
        });
    },
    renderDetails(id) {
        const t = Data.tours.find(x=>x.id==id);
        document.getElementById('detail-title').innerText = t.destinations[0];
        document.getElementById('detail-date').innerText = t.date;
        const taken=t.seats.filter(s=>s.status==='taken').length;
        const inc=taken*t.price, exp=t.expenses.driver+t.expenses.guide+t.expenses.other;
        document.getElementById('detail-income').innerText=inc; document.getElementById('detail-expense').innerText=exp;
        document.getElementById('detail-progress').style.width=Math.min((inc/exp)*100,100)+'%';
        const g=document.getElementById('detail-grid'); g.innerHTML='';
        t.seats.forEach((s,i)=>{
            const d=document.createElement('div'); d.className=`seat-sm ${s.status}`; d.innerText=i+1;
            d.onclick=()=>App.openBookingModal(i,s); g.appendChild(d);
        });
        const pl=document.getElementById('passenger-list-container'); pl.innerHTML='';
        t.seats.forEach((s,i)=>{ if(s.status!=='free'){const r=document.createElement('div');r.className='ios-list-item';r.innerHTML=`<div><b>${i+1}. ${s.name}</b></div><span>${s.status==='taken'?'✅':'⏳'}</span>`;pl.appendChild(r);} });
    },
    renderDestListDb() {
        const l=document.getElementById('dest-list-db'); l.innerHTML='';
        Data.dests.forEach(d=>{ const r=document.createElement('div'); r.className='ios-list-item'; r.innerHTML=`<b>${d.name}</b><br><small style="color:#888">${d.desc||''}</small>`; l.appendChild(r); });
    },
    renderStaff() {
        const l=document.getElementById('staff-list'); l.innerHTML='';
        Data.staff.forEach(s=>{
            const r=document.createElement('div'); r.className='ios-list-item';
            const ico={driver:'🚌',guide:'🚩',agent:'🤝'}[s.role];
            r.innerHTML=`<div class="staff-info"><div class="role-badge ${s.role==='driver'?'rb-driver':s.role==='guide'?'rb-guide':'rb-agent'}">${ico}</div><div><b>${s.name}</b><br><small>${s.phone}</small></div></div><button class="btn-text" onclick="App.openEmployeeModal(${s.id})">✎</button>`;
            l.appendChild(r);
        });
    },
    renderStaffOptions(){const d=document.getElementById('new-tour-driver'),g=document.getElementById('new-tour-guide');d.innerHTML='<option value="">Водитель</option>';g.innerHTML='<option value="">Гид</option>';Data.staff.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.innerText=s.name;if(s.role==='driver')d.appendChild(o);if(s.role==='guide')g.appendChild(o);})},
    renderReportStats(){ /* ... same as v16 ... */ 
        let net=0, cash=0; Data.tours.forEach(t=>{const taken=t.seats.filter(s=>s.status==='taken').length; net+=(taken*t.price)-(t.expenses.driver+t.expenses.guide+t.expenses.other);});
        cash=Data.staff.reduce((s,x)=>s+(x.balance||0),0); document.getElementById('rep-net').innerText=net+' c'; document.getElementById('rep-cash-hands').innerText=cash+' c'; document.getElementById('rep-cash-safe').innerText=(net-cash)+' c';
    },
    showReportDetail(type){
        const l=document.getElementById('report-detail-list'); l.innerHTML='';
        if(type==='guide'){Data.staff.filter(s=>s.balance>0).forEach(s=>{const r=document.createElement('div');r.className='ios-list-item';r.innerHTML=`<div>${s.name}</div><div><b>${s.balance}</b> <button class="btn-small" onclick="App.openDepositModal(${s.id})">Принять</button></div>`;l.appendChild(r)})}
        document.getElementById('modal-report-detail').classList.add('open');
    }
};

/* --- APP --- */
const App = {
    init() {
        DB.init(); Data.loadAll();
        document.getElementById('btn-login-action').addEventListener('click', App.login);
        if(sessionStorage.getItem('logged')) Router.go('screen-tours');
    },
    login() {
        const p=document.getElementById('login-pass').value;
        if(p==='123'){sessionStorage.setItem('logged','true'); window.currentUserRole='admin'; Router.go('screen-tours');}
        else if(p==='000'){sessionStorage.setItem('logged','true'); window.currentUserRole='agent'; Router.go('screen-tours');}
        else alert('Error');
    },
    logout() { sessionStorage.removeItem('logged'); location.reload(); },
    toggleSidebar() { 
        const sb = document.getElementById('sidebar'), ov = document.getElementById('sidebar-overlay');
        if(sb.classList.contains('open')) { sb.classList.remove('open'); ov.classList.remove('open'); }
        else { sb.classList.add('open'); ov.classList.add('open'); }
    },
    // Modals
    openDestModal(){UI.renderDestListDb(); document.getElementById('modal-destinations').classList.add('open'); App.toggleSidebar();},
    openCalendarModal(){UI.renderCalendar(); document.getElementById('modal-calendar').classList.add('open');},
    openBookingModal(idx,s){window.currentSeatIndex=idx; const isEdit=s.status!=='free'; window.isGroupAddMode=!isEdit; document.getElementById('modal-book-title').innerText=isEdit?`Место ${idx+1}`:'Бронь'; document.getElementById('book-name').value=s.name||''; document.getElementById('book-phone').value=s.phone||''; document.getElementById('book-paid-switch').checked=s.status==='taken'; document.getElementById('btn-cancel-booking').style.display=isEdit?'block':'none'; document.getElementById('modal-booking').classList.add('open');},
    closeBookingModal(){document.getElementById('modal-booking').classList.remove('open')},
    changeSeatCount(d){const e=document.getElementById('book-count'); let v=+e.innerText+d; if(v>0&&v<10)e.innerText=v;},
    openEmployeeModal(id){Data.editingStaffId=id; const n=document.getElementById('emp-name'), p=document.getElementById('emp-phone'), r=document.getElementById('emp-role'); if(id){const s=Data.staff.find(x=>x.id==id);n.value=s.name;p.value=s.phone;r.value=s.role;}else{n.value='';p.value='';r.value='driver';} App.toggleCapacityField(); document.getElementById('modal-employee').classList.add('open');},
    closeEmployeeModal(){document.getElementById('modal-employee').classList.remove('open')},
    toggleCapacityField(){const r=document.getElementById('emp-role').value; document.getElementById('emp-capacity').style.display=r==='driver'?'block':'none';},
    toggleRecurring(){const c=document.getElementById('is-recurring').checked; document.getElementById('recurring-days').style.display=c?'block':'none';},
    openDepositModal(id){window.depositGuideId=id; document.getElementById('deposit-amount').value=''; document.getElementById('modal-deposit').classList.add('open');},
    openStoryModal(){document.getElementById('modal-story').classList.add('open')},
    openWaModal(){document.getElementById('modal-whatsapp').classList.add('open')},
    generateManifest(){alert('Скопировано')}, copyWaText(){/*...*/}, setWaTemplate(){/*...*/}
};

const Router = {
    go(id) {
        document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        const sb = document.getElementById('sidebar');
        if(sb.classList.contains('open')) App.toggleSidebar();
        
        if(id==='screen-tours') UI.renderTours();
        if(id==='screen-staff') UI.renderStaff();
        if(id==='screen-reports') UI.renderReportStats();
        
        // Admin check
        const isAgent = window.currentUserRole === 'agent';
        document.querySelectorAll('.admin-only').forEach(e => e.style.display = isAgent ? 'none' : 'block');
    }
};
document.addEventListener('DOMContentLoaded', App.init);

const View = {
    calDate: new Date(),
    formatDate(iso) { 
        if(!iso) return ''; 
        const d = new Date(iso); 
        return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`; 
    },
    
    // РЕНДЕР ОТЧЕТОВ (ОБНОВЛЕНО)
    showReportDetail(type){ 
        const l = document.getElementById('report-detail-list'); 
        if(!l) return;
        l.innerHTML = ''; 
        
        const staff = DB.load(DB.KEYS.STAFF);
        const tours = DB.load(DB.KEYS.TOURS);

        // --- ДЕТАЛИЗАЦИЯ ПО ГИДАМ ---
        if(type === 'guide'){
            const guides = staff.filter(s => s.role === 'guide');
            let hasDebts = false;

            guides.forEach(guide => {
                // Если баланс 0 и нет активных туров, пропускаем (чтобы не засорять список)
                if(guide.balance <= 0) return; 

                hasDebts = true;
                let passengerDetails = '';

                // Ищем туры этого гида
                tours.forEach(t => {
                    if(t.guideId == guide.id) {
                        // Ищем пассажиров с наличкой в этом туре
                        const cashPax = t.seats.filter(s => 
                            (s.status === 'taken' || s.status === 'partial') && 
                            s.method === 'cash'
                        );

                        if(cashPax.length > 0) {
                            passengerDetails += `<div style="margin-top:8px; padding-top:8px; border-top:1px solid #333; font-size:12px;">
                                <div style="color:#888; margin-bottom:4px;">🚌 ${t.destinations[0]} (${View.formatDate(t.date)})</div>`;
                            
                            cashPax.forEach(p => {
                                const amt = p.status === 'taken' ? t.price : t.price / 2;
                                passengerDetails += `<div style="display:flex; justify-content:space-between; color:#ccc;">
                                    <span>👤 ${p.name}</span>
                                    <span>+${amt} с</span>
                                </div>`;
                            });
                            passengerDetails += `</div>`;
                        }
                    }
                });

                // Карточка гида
                const r = document.createElement('div');
                r.className = 'list-item';
                r.style.flexDirection = 'column';
                r.style.alignItems = 'stretch';
                r.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="font-size:16px; font-weight:700;">${guide.name}</span>
                        <div style="text-align:right;">
                            <div style="font-size:11px; color:#888;">Долг:</div>
                            <strong class="text-warn" style="font-size:18px;">${guide.balance} с</strong>
                        </div>
                    </div>
                    ${passengerDetails ? passengerDetails : '<div style="font-size:11px; color:#666;">Нет деталей по текущим рейсам (старый долг)</div>'}
                    <button onclick="App.openDepositModal(${guide.id})" style="margin-top:10px; width:100%; background:#333; color:white; border:none; padding:10px; border-radius:8px; font-weight:600;">ПРИНЯТЬ ОПЛАТУ</button>
                `;
                l.appendChild(r);
            });

            if(!hasDebts) l.innerHTML = '<div style="padding:20px; text-align:center; color:#666">Никто ничего не должен 🎉</div>';
        }

        // --- ДЕТАЛИЗАЦИЯ ПРИБЫЛИ ---
        if(type === 'net'){
            tours.sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(t => {
                const inc = t.seats.reduce((s,x)=>s+(x.status==='taken'?t.price:x.status==='partial'?t.price/2:0),0); 
                const exp = t.expenses.driver+t.expenses.guide+t.expenses.other; 
                const prof = inc - exp; 
                
                const r = document.createElement('div');
                r.className = 'list-item';
                r.style.justifyContent = 'space-between';
                r.innerHTML = `
                    <div>
                        <b>${t.destinations[0]}</b> <span style="color:#666; font-size:12px;">${View.formatDate(t.date)}</span>
                        <div style="font-size:11px; color:#888;">Выр: ${inc} - Расх: ${exp}</div>
                    </div>
                    <b class="${prof>=0?'text-ok':'text-warn'}">${prof > 0 ? '+' : ''}${prof}</b>
                `;
                l.appendChild(r);
            });
        }

        // --- ДЕТАЛИЗАЦИЯ ВОДИТЕЛЕЙ ---
        if(type === 'driver'){
            tours.forEach(t => {
                if(t.expenses.driver > 0) {
                    // Ищем имя водителя
                    const drName = staff.find(s=>s.id == t.driverId)?.name || 'Неизвестный';
                    const r = document.createElement('div');
                    r.className = 'list-item';
                    r.style.justifyContent = 'space-between';
                    r.innerHTML = `
                        <div>
                            <b>${drName}</b> <br>
                            <span style="color:#666; font-size:12px;">${t.destinations[0]} (${View.formatDate(t.date)})</span>
                        </div>
                        <b style="color:#fff;">${t.expenses.driver} с</b>
                    `;
                    l.appendChild(r);
                }
            });
        }

        document.getElementById('modal-report-detail').classList.add('open'); 
    },

    // ОСТАЛЬНЫЕ ФУНКЦИИ (БЕЗ ИЗМЕНЕНИЙ)
    renderReportStats(){
        const container = document.getElementById('fin-methods-list');
        if(!container) return; container.innerHTML = '';
        let net=0, cash=0; const tours = DB.load(DB.KEYS.TOURS);
        const stats = { mbank:0, optima:0, obank:0, cash:0 };

        tours.forEach(t => {
            const exp = t.expenses.driver + t.expenses.guide + t.expenses.other;
            let income = 0;
            t.seats.forEach(s => {
                let amount = 0;
                if(s.status === 'taken') amount = t.price;
                else if(s.status === 'partial') amount = t.price / 2;
                if(amount > 0) {
                    income += amount;
                    const method = s.method || 'cash';
                    if(stats[method] !== undefined) stats[method] += amount; else stats['cash'] += amount;
                }
            });
            net += (income - exp);
        });
        
        cash = DB.load(DB.KEYS.STAFF).reduce((s,x)=>s+(x.balance||0),0);
        document.getElementById('rep-net').innerText=net+' с'; 
        document.getElementById('rep-cash-hands').innerText=cash+' с'; 
        document.getElementById('rep-cash-safe').innerText=(net-cash)+' с';

        const labels = {mbank:'Mbank', optima:'Optima', obank:'O!Bank', cash:'Наличные'};
        for (const [key, val] of Object.entries(stats)) {
            if(val > 0) {
                const r = document.createElement('div'); r.className = 'report-row';
                r.innerHTML = `<span>${labels[key] || key}</span><strong class="text-ok">${val} с</strong>`;
                container.appendChild(r);
            }
        }
        
        // Top Tours List
        const list = document.getElementById('top-tours-list'); 
        if(list) {
            list.innerHTML='';
            const prof = tours.map(t=>{ 
                const inc = t.seats.reduce((sum,s)=>sum+(s.status==='taken'?t.price:(s.status==='partial'?t.price/2:0)),0); 
                const exp = t.expenses.driver+t.expenses.guide+t.expenses.other; 
                return {name:t.destinations[0], profit: inc-exp}; 
            }).sort((a,b)=>b.profit-a.profit).slice(0,5);
            
            prof.forEach(p=>{ 
                const r=document.createElement('div'); 
                r.className='report-row'; 
                r.innerHTML=`<span>${p.name}</span><strong class="text-ok">+${p.profit}</strong>`; 
                list.appendChild(r); 
            });
        }
    },

    renderDetails(t) {
        if(!t) return;
        document.getElementById('detail-title').innerText=t.destinations[0]; 
        document.getElementById('detail-date').innerText=this.formatDate(t.date);
        
        const taken=t.seats.filter(s=>s.status!=='free').length;
        const income = t.seats.reduce((sum, s) => sum + (s.status==='taken'?t.price:(s.status==='partial'?t.price/2:0)), 0);
        const exp=t.expenses.driver+t.expenses.guide+t.expenses.other;
        const percent = Math.min(Math.round((income / exp) * 100), 100) || 0;
        
        document.getElementById('detail-income').innerText=income; document.getElementById('detail-expense').innerText=exp;
        document.getElementById('be-percent').innerText=`${percent}%`; document.getElementById('be-bar-fill').style.width=`${percent}%`;
        
        // --- COMPACT BUS LAYOUT ---
        const g = document.getElementById('detail-grid'); 
        if(g) {
            g.innerHTML = '';
            const wrapper = document.createElement('div');
            wrapper.className = 'bus-layout-car';
            wrapper.innerHTML = '<div class="driver-zone">ВОДИТЕЛЬ</div>';
            const grid = document.createElement('div');
            const isSmall = t.seats.length <= 8;
            grid.className = isSmall ? 'bus-grid-compact small' : 'bus-grid-compact';
            t.seats.forEach((s,i) => {
                const d = document.createElement('div');
                d.className = `seat-sm ${s.status}`;
                d.innerText = i+1;
                d.onclick = () => App.openBookingModal(i, s);
                grid.appendChild(d);
            });
            wrapper.appendChild(grid);
            g.appendChild(wrapper);
        }
        
        const pl=document.getElementById('passenger-list-container'); 
        if(pl){ 
            pl.innerHTML=''; 
            t.seats.forEach((s,i)=>{
                if(s.status!=='free'){
                    const stText={pending:'ЖДЕТ',partial:'50%',taken:'ОПЛ'}[s.status];
                    const stClass={pending:'pending',partial:'partial',taken:'taken'}[s.status];
                    const r=document.createElement('div');
                    r.className='list-item';
                    r.innerHTML=`<div><b>${i+1}. ${s.name}</b><br><small style="color:#888">${s.phone}</small></div><span class="pay-status ${stClass}">${stText}</span>`;
                    r.onclick=()=>App.openBookingModal(i,s);
                    pl.appendChild(r);
                }
            }); 
        }
    },

    renderLocations(){const l=document.getElementById('locations-list-screen'); l.innerHTML=''; DB.load(DB.KEYS.DESTS).forEach(d=>{const r=document.createElement('div');r.className='tour-card';r.innerHTML=`<div class="tc-info"><h4>${d.name}</h4><span class="tc-meta">${d.desc||''}</span></div>`;r.onclick=()=>{App.openDestModal(d.id)};l.appendChild(r)})}, 
    renderStaff(){const l=document.getElementById('staff-list');l.innerHTML='';const staff=DB.load(DB.KEYS.STAFF);const roles={driver:'ВОДИТЕЛИ',guide:'ГИДЫ',agent:'АГЕНТЫ'};['driver','guide','agent'].forEach(role=>{const g=staff.filter(s=>s.role===role);if(g.length>0){const h=document.createElement('div');h.className='staff-group-header';h.innerText=roles[role];l.appendChild(h);g.forEach(s=>{const r=document.createElement('div');r.className='staff-row';const c=s.role==='agent'?`<br><small style="color:#888">Comm: ${s.commission}%</small>`:'';r.innerHTML=`<div><b>${s.name}</b><br><span style="color:#888;font-size:12px">${s.phone}</span>${c}</div><button class="btn-text" onclick="App.openEmployeeModal(${s.id})">ИЗМ</button>`;l.appendChild(r)})}})}, 
    renderTours(){const list=document.getElementById('tours-list');list.innerHTML='';const tours=DB.load(DB.KEYS.TOURS);const gr={};tours.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t=>{const n=t.destinations[0];if(!gr[n])gr[n]=[];gr[n].push(t)});for(const[n,ts]of Object.entries(gr)){if(ts.length>1){const gd=document.createElement('div');gd.className='tour-group';gd.innerHTML=`<div class="group-header" onclick="this.nextElementSibling.classList.toggle('open')"><span>${n}</span><span class="group-badge">${ts.length}</span></div>`;const c=document.createElement('div');c.className='group-content';ts.forEach(t=>{const tk=t.seats.filter(s=>s.status!=='free').length;const r=document.createElement('div');r.className='tour-row';r.innerHTML=`<span>${View.formatDate(t.date)} ${t.date.slice(11,16)}</span> <span>${tk}/${t.seats.length}</span>`;r.onclick=()=>App.goToTour(t.id);c.appendChild(r)});gd.appendChild(c);list.appendChild(gd)}else{const t=ts[0];const tk=t.seats.filter(s=>s.status!=='free').length;const el=document.createElement('div');el.className='tour-card';el.innerHTML=`<div class="date-box"><span class="db-day">${t.date.slice(8,10)}</span><span class="db-mon">${t.date.slice(5,7)}</span></div><div class="tc-info"><h4>${t.destinations[0]}</h4><span class="tc-meta">${t.seats.length} мест • ${t.price}с</span></div><div class="tc-stat ${tk===t.seats.length?'full':''}">${tk}/${t.seats.length}</div>`;el.onclick=()=>App.goToTour(t.id);list.appendChild(el)}}}, 
    renderTodayTomorrow(){const c=document.getElementById('widget-tt-content');if(!c)return;c.innerHTML='';const tours=DB.load(DB.KEYS.TOURS);const now=new Date();const tmr=new Date(now);tmr.setDate(tmr.getDate()+1);const upc=tours.filter(t=>{const d=new Date(t.date);return d.toDateString()===now.toDateString()||d.toDateString()===tmr.toDateString()}).sort((a,b)=>new Date(a.date)-new Date(b.date));if(upc.length===0){c.innerHTML='<div style="padding:10px;color:#888;text-align:center">Нет выездов</div>';return}upc.forEach(t=>{const tk=t.seats.filter(s=>s.status!=='free').length;const fr=t.seats.length-tk;const div=document.createElement('div');div.className='tt-item';div.innerHTML=`<div style="flex:1"><span class="tt-title">${t.destinations[0]}</span><br><span class="tt-meta">${t.date.slice(11,16)}</span></div><span class="tt-stat ${fr<5?'warn':'ok'}">${fr} своб.</span>`;div.onclick=()=>App.goToTour(t.id);c.appendChild(div)})}, 
    renderStaffOptions(){const d=document.getElementById('new-tour-driver'),g=document.getElementById('new-tour-guide');d.innerHTML='<option value="">Водитель</option>';g.innerHTML='<option value="">Гид</option>';DB.load(DB.KEYS.STAFF).forEach(s=>{const o=document.createElement('option');o.value=s.id;o.innerText=s.name;if(s.role==='driver')d.appendChild(o);if(s.role==='guide')g.appendChild(o)})}, 
    renderTimeOptions(){const s=document.getElementById('new-tour-time-picker');s.innerHTML='';for(let h=5;h<=23;h++){['00','30'].forEach(m=>{const v=`${h<10?'0'+h:h}:${m}`;const o=document.createElement('option');o.value=v;o.innerText=v;if(v==='07:00')o.selected=true;s.appendChild(o)})}}, 
    renderCalendar(){const c=document.getElementById('calendar-widget-modal');c.innerHTML='';const m=this.calDate.getMonth(),y=this.calDate.getFullYear(),d=new Date(y,m+1,0).getDate(),off=new Date(y,m,1).getDay()-1;document.getElementById('cal-month-year-modal').innerText=`${m+1}.${y}`;for(let i=0;i<(off<0?6:off);i++)c.appendChild(document.createElement('div'));const tours=DB.load(DB.KEYS.TOURS);for(let i=1;i<=d;i++){const div=document.createElement('div'),match=`${y}-${String(m+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;div.className='cal-day';div.innerText=i;if(tours.some(t=>t.date.startsWith(match)))div.classList.add('has-tour');div.onclick=()=>{View.openDayModal(match,tours.filter(t=>t.date.startsWith(match)))};c.appendChild(div)}}, 
    changeMonth(d){this.calDate.setMonth(this.calDate.getMonth()+d);this.renderCalendar()}, 
    openDayModal(d,ts){const l=document.getElementById('day-tours-list');l.innerHTML='';if(ts.length===0)l.innerHTML='<p style="text-align:center">НЕТ РЕЙСОВ</p>';ts.forEach(t=>{const r=document.createElement('div');r.className='tour-card';r.innerHTML=`<div><b>${t.destinations[0]}</b></div><span>${this.formatDate(t.date)}</span>`;r.onclick=()=>{App.goToTour(t.id);App.closeModal('modal-day-details');App.closeModal('modal-calendar')};l.appendChild(r)});document.getElementById('btn-create-on-date').onclick=()=>{App.prepareCreateTour(d);App.closeModal('modal-day-details');App.closeModal('modal-calendar')};document.getElementById('modal-day-details').classList.add('open')}, 
    renderNotifications(){const l=document.getElementById('notify-list');l.innerHTML='';const lg=DB.load(DB.KEYS.LOGS)||[];lg.forEach(log=>{const d=document.createElement('div');d.className='notify-item';d.innerHTML=`<div class="notify-text">${log.text}</div><div class="notify-time">${log.time}</div>`;l.appendChild(d)})}, performSearch(){}
};
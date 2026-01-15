const DB = {
    KEYS: { 
        TOURS: 'konok_v68_tours', 
        STAFF: 'konok_v68_staff', 
        DESTS: 'konok_v68_dests', 
        LOGS: 'konok_v68_logs',
        TRANS: 'konok_v68_trans',
        POINTS: 'konok_v68_points'
    },
    
    load(k) { try{return JSON.parse(localStorage.getItem(k))||[]}catch(e){return []} },
    save(k, d) { localStorage.setItem(k, JSON.stringify(d)); },
    clear() { localStorage.clear(); },
    
    init() {
        // Проверка инициализации по наличию сотрудников
        if (!localStorage.getItem(this.KEYS.STAFF)) {
            console.log('KONOK v68: Generating fresh Demo Data...');
            
            const staff = [
                {id:1, name:'Улан', role:'driver', phone:'0777 111 222', capacity:18, balance:0},
                {id:2, name:'Талгат', role:'driver', phone:'0555 333 444', capacity:20, balance:0},
                {id:3, name:'Мирбек', role:'driver', phone:'0700 555 666', capacity:7, balance:0},
                {id:4, name:'Айгуль', role:'guide', phone:'0550 999 000', balance:5000}, 
                {id:5, name:'Kettik', role:'agent', phone:'0312 000 000', commission:10, balance:0}
            ];
            this.save(this.KEYS.STAFF, staff);

            const dests = [
                {id:1, name:'Ала-Арча', desc:'Сбор: 8:00, Филармония.', type:'one_day'},
                {id:2, name:'Иссык-Куль', desc:'Сбор: 7:00, Цирк.', type:'one_day'},
                {id:3, name:'Кель-Суу', desc:'Джип-тур. Сбор: 5:00.', type:'multi_day'},
            ];
            this.save(this.KEYS.DESTS, dests);

            const points = ['Цирк, Южная сторона', 'Филармония', 'ГУМ', 'Вефа Центр'];
            this.save(this.KEYS.POINTS, points);

            const tours = [];
            // Генерируем 3 тура
            for (let i = 0; i < 3; i++) {
                const date = new Date();
                date.setDate(date.getDate() + i + 1); // Завтра, послезавтра...
                const dateStr = date.toISOString().slice(0, 10) + ' 07:00';
                
                // Генерируем места (18 штук)
                const seats = Array(18).fill(null).map(() => ({status:'free'}));
                
                // Заполняем пару мест для примера
                if (i === 0) {
                    seats[0] = {status:'taken', name:'Айбек', phone:'0555 123 456', method:'mbank', isGift:false};
                    seats[1] = {status:'pending', name:'Жаркынай', phone:'0700 987 654', method:'cash', isGift:false};
                }
                
                tours.push({
                    id: Date.now() + i,
                    type: 'std',
                    destinations: [dests[i % dests.length].name],
                    date: dateStr,
                    price: 1500 + (i*100),
                    meetingPoint: points[0],
                    driverId: 1, // Улан
                    guideId: 4,  // Айгуль
                    duration: 1,
                    expenses: { driver: 3000, guide: 2000, other: 500, otherDesc: 'Вода', vipList: [] },
                    seats: seats
                });
            }
            this.save(this.KEYS.TOURS, tours);
        }
    }
};

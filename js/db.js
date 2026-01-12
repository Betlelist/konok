const DB = {
    KEYS: { TOURS: 'konok_v37_tours', STAFF: 'konok_v37_staff', DESTS: 'konok_v37_dests', LOGS: 'konok_v37_logs' },
    load(k) { try{return JSON.parse(localStorage.getItem(k))||[]}catch(e){return []} },
    save(k, d) { localStorage.setItem(k, JSON.stringify(d)); },
    init() {
        if(this.load(this.KEYS.STAFF).length===0) this.save(this.KEYS.STAFF, [
            {id:1,name:'Улан (Stepwgn)',role:'driver',phone:'0777 123 456',capacity:7,balance:0},
            {id:2,name:'Талгат (Спринтер)',role:'driver',phone:'0555 987 654',capacity:20,balance:0},
            {id:3,name:'Мирбек (Альфард)',role:'driver',phone:'0700 111 222',capacity:6,balance:0},
            {id:4,name:'Бакыт (Спринтер)',role:'driver',phone:'0500 333 444',capacity:18,balance:0},
            {id:5,name:'Руслан (Спринтер)',role:'driver',phone:'0222 555 666',capacity:18,balance:0},
            {id:6,name:'Айгуль',role:'guide',phone:'0550 777 888',balance:0},
            {id:7,name:'Азамат',role:'guide',phone:'0707 999 000',balance:0},
            {id:8,name:'Чинара',role:'guide',phone:'0772 123 123',balance:0},
            {id:9,name:'Kettik Partner',role:'agent',phone:'0312 000 000',commission:10,balance:0}
        ]);
        if(this.load(this.KEYS.DESTS).length===0) this.save(this.KEYS.DESTS, [
            {id:1, name:'Ала-Арча',desc:'Сбор: 8:00, Филармония. Дорога 1ч.'},
            {id:2, name:'Иссык-Куль (1 день)',desc:'Сбор: 7:00, Цирк. Дорога 4ч.'},
            {id:3, name:'Каньон Сказка',desc:'Сбор: 6:00, Площадь. Дорога 5ч.'},
            {id:4, name:'Кель-Суу',desc:'Джип-тур. Сбор: 5:00. Нужен пропуск.'},
            {id:5, name:'Сон-Куль',desc:'2 дня. Ночевка в юртах. Сбор: 7:00'},
            {id:6, name:'Чон-Кемин',desc:'Конная прогулка. Сбор: 8:00'},
            {id:7, name:'Башня Бурана',desc:'Сбор: 9:00. Дорога 1.5ч'}
        ]);
        if(this.load(this.KEYS.LOGS).length===0) this.save(this.KEYS.LOGS, []);
    }
};
DB.init();
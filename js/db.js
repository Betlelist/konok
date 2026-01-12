/ Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC8O8kfUQBlTQQUjvDw-kfNfbzMn2KyTGU",
  authDomain: "konok-demo.firebaseapp.com",
  projectId: "konok-demo",
  storageBucket: "konok-demo.firebasestorage.app",
  messagingSenderId: "322973222626",
  appId: "1:322973222626:web:54e6c5fbc0facaf79c40bb"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = firebase.firestore();

const DB = {
    KEYS: { 
        TOURS: 'tours', 
        STAFF: 'staff', 
        DESTS: 'dests', 
        LOGS: 'logs' 
    },
    
    // Локальный кэш, чтобы приложение работало быстро и не зависало
    cache: {
        tours: [],
        staff: [],
        dests: [],
        logs: []
    },

    // 1. ЗАГРУЗКА ДАННЫХ С СЕРВЕРА (Асинхронно)
    async init() {
        console.log('Загрузка данных с сервера...');
        
        try {
            // Загружаем все коллекции параллельно
            const [toursSnap, staffSnap, destsSnap, logsSnap] = await Promise.all([
                db.collection('data').doc('tours').get(),
                db.collection('data').doc('staff').get(),
                db.collection('data').doc('dests').get(),
                db.collection('data').doc('logs').get()
            ]);

            // Если данных нет (первый запуск), создаем их
            if (!toursSnap.exists) await this.seedData();
            else {
                this.cache.tours = toursSnap.data().list || [];
                this.cache.staff = staffSnap.data().list || [];
                this.cache.dests = destsSnap.data().list || [];
                this.cache.logs = logsSnap.data().list || [];
            }
            console.log('Данные загружены!', this.cache);
            return true;
        } catch (error) {
            console.error("Ошибка сети:", error);
            alert("Ошибка загрузки данных. Проверьте интернет!");
            return false;
        }
    },

    // 2. ПОЛУЧЕНИЕ ДАННЫХ (Берем из кэша мгновенно)
    load(key) {
        // Мы мапим длинные ключи 'konok_v36_tours' на короткие 'tours'
        if(key.includes('tours')) return this.cache.tours;
        if(key.includes('staff')) return this.cache.staff;
        if(key.includes('dests')) return this.cache.dests;
        if(key.includes('logs')) return this.cache.logs;
        return [];
    },

    // 3. СОХРАНЕНИЕ ДАННЫХ (Обновляем кэш + отправляем на сервер)
    save(key, data) {
        // 1. Обновляем локальный кэш
        let shortKey = '';
        if(key.includes('tours')) shortKey = 'tours';
        else if(key.includes('staff')) shortKey = 'staff';
        else if(key.includes('dests')) shortKey = 'dests';
        else if(key.includes('logs')) shortKey = 'logs';
        
        if(shortKey) {
            this.cache[shortKey] = data;
            
            // 2. Отправляем в облако (в фоне)
            db.collection('data').doc(shortKey).set({ list: data })
                .then(() => console.log(`Saved ${shortKey}`))
                .catch(err => console.error("Save error", err));
        }
    },

    // Первоначальное заполнение (только один раз)
    async seedData() {
        const initialStaff = [
            {id:1,name:'Улан (Stepwgn)',role:'driver',phone:'0777 123',capacity:7,balance:0},
            {id:2,name:'Талгат (Спринтер)',role:'driver',phone:'0555 987',capacity:20,balance:0},
            {id:6,name:'Айгуль',role:'guide',phone:'0550 777',balance:0},
            {id:9,name:'Partner',role:'agent',phone:'0312 00',commission:10,balance:0}
        ];
        const initialDests = [
            {id:1, name:'Ала-Арча',desc:'Сбор: 8:00, Филармония'},
            {id:2, name:'Иссык-Куль',desc:'Сбор: 7:00, Цирк'}
        ];

        this.cache.staff = initialStaff;
        this.cache.dests = initialDests;
        this.cache.tours = [];
        this.cache.logs = [];

        await Promise.all([
            db.collection('data').doc('staff').set({ list: initialStaff }),
            db.collection('data').doc('dests').set({ list: initialDests }),
            db.collection('data').doc('tours').set({ list: [] }),
            db.collection('data').doc('logs').set({ list: [] })
        ]);
    }
};

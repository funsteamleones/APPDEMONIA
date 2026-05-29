/* =========================================
   DATABASE SIMULATION (localStorage)
   ========================================= */

// Iniciar base de datos si no existe
function initDB() {
    if (!localStorage.getItem('club_users')) {
        // Crear un usuario administrador por defecto
        const defaultUsers = [
            { id: '1', name: 'Admin Club', dni: 'admin', password: 'admin', role: 'admin' }
        ];
        localStorage.setItem('club_users', JSON.stringify(defaultUsers));
    }
}

// Obtener todos los usuarios
function getUsers() {
    return JSON.parse(localStorage.getItem('club_users')) || [];
}

// Guardar usuarios
function saveUsers(users) {
    localStorage.setItem('club_users', JSON.stringify(users));
}

// Obtener usuario logueado actualmente
function getCurrentUser() {
    const userStr = localStorage.getItem('club_current_user');
    return userStr ? JSON.parse(userStr) : null;
}

// =========================================
// AUTHENTICATION LOGIC
// =========================================

function toggleAuthForm(formId) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(`${formId}-form`).classList.add('active');
    
    // Clear errors
    document.getElementById('login-error').innerText = '';
    document.getElementById('reg-error').innerText = '';
    document.getElementById('reg-success').innerText = '';
}

function register() {
    const name = document.getElementById('reg-name').value.trim();
    const dni = document.getElementById('reg-dni').value.trim();
    const password = document.getElementById('reg-password').value;
    const errorEl = document.getElementById('reg-error');
    const successEl = document.getElementById('reg-success');

    errorEl.innerText = '';
    successEl.innerText = '';

    if (!name || !dni || !password) {
        errorEl.innerText = 'Por favor completa todos los campos.';
        return;
    }

    const badWords = ['puto', 'mierda', 'concha', 'verga', 'pija', 'boludo', 'pelotudo', 'idiota', 'estupido'];
    const lowerName = name.toLowerCase();
    if (badWords.some(word => lowerName.includes(word))) {
        errorEl.innerText = 'El nombre contiene palabras no permitidas.';
        return;
    }

    if (!/^\d+$/.test(dni)) {
        errorEl.innerText = 'El DNI debe contener solo números.';
        return;
    }

    if (dni.length < 7 || dni.length > 9) {
        errorEl.innerText = 'El DNI debe tener entre 7 y 9 números.';
        return;
    }

    // Validate reCAPTCHA
    const recaptchaResponse = typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : '';
    if (!recaptchaResponse) {
        errorEl.innerText = 'Por favor completá el captcha.';
        return;
    }

    const users = getUsers();
    
    // Verificar si ya existe
    if (users.find(u => u.dni === dni)) {
        errorEl.innerText = 'El DNI ingresado ya está registrado.';
        return;
    }

    // Crear nuevo usuario
    const newUser = {
        id: Date.now().toString(),
        name: name,
        dni: dni,
        password: password,
        role: 'socio'
    };

    users.push(newUser);
    saveUsers(users);

    successEl.innerText = '¡Registro exitoso! Ya puedes iniciar sesión.';
    
    // Limpiar campos
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-dni').value = '';
    document.getElementById('reg-password').value = '';
    if (typeof grecaptcha !== 'undefined') grecaptcha.reset();

    // Cambiar al form de login tras un breve delay
    setTimeout(() => {
        toggleAuthForm('login');
        document.getElementById('login-dni').value = dni;
    }, 1500);
}

function login() {
    const dni = document.getElementById('login-dni').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.innerText = '';

    if (!dni || !password) {
        errorEl.innerText = 'Ingresa DNI y contraseña.';
        return;
    }

    const users = getUsers();
    // En caso de duplicados por pruebas viejas, tomar el último creado
    const matchingUsers = users.filter(u => u.dni === dni && u.password === password);
    const user = matchingUsers[matchingUsers.length - 1];

    if (user) {
        if (user.status === 'baja') {
            alert('❌ Tu cuenta ha sido dada de baja o suspendida por la administración.');
            // Aún así los dejamos entrar para que vean el carnet rojo como pidió el usuario,
            // pero con el alert queda clarísimo.
        }
        // Login exitoso
        localStorage.setItem('club_current_user', JSON.stringify(user));
        document.getElementById('login-password').value = '';
        checkAuthAndRender();
    } else {
        errorEl.innerText = 'DNI o contraseña incorrectos.';
    }
}

function logout() {
    localStorage.removeItem('club_current_user');
    checkAuthAndRender();
}

function checkAuthAndRender() {
    let currentUser = getCurrentUser();
    
    // Refresh user data from DB to ensure we have latest status
    if (currentUser) {
        const users = getUsers();
        const freshUser = users.find(u => u.id === currentUser.id);
        if (freshUser) {
            currentUser = freshUser;
            localStorage.setItem('club_current_user', JSON.stringify(currentUser));
        } else {
            // User was hard deleted
            logout();
            return;
        }
    }

    const authLayer = document.getElementById('auth-layer');
    const appLayer = document.getElementById('app-layer');

    if (currentUser) {
        // User is logged in
        authLayer.classList.remove('active');
        setTimeout(() => { authLayer.style.display = 'none'; }, 300);
        
        appLayer.style.display = 'flex';
        
        // Populate user data and notifications
        populateUserData(currentUser);
        renderNotifications();
        
        // Handle admin features
        const adminBtns = document.querySelectorAll('.admin-only');
        if (currentUser.role === 'admin') {
            adminBtns.forEach(btn => btn.style.display = 'flex');
            refreshAdminTable();
        } else {
            adminBtns.forEach(btn => btn.style.display = 'none');
        }

        // Navigate to default
        navigate('inicio');
        
        // Check for tutorial
        checkTutorial(currentUser.id);
    } else {
        // Not logged in
        appLayer.style.display = 'none';
        authLayer.style.display = 'flex';
        // force reflow
        void authLayer.offsetWidth;
        authLayer.classList.add('active');
        toggleAuthForm('login');
    }
}

function populateUserData(user) {
    // Header
    document.getElementById('user-greeting').innerText = `Hola, ${user.name.split(' ')[0]}`;
    document.getElementById('user-socio-id').innerText = `Socio #${user.id.slice(-5)}`;
    
    // Generar avatar por iniciales
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=16a34a&color=fff`;
    document.getElementById('user-avatar').src = avatarUrl;

    // Carnet
    document.getElementById('carnet-name').innerText = user.name;
    document.getElementById('carnet-dni').innerText = `• DNI ${user.dni}`;
    
    // Status Badge & Carnet Color
    let statusBadge = document.getElementById('carnet-status');
    if (!statusBadge) {
        // Fallback for when the user hasn't hard-reloaded the HTML
        statusBadge = document.querySelector('.carnet-card .status-badge');
    }
    const carnetCard = document.querySelector('.carnet-card');

    if (user.status === 'baja') {
        if (statusBadge) {
            statusBadge.innerText = 'INACTIVO';
            statusBadge.classList.add('inactive');
            statusBadge.classList.remove('active');
        }
        if (carnetCard) {
            carnetCard.classList.add('inactive');
        }
    } else {
        if (statusBadge) {
            statusBadge.innerText = 'ACTIVO';
            statusBadge.classList.add('active');
            statusBadge.classList.remove('inactive');
        }
        if (carnetCard) {
            carnetCard.classList.remove('inactive');
        }
    }

    // Render Activities in Dashboard
    const activitiesList = document.getElementById('dashboard-activities-list');
    if (activitiesList) {
        if (!user.activities || user.activities.length === 0) {
            activitiesList.innerHTML = '<p style="color: var(--text-muted); font-size: 0.9rem; padding: 16px;">No estás inscripto en ninguna actividad aún. ¡Ve a la pestaña Horarios para sumarte!</p>';
        } else {
            activitiesList.innerHTML = '';
            user.activities.forEach(act => {
                activitiesList.innerHTML += `
                    <div class="activity-card">
                        <div class="activity-icon ${act.color}">
                            <i class="ph-fill ${act.icon}"></i>
                        </div>
                        <div class="activity-details">
                            <h3>${act.name}</h3>
                            <p>${act.time}</p>
                        </div>
                    </div>
                `;
            });
        }
    }

    updateEnrollButtons(user);
}

function updateEnrollButtons(user) {
    const buttons = document.querySelectorAll('.btn-enroll');
    const userActivities = user.activities || [];
    const enrolledNames = userActivities.map(act => act.name);

    buttons.forEach(btn => {
        const detailsDiv = btn.previousElementSibling;
        if (detailsDiv && detailsDiv.querySelector('h4')) {
            const actName = detailsDiv.querySelector('h4').innerText.trim();
            if (enrolledNames.includes(actName)) {
                btn.innerHTML = '<i class="ph-fill ph-check-circle"></i> Inscripto';
                btn.disabled = true;
                btn.style.backgroundColor = '#94a3b8';
                btn.style.borderColor = '#94a3b8';
                btn.style.color = '#ffffff';
                btn.style.cursor = 'not-allowed';
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.gap = '6px';
            } else {
                btn.innerText = 'Inscribirme';
                btn.disabled = false;
                btn.style.backgroundColor = '';
                btn.style.borderColor = '';
                btn.style.color = '';
                btn.style.cursor = 'pointer';
                btn.style.display = '';
                btn.style.alignItems = '';
                btn.style.justifyContent = '';
                btn.style.gap = '';
            }
        }
    });
}

// =========================================
// NAVIGATION LOGIC
// =========================================

function navigate(viewId) {
    // 1. Hide all views
    const views = document.querySelectorAll('.view');
    views.forEach(view => {
        view.classList.remove('active');
    });

    // 2. Show target view
    const targetView = document.getElementById(`view-${viewId}`);
    if (targetView) {
        targetView.classList.add('active');
        document.getElementById('main-content').scrollTop = 0;
    }

    // 3. Update sidebar UI
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if (item.dataset.target === viewId) {
            item.classList.add('active');
            const icon = item.querySelector('i');
            if (icon) icon.className = icon.className.replace('ph ', 'ph-fill ');
        } else {
            item.classList.remove('active');
            const icon = item.querySelector('i');
            if (icon) icon.className = icon.className.replace('ph-fill ', 'ph ');
        }
    });

    // 4. Update mobile bottom nav UI
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        if (item.dataset.target === viewId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Refresh data if needed
    if (viewId === 'admin') {
        refreshAdminTable();
    }
}

// =========================================
// ADMIN LOGIC
// =========================================

function refreshAdminTable() {
    const users = getUsers();
    const tbody = document.getElementById('admin-users-list');
    
    if (!tbody) return;

    tbody.innerHTML = '';

    users.forEach(u => {
        const tr = document.createElement('tr');
        const isBaja = u.status === 'baja';
        const tagClass = u.role === 'admin' ? 'tag-active' : (isBaja ? 'tag-inactive' : 'tag-active');
        const statusText = u.role === 'admin' ? 'Administrador' : (isBaja ? 'De Baja' : 'Activo');
        
        // Evitar borrar al admin
        const deleteBtn = u.role === 'admin' ? '' : 
            (isBaja ? '' : `<button class="btn-delete" onclick="deleteUser('${u.id}')" title="Dar de baja"><i class="ph ph-trash"></i></button>`);

        tr.innerHTML = `
            <td>#${u.id.slice(-5)}</td>
            <td><strong>${u.name}</strong></td>
            <td>${u.dni}</td>
            <td><span class="${tagClass}">${statusText}</span></td>
            <td>${deleteBtn}</td>
        `;
        tbody.appendChild(tr);
    });
}

function deleteUser(id) {
    if (confirm('¿Estás seguro de que deseas dar de baja a este socio?')) {
        let users = getUsers();
        const userIndex = users.findIndex(u => u.id === id);
        if (userIndex > -1) {
            users[userIndex].status = 'baja'; // Soft delete
            saveUsers(users);
            refreshAdminTable();
        }
    }
}

function resetDB() {
    if (confirm('⚠️ PELIGRO: Esto borrará todos los socios registrados y restaurará la base de datos a cero. ¿Deseas continuar?')) {
        localStorage.removeItem('club_users');
        localStorage.removeItem('club_current_user');
        alert('Base de datos reseteada correctamente.');
        window.location.reload();
    }
}

// =========================================
// NOTIFICATIONS LOGIC
// =========================================

// Dummy notifications data
let notifications = [
    { id: 1, text: "Bienvenido al nuevo portal del Club Sarmiento.", time: "Hace 1 hora", read: false },
    { id: 2, text: "Recuerda que tienes un turno de Fútbol 5 mañana.", time: "Hace 2 horas", read: false }
];

function toggleNotifications(e) {
    e.stopPropagation();
    document.getElementById('notifications-panel').classList.toggle('active');
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notification-badge');
    
    list.innerHTML = '';
    
    const unreadCount = notifications.filter(n => !n.read).length;
    badge.innerText = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';

    if (notifications.length === 0) {
        list.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted);">No tienes notificaciones.</div>';
        return;
    }

    notifications.forEach(n => {
        list.innerHTML += `
            <div class="notif-item ${!n.read ? 'unread' : ''}">
                <div class="notif-icon"><i class="ph-fill ph-bell-ringing"></i></div>
                <div class="notif-content">
                    <h4>${n.text}</h4>
                    <p>${n.time}</p>
                </div>
            </div>
        `;
    });
}

function clearNotifications() {
    notifications = notifications.map(n => ({ ...n, read: true }));
    renderNotifications();
}

// Cerrar dropdown al hacer clic fuera
document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifications-panel');
    if (panel && panel.classList.contains('active') && !e.target.closest('.user-info')) {
        panel.classList.remove('active');
    }
});

// =========================================
// INIT
// =========================================

document.addEventListener('DOMContentLoaded', () => {
    initDB();
    checkAuthAndRender();
});

// =========================================
// INTERACTIVE FEATURES
// =========================================

// News data for the hardcoded novedades cards
const NEWS_DATA = {
    campeones: {
        title: '¡Campeones del Torneo Regional!',
        category: 'Deportes',
        date: '24 de Abril, 2026',
        image: 'https://images.unsplash.com/photo-1518605368461-1ee125225f27?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        body: 'Nuestro equipo de Primera de Básquet se coronó campeón del Torneo Regional tras vencer 85-78 en una emocionante final disputada en el Estadio Principal del club.\n\nEl partido fue vibrante de principio a fin. El equipo dirigido por el Prof. Diego salió con todo desde el primer cuarto, estableciendo una ventaja temprana de 12 puntos que supo administrar a lo largo del encuentro.\n\nLos puntos destacados del partido:\n• Máximo anotador: Facundo López con 28 puntos\n• Mejor asistidor: Martín Gómez con 9 asistencias\n• Rebotes: Santiago Ruiz dominó la pintura con 14 rebotes\n\nEste es el tercer título regional consecutivo para nuestro equipo, consolidando al Club Sarmiento como una potencia del básquet en la región.\n\n¡Felicitaciones a todo el plantel, cuerpo técnico y a los hinchas que alentaron durante todo el torneo! 🏆🏀'
    },
    quincho: {
        title: 'Renovación del Quincho Principal',
        category: 'Institucional',
        date: '20 de Abril, 2026',
        image: 'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
        body: 'Finalizamos las obras de mejora en el sector de asadores del Quincho Principal. Ya está disponible para reservas de socios.\n\nLas mejoras realizadas incluyen:\n• Instalación de 4 nuevas parrillas de acero inoxidable\n• Renovación completa del techo con aislación térmica\n• Nuevo sistema de iluminación LED\n• Mesas y bancos de madera tratada para 80 personas\n• Baños reformados con accesibilidad\n• Sector de juegos infantiles contiguo\n\nPara reservar el quincho, los socios activos pueden acercarse a secretaría o contactar por WhatsApp al número del club. Las reservas se realizan con un mínimo de 7 días de anticipación.\n\nTarifas:\n• Socios activos: sin costo (solo limpieza)\n• Evento con más de 50 personas: consultar en secretaría\n\n¡Los esperamos para disfrutar de este renovado espacio! 🔥🥩'
    }
};

function readMoreNews(newsId) {
    const news = NEWS_DATA[newsId];
    if (!news) return;

    const catBg = CAT_BG[news.category] || CAT_BG['General'];

    const imgEl = document.getElementById('modal-img');
    imgEl.src = news.image || '';
    imgEl.className = news.image ? 'modal-hero-img visible' : 'modal-hero-img';

    document.getElementById('modal-cat').innerText = news.category;
    document.getElementById('modal-cat').style.background = catBg;
    document.getElementById('modal-title').innerText = news.title;
    document.getElementById('modal-meta').innerText = `Club Sarmiento · ${news.date}`;
    document.getElementById('modal-text').innerText = news.body;

    document.getElementById('article-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function filterSchedule(category) {
    // 1. Update active button visually
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    // 2. Filter items
    const items = document.querySelectorAll('.schedule-item');
    items.forEach(item => {
        if (category === 'Todos' || item.dataset.category === category || item.dataset.category === 'Todos') {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function enrollActivity(name, time, color, icon) {
    let currentUser = getCurrentUser();
    if (!currentUser) return;

    // Obtener DB fresca
    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex === -1) return;

    if (!users[userIndex].activities) {
        users[userIndex].activities = [];
    }

    // Check if already enrolled
    if (users[userIndex].activities.some(act => act.name === name)) {
        alert(`Ya estás inscripto en ${name}.`);
        return;
    }

    // Inscribir
    users[userIndex].activities.push({ name, time, color, icon });
    saveUsers(users);

    // Update current session
    localStorage.setItem('club_current_user', JSON.stringify(users[userIndex]));

    alert(`¡Inscripción exitosa en ${name}!`);
    
    // Refresh dashboard
    populateUserData(users[userIndex]);
}

// =========================================
// DATA LAYER (Firebase / localStorage fallback)
// =========================================

function dbGet(key) {
    return JSON.parse(localStorage.getItem(key)) || [];
}

function dbSet(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

// =========================================
// EVENTS LOGIC
// =========================================

function renderEventos() {
    const events = dbGet('club_events');
    const container = document.getElementById('events-list');
    if (!container) return;
    const currentUser = getCurrentUser();
    const isAdmin = currentUser && currentUser.role === 'admin';

    if (events.length === 0) {
        container.innerHTML = '<p class="empty-state"><i class="ph ph-calendar-x"></i><br>No hay eventos publicados aún.</p>';
        return;
    }

    container.innerHTML = events.sort((a,b) => new Date(a.date) - new Date(b.date)).map(ev => {
        const dateStr = ev.date ? new Date(ev.date + 'T00:00:00').toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }) : '';
        const imgStyle = ev.image ? `background-image:url('${ev.image}'); background-size:cover; background-position:center;` : '';
        const deleteBtn = isAdmin ? `<button class="event-delete-btn" onclick="deleteEvent('${ev.id}')"><i class="ph ph-trash"></i></button>` : '';
        return `
        <div class="event-card">
            ${deleteBtn}
            <div class="event-card-image" style="${imgStyle}">${ev.image ? '' : '🎉'}</div>
            <div class="event-card-body">
                <div class="event-date-badge"><i class="ph ph-calendar"></i> ${dateStr}</div>
                <h3>${ev.title}</h3>
                <p>${ev.description}</p>
                <div class="event-meta">
                    ${ev.time ? `<span><i class="ph ph-clock"></i> ${ev.time} hs</span>` : ''}
                    ${ev.location ? `<span><i class="ph ph-map-pin"></i> ${ev.location}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
}

function publishEvent() {
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const time = document.getElementById('event-time').value;
    const location = document.getElementById('event-location').value.trim();
    const description = document.getElementById('event-description').value.trim();
    const image = document.getElementById('event-image').value.trim();
    const msg = document.getElementById('event-msg');

    if (!title || !date || !description) {
        msg.style.color = '#ef4444';
        msg.innerText = 'Completá al menos título, fecha y descripción.';
        return;
    }

    const events = dbGet('club_events');
    events.push({ id: Date.now().toString(), title, date, time, location, description, image, createdAt: new Date().toISOString() });
    dbSet('club_events', events);

    msg.style.color = '#16a34a';
    msg.innerText = '✅ Evento publicado con éxito.';
    document.getElementById('event-title').value = '';
    document.getElementById('event-date').value = '';
    document.getElementById('event-time').value = '';
    document.getElementById('event-location').value = '';
    document.getElementById('event-description').value = '';
    document.getElementById('event-image').value = '';
    setTimeout(() => msg.innerText = '', 3000);
    renderEventos();
}

function deleteEvent(id) {
    if (!confirm('¿Eliminar este evento?')) return;
    dbSet('club_events', dbGet('club_events').filter(e => e.id !== id));
    renderEventos();
}

// =========================================
// ARTICLES LOGIC
// =========================================

const CAT_COLORS = {
    'Deportes': 'cat-deportes',
    'Institucional': 'cat-institucional',
    'Cultura': 'cat-cultura',
    'Salud': 'cat-salud',
    'General': 'cat-general'
};

const CAT_BG = {
    'Deportes': 'rgba(22,163,74,0.85)',
    'Institucional': 'rgba(14,165,233,0.85)',
    'Cultura': 'rgba(168,85,247,0.85)',
    'Salud': 'rgba(249,115,22,0.85)',
    'General': 'rgba(100,116,139,0.85)'
};

function renderArticulos() {
    const articles = dbGet('club_articles');
    const container = document.getElementById('articles-list');
    if (!container) return;
    const currentUser = getCurrentUser();
    const isAdmin = currentUser && currentUser.role === 'admin';

    if (articles.length === 0) {
        container.innerHTML = '<p class="empty-state"><i class="ph ph-newspaper"></i><br>No hay artículos publicados aún.</p>';
        return;
    }

    container.innerHTML = articles.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).map(art => {
        const catClass = CAT_COLORS[art.category] || 'cat-general';
        const imgStyle = art.image ? `background-image:url('${art.image}');` : 'background:#e2e8f0;';
        const dateStr = new Date(art.createdAt).toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
        const deleteBtn = isAdmin ? `<button class="article-delete-btn" onclick="event.stopPropagation(); deleteArticle('${art.id}')"><i class="ph ph-trash"></i></button>` : '';
        return `
        <div class="article-card" onclick="openArticleModal('${art.id}')">
            <div class="article-card-image" style="${imgStyle}">
                <span class="article-cat-tag ${catClass}">${art.category}</span>
            </div>
            <div class="article-card-body">
                <h3>${art.title}</h3>
                <p>${art.body}</p>
                <div class="article-footer">
                    <span>${dateStr}</span>
                    ${deleteBtn}
                </div>
            </div>
        </div>`;
    }).join('');
}

function publishArticle() {
    const title = document.getElementById('article-title').value.trim();
    const category = document.getElementById('article-category').value;
    const image = document.getElementById('article-image').value.trim();
    const body = document.getElementById('article-body').value.trim();
    const msg = document.getElementById('article-msg');

    if (!title || !body) {
        msg.style.color = '#ef4444';
        msg.innerText = 'Completá título y contenido.';
        return;
    }

    const articles = dbGet('club_articles');
    const user = getCurrentUser();
    articles.push({ id: Date.now().toString(), title, category, image, body, author: user.name, authorId: user.id, createdAt: new Date().toISOString() });
    dbSet('club_articles', articles);

    msg.style.color = '#16a34a';
    msg.innerText = '✅ Artículo publicado con éxito.';
    document.getElementById('article-title').value = '';
    document.getElementById('article-image').value = '';
    document.getElementById('article-body').value = '';
    setTimeout(() => msg.innerText = '', 3000);
    renderArticulos();
}

function deleteArticle(id) {
    if (!confirm('¿Eliminar este artículo?')) return;
    dbSet('club_articles', dbGet('club_articles').filter(a => a.id !== id));
    renderArticulos();
}

function openArticleModal(id) {
    const articles = dbGet('club_articles');
    const art = articles.find(a => a.id === id);
    if (!art) return;
    const catBg = CAT_BG[art.category] || CAT_BG['General'];
    const dateStr = new Date(art.createdAt).toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' });
    const imgEl = document.getElementById('modal-img');
    imgEl.src = art.image || '';
    imgEl.className = art.image ? 'modal-hero-img visible' : 'modal-hero-img';
    document.getElementById('modal-cat').innerText = art.category;
    document.getElementById('modal-cat').style.background = catBg;
    document.getElementById('modal-title').innerText = art.title;
    document.getElementById('modal-meta').innerText = `Por ${art.author} · ${dateStr}`;
    document.getElementById('modal-text').innerText = art.body;
    document.getElementById('article-modal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeArticleModal(event) {
    if (event && event.target !== document.getElementById('article-modal')) return;
    document.getElementById('article-modal').classList.remove('active');
    document.body.style.overflow = '';
}

// =========================================
// CHATBOT FAQ
// =========================================

const FAQ_KB = [
    { keywords:['hola','buenas','buenos','saludos','hey','q onda'], answer:'👋 ¡Hola! Soy el asistente virtual del Club Sarmiento. Estoy aquí para guiarte en todo lo que necesites saber sobre la app y el club. ¿En qué te puedo ayudar?' },
    { keywords:['como funciona','que hago','para que sirve','como usar','tutorial','ayuda'], answer:'📚 <b>¿Cómo usar la App?</b><br>Desde el menú lateral (o en la parte inferior si estás en tu celular) podés acceder a todas las funciones:<br>- <b>Inicio:</b> Muestra tu Carnet Digital.<br>- <b>Horarios:</b> Para ver la grilla e inscribirte en clases.<br>- <b>Cuotas:</b> Para ver tu estado de cuenta.<br>- <b>Mi Perfil:</b> Para cargar tus datos y elegir tu foto.' },
    { keywords:['registrar','registro','cuenta','hacerse socio','nuevo socio','como me registro','crear cuenta'], answer:'👤 <b>¿Cómo registrarse?</b><br>1. En la pantalla inicial (antes de entrar), hacé clic en "Crear cuenta".<br>2. Ingresá tu Nombre, DNI y crea una contraseña.<br>3. Resolvé el captcha (no soy un robot) y listo. Ya serás parte del club.' },
    { keywords:['iniciar sesion','login','entrar','ingresar'], answer:'🔑 <b>Inicio de sesión:</b><br>En la pantalla de bienvenida, ingresá tu número de DNI y la contraseña que creaste al registrarte. Si olvidaste tu clave, deberás acercarte a secretaría.' },
    { keywords:['perfil','mis datos','foto','avatar','cambiar foto','editar datos','modificar'], answer:'🖼️ <b>Mi Perfil:</b><br>Entrá a "Mi Perfil" desde el menú. Allí podrás cargar tu fecha de nacimiento, teléfono, email, dirección y un contacto de emergencia. También podés elegir tu Avatar (foto de perfil) haciendo clic en los íconos de colores. ¡Recordá presionar "Guardar Datos" al terminar!' },
    { keywords:['cuota','pagar','pago','deuda','debe','factura','mensualidad','precio','costo','valor','cuanto cuesta','cuanto vale'], answer:'💰 <b>Cuotas y Pagos:</b><br>La cuota mensual actual es de $15.000. Podés consultar tu estado de cuenta y si tenés deuda en la pestaña "Cuotas". Las cuotas vencen el último día de cada mes. Podés pagar vía transferencia o MercadoPago. (Para descuentos familiares consultá en secretaría).' },
    { keywords:['horario','actividad','clase','deporte','grilla'], answer:'📅 <b>Horarios de Actividades:</b><br>En la pestaña "Horarios" podés ver toda la grilla de la semana. Podés filtrar por deporte (Fútbol, Básquet, Natación, etc.).' },
    { keywords:['inscribir','inscribirme','inscribo','sumar','unirse','anotarse','como me anoto','participar'], answer:'✅ <b>¿Cómo inscribirse a una clase?</b><br>1. Ve a la pestaña "Horarios".<br>2. Buscá la actividad que te interesa (ej. Zumba, Básquet).<br>3. Hacé clic en el botón "Inscribirme".<br>¡Listo! La actividad te aparecerá en la sección "Próximas Actividades" de la pantalla de Inicio.' },
    { keywords:['evento','eventos','fiesta','torneo','campeonato'], answer:'🎉 <b>Eventos:</b><br>Revisá la pestaña "Eventos" para ver los próximos torneos, encuentros o fiestas organizadas por el club.' },
    { keywords:['articulo','noticia','noticias','novedad','novedades'], answer:'📰 <b>Noticias:</b><br>En las pestañas "Novedades" y "Artículos" podés leer las últimas comunicaciones oficiales, mejoras en las instalaciones y resultados deportivos.' },
    { keywords:['carnet','credencial','tarjeta','qr','numero de socio'], answer:'🪪 <b>Tu Carnet Digital:</b><br>Se encuentra en la pantalla de "Inicio". Muestra tu Nombre, DNI, número de socio (arriba a la derecha) y tu estado (Activo/De Baja). Este carnet te sirve para ingresar al club.' },
    { keywords:['admin','administrador','secretaria','administracion','contacto'], answer:'⚙️ <b>Administración:</b><br>La secretaría atiende de Lunes a Viernes de 9 a 17 hs. Podés acercarte para pagar en efectivo, recuperar tu contraseña o hacer consultas específicas.' },
    { keywords:['abre','cierra','cuando','horario club','atencion'], answer:'🕐 <b>Horarios del Club:</b><br>El club abre sus puertas de Lunes a Domingo de 7:00 a 23:00 hs.' },
    { keywords:['pileta','natacion','nadar','piscina'], answer:'🏊 <b>Natación:</b><br>Contamos con pileta climatizada disponible todo el año. Hay clases para adultos (ej. Lunes 18hs) y niños. Anotate en la pestaña "Horarios".' },
    { keywords:['futbol','fútbol','soccer'], answer:'⚽ <b>Fútbol:</b><br>Tenemos Escuelita de Fútbol (ej. Lunes 16hs en Cancha Auxiliar). Podés anotarte desde "Horarios".' },
    { keywords:['basquet','básquet','basket'], answer:'🏀 <b>Básquet:</b><br>Primera (Lunes 20hs) y Formativas (Martes 17hs) en el Estadio Principal. Podés anotarte desde "Horarios".' },
    { keywords:['zumba','baile','fitness'], answer:'💃 <b>Zumba y Fitness:</b><br>Clases los Martes a las 19:00 en el Salón de Usos Múltiples. Anotate desde "Horarios".' },
    { keywords:['contraseña','password','olvidé','olvide','recuperar'], answer:'🔑 Si olvidaste tu contraseña, debes contactarte con la secretaría del club presencialmente para que te la restablezcan.' },
    { keywords:['gracias','ok','genial','perfecto','buenisimo','entendido'], answer:'😊 ¡De nada! Si necesitás saber algo más, acá estoy. ¡Que disfrutes del club!' }
];

let chatOpen = false;
let chatGreeted = false;
let chatCooldown = false;

function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('chatbot-panel');
    panel.classList.toggle('active', chatOpen);
    document.getElementById('chat-unread').style.display = 'none';
    if (chatOpen && !chatGreeted) {
        chatGreeted = true;
        setTimeout(() => addBotMessage('👋 ¡Hola! Soy el asistente del Club Sarmiento. ¿En qué te puedo ayudar hoy? Podés preguntarme cosas como "¿Cómo me inscribo a una clase?" o "¿Dónde veo mis cuotas?".'), 400);
    }
}

function addBotMessage(text) {
    const msgs = document.getElementById('chatbot-messages');
    // Show typing indicator
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => {
        msgs.removeChild(typing);
        const msg = document.createElement('div');
        msg.className = 'chat-msg bot';
        msg.innerHTML = text;
        msgs.appendChild(msg);
        msgs.scrollTop = msgs.scrollHeight;
    }, 900);
}

function addUserMessage(text) {
    const msgs = document.getElementById('chatbot-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg user';
    msg.innerText = text;
    msgs.appendChild(msg);
    msgs.scrollTop = msgs.scrollHeight;
}

function processMessage(text) {
    const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    
    // Mejorar lógica de coincidencia (evaluar cantidad de keywords encontradas)
    let bestMatch = null;
    let maxMatches = 0;

    for (const entry of FAQ_KB) {
        let matches = 0;
        for (const kw of entry.keywords) {
            const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
            if (lower.includes(kwNorm)) {
                matches++;
            }
        }
        if (matches > maxMatches) {
            maxMatches = matches;
            bestMatch = entry;
        }
    }

    if (bestMatch) {
        return bestMatch.answer;
    }

    return '🤔 Mmm, no estoy seguro de entender tu pregunta. Podés preguntarme sobre: cómo inscribirse, ver horarios, cómo registrarte, editar tu perfil, o sobre el pago de cuotas.';
}

function sendChatMessage() {
    const input = document.getElementById('chatbot-input');
    const text = input.value.trim();
    if (!text) return;
    if (chatCooldown) return;
    input.value = '';
    chatCooldown = true;
    // Disable input briefly
    input.disabled = true;
    addUserMessage(text);
    addBotMessage(processMessage(text));
    setTimeout(() => {
        chatCooldown = false;
        input.disabled = false;
        input.focus();
    }, 1000);
}

function sendSuggestion(text) {
    if (chatCooldown) return;
    if (!chatOpen) toggleChat();
    chatCooldown = true;
    addUserMessage(text);
    addBotMessage(processMessage(text));
    setTimeout(() => {
        chatCooldown = false;
    }, 1000);
}

// =========================================
// OVERRIDE: checkAuthAndRender - show admin panels
// =========================================

const _origCheckAuth = checkAuthAndRender;
// Patch navigate to render new views
const _origNavigate = navigate;
window.navigate = function(viewId) {
    _origNavigate(viewId);
    if (viewId === 'eventos') renderEventos();
    if (viewId === 'articulos') renderArticulos();
    // Show/hide admin publish panels
    const user = getCurrentUser();
    const isAdmin = user && user.role === 'admin';
    const adminPanels = document.querySelectorAll('.admin-publish-panel');
    adminPanels.forEach(p => p.style.display = isAdmin ? 'block' : 'none');
};

// =========================================
// PROFILE LOGIC
// =========================================

function loadProfile() {
    const user = getCurrentUser();
    if (!user) return;
    const profileKey = `club_profile_${user.id}`;
    const profile = JSON.parse(localStorage.getItem(profileKey)) || {};

    // Readonly fields from account
    const nameEl = document.getElementById('profile-name');
    const dniEl = document.getElementById('profile-dni');
    if (nameEl) nameEl.value = user.name || '';
    if (dniEl) dniEl.value = user.dni || '';

    // Avatar card
    const dispName = document.getElementById('profile-display-name');
    const dispDni = document.getElementById('profile-display-dni');
    if (dispName) dispName.innerText = user.name || '-';
    if (dispDni) dispDni.innerText = `DNI: ${user.dni || '-'}`;

    // Editable fields
    const fields = ['birth', 'phone', 'email', 'address', 'emergency-name', 'emergency-phone', 'photo'];
    fields.forEach(f => {
        const el = document.getElementById(`profile-${f}`);
        if (el && profile[f]) el.value = profile[f];
    });

    // Avatar preview
    if (profile.photo && profile.photo.startsWith('avatar-')) {
        const idx = parseInt(profile.photo.replace('avatar-', ''));
        showAvatarIcon(idx);
    } else {
        const defaultUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=16a34a&color=fff&size=200`;
        showAvatarImg(profile.photo || defaultUrl);
    }

    // Build avatar gallery
    renderAvatarGallery(profile.photo);

    updateCompletion(profile);
}

function updateCompletion(profile) {
    const tracked = ['birth', 'phone', 'email', 'address', 'emergency-name', 'emergency-phone', 'photo'];
    const filled = tracked.filter(f => profile[f] && profile[f].trim() !== '').length;
    const pct = Math.round((filled / tracked.length) * 100);
    const fill = document.getElementById('completion-fill');
    const text = document.getElementById('completion-text');
    if (fill) fill.style.width = `${pct}%`;
    if (text) text.innerText = `${pct}% completado`;
}

function saveProfile() {
    const user = getCurrentUser();
    if (!user) return;
    const msg = document.getElementById('profile-msg');

    // Validate age (3-110 years)
    const birthVal = document.getElementById('profile-birth')?.value || '';
    if (birthVal) {
        const birthDate = new Date(birthVal + 'T00:00:00');
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        if (age < 3 || age > 110) {
            msg.style.color = '#ef4444';
            msg.innerText = '⚠️ La edad debe ser entre 3 y 110 años.';
            setTimeout(() => msg.innerText = '', 4000);
            return;
        }
    }

    // Validate email format
    const emailVal = document.getElementById('profile-email')?.value || '';
    if (emailVal && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
        msg.style.color = '#ef4444';
        msg.innerText = '⚠️ El formato de email no es válido.';
        setTimeout(() => msg.innerText = '', 4000);
        return;
    }

    // Validate phone (no letters)
    const phoneVal = document.getElementById('profile-phone')?.value || '';
    if (phoneVal && /[a-zA-Z]/.test(phoneVal)) {
        msg.style.color = '#ef4444';
        msg.innerText = '⚠️ El teléfono no puede contener letras.';
        setTimeout(() => msg.innerText = '', 4000);
        return;
    }
    const emergPhoneVal = document.getElementById('profile-emergency-phone')?.value || '';
    if (emergPhoneVal && /[a-zA-Z]/.test(emergPhoneVal)) {
        msg.style.color = '#ef4444';
        msg.innerText = '⚠️ El teléfono de emergencia no puede contener letras.';
        setTimeout(() => msg.innerText = '', 4000);
        return;
    }

    const profileKey = `club_profile_${user.id}`;
    const profile = {
        birth: birthVal,
        phone: document.getElementById('profile-phone')?.value || '',
        email: document.getElementById('profile-email')?.value || '',
        address: document.getElementById('profile-address')?.value || '',
        'emergency-name': document.getElementById('profile-emergency-name')?.value || '',
        'emergency-phone': document.getElementById('profile-emergency-phone')?.value || '',
        photo: document.getElementById('profile-photo')?.value || ''
    };
    localStorage.setItem(profileKey, JSON.stringify(profile));

    // Update avatar in header if photo changed
    if (profile.photo && profile.photo.startsWith('avatar-')) {
        const idx = parseInt(profile.photo.replace('avatar-', ''));
        const opt = AVATAR_OPTIONS[idx];
        if (opt) {
            // Update profile big avatar
            showAvatarImg(opt.url);
            // Update header
            const headerAvatar = document.getElementById('user-avatar');
            if (headerAvatar) headerAvatar.src = opt.url;
        }
    }

    updateCompletion(profile);

    if (msg) {
        msg.style.color = '#16a34a';
        msg.innerText = '✅ Datos guardados correctamente.';
        setTimeout(() => msg.innerText = '', 3000);
    }
}

function previewAvatar() {
    const url = document.getElementById('profile-photo')?.value;
    const avatarBig = document.getElementById('profile-avatar-big');
    if (avatarBig && url) avatarBig.src = url;
}

// Patch navigate to also handle 'perfil'
const _prevNavigate = window.navigate;
window.navigate = function(viewId) {
    _prevNavigate(viewId);
    if (viewId === 'perfil') loadProfile();
};

// =========================================
// AVATAR GALLERY
// =========================================

const AVATAR_OPTIONS = [
    { url: 'assets/diablito_bombero_1780086086062.png', label: 'Bombero' },
    { url: 'assets/diablito_secretario_1780086098301.png', label: 'Secretario' },
    { url: 'assets/diablito_deportista_1780086132250.png', label: 'Deportista' },
    { url: 'assets/diablito_cocinero_1780086146152.png', label: 'Cocinero' },
    { url: 'assets/diablito_musico_1780086161762.png', label: 'Músico' },
    { url: 'assets/diablito_rey_1780086174142.png', label: 'Rey' }
];

function renderAvatarGallery(selectedUrl) {
    const gallery = document.getElementById('avatar-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';

    AVATAR_OPTIONS.forEach((opt, idx) => {
        const avatarId = `avatar-${idx}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avatar-option' + (selectedUrl === avatarId ? ' selected' : '');
        btn.style.background = 'transparent';
        btn.style.padding = '0';
        btn.style.border = selectedUrl === avatarId ? '3px solid var(--primary)' : '3px solid transparent';
        btn.innerHTML = `<img src="${opt.url}" alt="${opt.label}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
        btn.title = opt.label;
        btn.onclick = () => selectAvatar(idx);
        gallery.appendChild(btn);
    });
}

function selectAvatar(idx) {
    const avatarId = `avatar-${idx}`;
    document.getElementById('profile-photo').value = avatarId;

    // Show the img in the profile avatar
    const opt = AVATAR_OPTIONS[idx];
    if (opt) showAvatarImg(opt.url);

    // Update selection visually
    document.querySelectorAll('.avatar-option').forEach((btn, i) => {
        btn.classList.toggle('selected', i === idx);
        btn.style.border = i === idx ? '3px solid var(--primary)' : '3px solid transparent';
    });
}

// Helper: no longer needed for icon, just map to img
function showAvatarIcon(idx) {
    const opt = AVATAR_OPTIONS[idx];
    if (opt) showAvatarImg(opt.url);
}

// Helper: show img avatar
function showAvatarImg(src) {
    const imgEl = document.getElementById('profile-avatar-big');
    const iconDisplay = document.getElementById('profile-avatar-icon-display');
    if (imgEl) {
        imgEl.style.display = 'block';
        imgEl.src = src;
    }
    if (iconDisplay) iconDisplay.style.display = 'none';
}

// Override populateUserData to also render avatar image in header/carnet
const _origPopulateUserData = populateUserData;
window.populateUserData = function(user) {
    _origPopulateUserData(user);
    const profileKey = `club_profile_${user.id}`;
    const profile = JSON.parse(localStorage.getItem(profileKey)) || {};
    if (profile.photo && profile.photo.startsWith('avatar-')) {
        const idx = parseInt(profile.photo.replace('avatar-', ''));
        const opt = AVATAR_OPTIONS[idx];
        if (opt) {
            const headerAvatar = document.getElementById('user-avatar');
            if (headerAvatar) headerAvatar.src = opt.url;
        }
    }
};

// =========================================
// TUTORIAL LOGIC
// =========================================

const TUTORIAL_STEPS = [
    {
        title: "¡Bienvenido al Club!",
        text: "Te preparamos un breve recorrido para que conozcas tu nuevo Portal de Socio.",
        target: null
    },
    {
        title: "Tu Carnet Digital",
        text: "En la pantalla principal siempre verás tu carnet. Usalo para ingresar a las instalaciones.",
        target: ".carnet-card"
    },
    {
        title: "Navegación",
        text: "Usa este menú para ver horarios, pagar tus cuotas y enterarte de las novedades.",
        target: ".side-nav"
    },
    {
        title: "Personaliza tu Perfil",
        text: "Entrá a 'Mi Perfil' para completar tus datos personales y elegir un avatar divertido.",
        target: null
    },
    {
        title: "Asistente Virtual",
        text: "Si tienes alguna duda, haz clic en este icono. ¡Nuestro asistente te ayudará 24/7!",
        target: ".chatbot-toggle"
    }
];

let currentTutorialStep = 0;
let tutorialUserId = null;

function checkTutorial(userId) {
    tutorialUserId = userId;
    const isDone = localStorage.getItem(`club_tutorial_done_${userId}`);
    if (!isDone) {
        // Start tutorial
        currentTutorialStep = 0;
        document.getElementById('tutorial-overlay').classList.add('active');
        renderTutorialStep();
    }
}

function renderTutorialStep() {
    const step = TUTORIAL_STEPS[currentTutorialStep];
    document.getElementById('tutorial-title').innerText = step.title;
    document.getElementById('tutorial-text').innerText = step.text;

    // Update dots
    const dots = document.querySelectorAll('.tutorial-progress .step-dot');
    // Ensure we have enough dots
    const progressContainer = document.querySelector('.tutorial-progress');
    progressContainer.innerHTML = '';
    for(let i=0; i<TUTORIAL_STEPS.length; i++) {
        const dot = document.createElement('span');
        dot.className = 'step-dot' + (i === currentTutorialStep ? ' active' : '');
        progressContainer.appendChild(dot);
    }

    // Button text
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (currentTutorialStep === TUTORIAL_STEPS.length - 1) {
        nextBtn.innerText = "¡Entendido!";
    } else {
        nextBtn.innerText = currentTutorialStep === 0 ? "Comenzar" : "Siguiente";
    }

    // Highlight target if exists
    // Remove previous highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
        el.style.position = '';
        el.style.zIndex = '';
        el.style.background = '';
    });

    if (step.target) {
        const targetEl = document.querySelector(step.target);
        if (targetEl) {
            targetEl.classList.add('tutorial-highlight');
            targetEl.style.position = 'relative';
            targetEl.style.zIndex = '10000';
            targetEl.style.background = 'var(--surface-color)';
        }
    }
}

function nextTutorialStep() {
    currentTutorialStep++;
    if (currentTutorialStep >= TUTORIAL_STEPS.length) {
        finishTutorial();
    } else {
        renderTutorialStep();
    }
}

function skipTutorial() {
    finishTutorial();
}

function finishTutorial() {
    document.getElementById('tutorial-overlay').classList.remove('active');
    
    // Cleanup highlights
    document.querySelectorAll('.tutorial-highlight').forEach(el => {
        el.classList.remove('tutorial-highlight');
        el.style.position = '';
        el.style.zIndex = '';
        el.style.background = '';
    });

    if (tutorialUserId) {
        localStorage.setItem(`club_tutorial_done_${tutorialUserId}`, 'true');
    }
}

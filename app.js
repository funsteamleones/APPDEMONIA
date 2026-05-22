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
    { keywords:['hola','buenas','buenos','saludos','hey'], answer:'👋 ¡Hola! Soy el asistente del Club Sarmiento. Puedo ayudarte con horarios, cuotas, actividades y más. ¿En qué te puedo ayudar?' },
    { keywords:['cuota','pagar','pago','deuda','debe','factura','mensualidad'], answer:'💰 <b>Cuotas:</b> Consultá tu estado de cuenta en la pestaña "Cuotas". Las cuotas vencen el último día de cada mes. Se puede pagar via MercadoPago o transferencia bancaria.' },
    { keywords:['horario','actividad','clase','deporte'], answer:'📅 <b>Horarios:</b> La grilla completa de actividades está en la pestaña "Horarios". Podés filtrar por deporte e inscribirte desde ahí.' },
    { keywords:['inscribir','inscribirme','sumar','unirse','anotarse'], answer:'✅ <b>Inscripción:</b> En la pestaña "Horarios" encontrás todas las actividades. Presioná "Inscribirme" en la que te interese.' },
    { keywords:['evento','eventos','fiesta','torneo','campeonato'], answer:'🎉 <b>Eventos:</b> Revisá la pestaña "Eventos" para ver todos los próximos eventos del club.' },
    { keywords:['articulo','noticia','noticias','novedad'], answer:'📰 <b>Artículos:</b> En la pestaña "Artículos" encontrás todas las noticias e información institucional publicadas por la administración.' },
    { keywords:['carnet','credencial','tarjeta','qr'], answer:'🪪 <b>Carnet digital:</b> Tu carnet está en la pantalla de Inicio. Muestra tu nombre, DNI, número de socio y estado.' },
    { keywords:['contraseña','password','olvidé','olvide','recuperar'], answer:'🔑 Si olvidaste tu contraseña, contactate con la administración del club en secretaría.' },
    { keywords:['registrar','registro','cuenta','hacerse socio','nuevo socio'], answer:'👤 <b>Registro:</b> Hacé clic en "Crear cuenta" en la pantalla de login. Solo necesitás nombre, DNI y contraseña.' },
    { keywords:['admin','administrador','secretaria','administracion'], answer:'⚙️ La secretaría atiende de Lunes a Viernes de 9 a 17 hs.' },
    { keywords:['abre','cierra','cuando','horario club','atencion'], answer:'🕐 El club abre de Lunes a Domingo de 7:00 a 23:00 hs.' },
    { keywords:['pileta','natacion','nadar','piscina'], answer:'🏊 Contamos con pileta climatizada disponible todo el año. Las clases son para adultos y niños.' },
    { keywords:['precio','costo','valor','cuanto cuesta','cuanto vale'], answer:'💵 La cuota mensual es de $15.000. Para descuentos familiares consultá en secretaría.' },
    { keywords:['futbol','fútbol','soccer'], answer:'⚽ Tenemos Escuelita de Fútbol los Lunes a las 16:00 en la Cancha Auxiliar con el Prof. Martín.' },
    { keywords:['basquet','básquet','basket'], answer:'🏀 Básquet Primera los Lunes a las 20:00 y Formativas los Martes a las 17:00 en el Estadio Principal.' },
    { keywords:['zumba','baile','fitness'], answer:'💃 Zumba los Martes a las 19:00 en el Salón de Usos Múltiples con la Prof. Ana.' },
    { keywords:['gracias','ok','genial','perfecto','buenisimo'], answer:'😊 ¡De nada! Si necesitás algo más, acá estoy. ¡Que tengas un excelente día!' }
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
        setTimeout(() => addBotMessage('👋 ¡Hola! Soy el asistente del Club Sarmiento. ¿En qué te puedo ayudar hoy?'), 400);
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
    for (const entry of FAQ_KB) {
        if (entry.keywords.some(kw => lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))) {
            return entry.answer;
        }
    }
    return '🤔 No tengo información sobre eso. Para consultas específicas, contactate con la secretaría del club (Lun-Vie, 9 a 17 hs).';
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
            // Update profile big avatar with icon overlay
            showAvatarIcon(idx);
            // Update header with colored SVG
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="100" fill="${opt.bg}"/><text x="100" y="130" text-anchor="middle" fill="white" font-size="100" font-family="sans-serif">${opt.emoji}</text></svg>`;
            const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
            const headerAvatar = document.getElementById('user-avatar');
            if (headerAvatar) headerAvatar.src = dataUrl;
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
    { icon: 'ph-fill ph-user-circle',       bg: '#16a34a', label: 'Persona',   emoji: '\u{1F464}' },
    { icon: 'ph-fill ph-smiley',            bg: '#0ea5e9', label: 'Sonrisa',   emoji: '\u{1F60A}' },
    { icon: 'ph-fill ph-cat',               bg: '#8b5cf6', label: 'Gato',      emoji: '\u{1F431}' },
    { icon: 'ph-fill ph-dog',               bg: '#f97316', label: 'Perro',     emoji: '\u{1F436}' },
    { icon: 'ph-fill ph-soccer-ball',       bg: '#15803d', label: 'F\u00fatbol',   emoji: '\u26BD' },
    { icon: 'ph-fill ph-basketball',        bg: '#ea580c', label: 'B\u00e1squet',  emoji: '\u{1F3C0}' },
    { icon: 'ph-fill ph-swimming-pool',     bg: '#0284c7', label: 'Nataci\u00f3n', emoji: '\u{1F3CA}' },
    { icon: 'ph-fill ph-trophy',            bg: '#ca8a04', label: 'Trofeo',    emoji: '\u{1F3C6}' },
    { icon: 'ph-fill ph-star',              bg: '#eab308', label: 'Estrella',  emoji: '\u2B50' },
    { icon: 'ph-fill ph-heart',             bg: '#dc2626', label: 'Coraz\u00f3n',  emoji: '\u2764' },
    { icon: 'ph-fill ph-flower-lotus',      bg: '#d946ef', label: 'Flor',      emoji: '\u{1F338}' },
    { icon: 'ph-fill ph-tree',              bg: '#059669', label: '\u00c1rbol',    emoji: '\u{1F333}' },
    { icon: 'ph-fill ph-lightning',         bg: '#7c3aed', label: 'Rayo',      emoji: '\u26A1' },
    { icon: 'ph-fill ph-fire',              bg: '#ef4444', label: 'Fuego',     emoji: '\u{1F525}' },
    { icon: 'ph-fill ph-rocket',            bg: '#6366f1', label: 'Cohete',    emoji: '\u{1F680}' }
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
        btn.style.background = opt.bg;
        btn.innerHTML = `<i class="${opt.icon}"></i>`;
        btn.title = opt.label;
        btn.onclick = () => selectAvatar(idx);
        gallery.appendChild(btn);
    });
}

function selectAvatar(idx) {
    const avatarId = `avatar-${idx}`;
    document.getElementById('profile-photo').value = avatarId;

    // Show the icon in the profile avatar
    showAvatarIcon(idx);

    // Update selection visually
    document.querySelectorAll('.avatar-option').forEach((btn, i) => {
        btn.classList.toggle('selected', i === idx);
    });
}

// Helper: show icon avatar in profile page
function showAvatarIcon(idx) {
    const opt = AVATAR_OPTIONS[idx];
    if (!opt) return;
    const imgEl = document.getElementById('profile-avatar-big');
    const iconDisplay = document.getElementById('profile-avatar-icon-display');
    const iconI = document.getElementById('profile-avatar-icon-i');
    if (imgEl) imgEl.style.display = 'none';
    if (iconDisplay) {
        iconDisplay.style.display = 'flex';
        iconDisplay.style.background = opt.bg;
        iconI.className = opt.icon;
    }
}

// Helper: show img avatar (initials fallback)
function showAvatarImg(src) {
    const imgEl = document.getElementById('profile-avatar-big');
    const iconDisplay = document.getElementById('profile-avatar-icon-display');
    if (imgEl) {
        imgEl.style.display = 'block';
        imgEl.src = src;
    }
    if (iconDisplay) iconDisplay.style.display = 'none';
}

// Override populateUserData to also render avatar icon in header/carnet
const _origPopulateUserData = populateUserData;
window.populateUserData = function(user) {
    _origPopulateUserData(user);
    const profileKey = `club_profile_${user.id}`;
    const profile = JSON.parse(localStorage.getItem(profileKey)) || {};
    if (profile.photo && profile.photo.startsWith('avatar-')) {
        const idx = parseInt(profile.photo.replace('avatar-', ''));
        const opt = AVATAR_OPTIONS[idx];
        if (opt) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" rx="100" fill="${opt.bg}"/><text x="100" y="130" text-anchor="middle" fill="white" font-size="100" font-family="sans-serif">${opt.emoji}</text></svg>`;
            const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
            const headerAvatar = document.getElementById('user-avatar');
            if (headerAvatar) headerAvatar.src = dataUrl;
        }
    }
};

/* =========================================
   DATABASE (Supabase + localStorage fallback)
   ========================================= */

// Obtener usuario logueado actualmente
function getCurrentUser() {
    const userStr = localStorage.getItem('club_current_user');
    return userStr ? JSON.parse(userStr) : null;
}

// DB helpers para datos no-usuario
function dbGet(key) { return JSON.parse(localStorage.getItem(key)); }
function dbSet(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function initDB() {
    // Solo se usa si no hay Supabase configurado
    if (window.supabaseClient) return;
    let users = JSON.parse(localStorage.getItem('club_users')) || [];
    const adminExists = users.find(u => u.dni === '99999999');
    if (!adminExists) {
        users.push({ id: 'admin_99', name: 'Admin Club', dni: '99999999', password: 'admin', role: 'admin', activities: [] });
        localStorage.setItem('club_users', JSON.stringify(users));
    }
}

function getUsers() {
    return JSON.parse(localStorage.getItem('club_users')) || [];
}

function saveUsers(users) {
    localStorage.setItem('club_users', JSON.stringify(users));
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

async function register() {
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

    const newUser = {
        id: Date.now().toString(),
        name, dni, password,
        role: 'socio',
        status: 'activo',
        activities: []
    };

    if (window.supabaseClient) {
        try {
            // Chequear si DNI ya existe
            const { data: existing } = await window.supabaseClient.from('users').select('id').eq('dni', dni).maybeSingle();
            if (existing) {
                errorEl.innerText = 'El DNI ingresado ya está registrado.';
                return;
            }
            const { error } = await window.supabaseClient.from('users').insert([newUser]);
            if (error) throw error;
        } catch (e) {
            console.error('Supabase register error', e);
            // Fallback local
            const users = getUsers();
            if (users.find(u => u.dni === dni)) { errorEl.innerText = 'El DNI ingresado ya está registrado.'; return; }
            users.push(newUser);
            saveUsers(users);
        }
    } else {
        const users = getUsers();
        if (users.find(u => u.dni === dni)) { errorEl.innerText = 'El DNI ingresado ya está registrado.'; return; }
        users.push(newUser);
        saveUsers(users);
    }

    successEl.innerText = '¡Registro exitoso! Ya puedes iniciar sesión.';
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-dni').value = '';
    document.getElementById('reg-password').value = '';

    setTimeout(() => {
        toggleAuthForm('login');
        document.getElementById('login-dni').value = dni;
    }, 1500);
}

async function login() {
    const dni = document.getElementById('login-dni').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');

    errorEl.innerText = '';

    if (!dni || !password) {
        errorEl.innerText = 'Ingresa DNI y contraseña.';
        return;
    }

    let user = null;

    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('users')
                .select('*')
                .eq('dni', dni)
                .eq('password', password)
                .maybeSingle();
            if (error) throw error;
            user = data;
        } catch (e) {
            console.error('Supabase login error', e);
            // Fallback local
            const users = getUsers();
            const matches = users.filter(u => u.dni === dni && u.password === password);
            user = matches[matches.length - 1] || null;
        }
    } else {
        const users = getUsers();
        const matches = users.filter(u => u.dni === dni && u.password === password);
        user = matches[matches.length - 1] || null;
    }

    if (user) {
        if (user.status === 'baja') {
            alert('❌ Tu cuenta ha sido dada de baja o suspendida por la administración.');
        }
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
    
    // Si hay Supabase, el usuario ya fue verificado al hacer login.
    // Solo re-verificamos desde localStorage si NO usamos Supabase.
    if (currentUser && !window.supabaseClient) {
        const users = getUsers();
        const freshUser = users.find(u => u.id === currentUser.id);
        if (freshUser) {
            currentUser = freshUser;
            localStorage.setItem('club_current_user', JSON.stringify(currentUser));
        } else {
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
                    <div class="activity-card" style="position: relative;">
                        <div class="activity-icon ${act.color}">
                            <i class="ph-fill ${act.icon}"></i>
                        </div>
                        <div class="activity-details">
                            <h3>${act.name}</h3>
                            <p>${act.time}</p>
                        </div>
                        <button class="btn-delete" style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%);" onclick="unenrollActivity('${act.name}')" title="Dar de baja de esta actividad">
                            <i class="ph ph-trash"></i>
                        </button>
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

async function refreshAdminTable() {
    const tbody = document.getElementById('admin-users-list');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">Cargando socios...</td></tr>';

    let users = [];
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient.from('users').select('*').order('name', { ascending: true });
            if (error) throw error;
            users = data || [];
        } catch (e) {
            console.error('Supabase error loading users', e);
            users = getUsers();
        }
    } else {
        users = getUsers();
    }

    tbody.innerHTML = '';

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">No hay socios registrados aún.</td></tr>';
        return;
    }

    users.forEach(u => {
        const tr = document.createElement('tr');
        const isBaja = u.status === 'baja';
        const tagClass = u.role === 'admin' ? 'tag-active' : (isBaja ? 'tag-inactive' : 'tag-active');
        const statusText = u.role === 'admin' ? 'Administrador' : (isBaja ? 'De Baja' : 'Activo');
        const deleteBtn = u.role === 'admin' ? '' :
            `<button class="btn-delete" onclick="deleteUser('${u.id}')" title="Dar de baja"><i class="ph ph-trash"></i></button>`;

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

async function deleteUser(id) {
    if (!confirm('¿Estás seguro de que deseas dar de baja a este socio?')) return;
    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient.from('users').update({ status: 'baja' }).eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error('Error giving user baja', e);
            alert('Error al actualizar el estado del socio: ' + (e.message || ''));
            return;
        }
    } else {
        let users = getUsers();
        const idx = users.findIndex(u => u.id === id);
        if (idx > -1) { users[idx].status = 'baja'; saveUsers(users); }
    }
    refreshAdminTable();
}

async function resetDB() {
    if (!confirm('⚠️ PELIGRO: Esto borrará todos los socios (excepto el Admin) y restaurará la base de datos a cero. ¿Deseas continuar?')) return;
    if (window.supabaseClient) {
        try {
            const { error } = await window.supabaseClient.from('users').delete().neq('role', 'admin');
            if (error) throw error;
            alert('Base de datos reseteada correctamente.');
        } catch (e) {
            console.error('Error resetting DB', e);
            alert('Error al resetear: ' + (e.message || ''));
            return;
        }
    } else {
        localStorage.removeItem('club_users');
        localStorage.removeItem('club_current_user');
    }
    window.location.reload();
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

function unenrollActivity(name) {
    if (!confirm(`¿Estás seguro de que deseas darte de baja de ${name}?`)) return;

    let currentUser = getCurrentUser();
    if (!currentUser) return;

    const users = getUsers();
    const userIndex = users.findIndex(u => u.id === currentUser.id);
    
    if (userIndex === -1) return;
    if (!users[userIndex].activities) return;

    users[userIndex].activities = users[userIndex].activities.filter(act => act.name !== name);
    saveUsers(users);

    localStorage.setItem('club_current_user', JSON.stringify(users[userIndex]));

    alert(`Te has dado de baja de ${name}.`);
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
    { keywords:['registrar','registro','cuenta','hacerse socio','nuevo socio','como me registro','crear cuenta'], answer:'👤 <b>¿Cómo registrarse?</b><br>1. En la pantalla inicial (antes de entrar), hacé clic en "Crear cuenta".<br>2. Ingresá tu Nombre, DNI y crea una contraseña.<br>3. Listo, ya serás parte del club.' },
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
            showAvatarIcon(idx);
            const headerAvatar = document.getElementById('user-avatar');
            if (headerAvatar) headerAvatar.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(opt.svg)}`;
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

// Helper to build SVG devil string
function _devilSVG(bg, horn, face, accessory) {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="${bg}"/><polygon points="25,37 15,8 38,28" fill="${horn}"/><polygon points="75,37 62,8 85,28" fill="${horn}"/><circle cx="50" cy="57" r="27" fill="${face}"/>${accessory}<circle cx="40" cy="52" r="4.5" fill="#111827"/><circle cx="60" cy="52" r="4.5" fill="#111827"/><circle cx="41.5" cy="50.5" r="1.8" fill="white"/><circle cx="61.5" cy="50.5" r="1.8" fill="white"/><path d="M 40 65 Q 50 73 60 65" stroke="${horn}" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
}

const AVATAR_OPTIONS = [
    { label: 'Clásico',    svg: _devilSVG('#dc2626','#991b1b','#fca5a5', '<rect x="45" y="65" width="4" height="6" rx="1" fill="white"/><rect x="51" y="65" width="4" height="6" rx="1" fill="white"/>') },
    { label: 'Rey',        svg: _devilSVG('#92400e','#78350f','#fcd5b4', '<polygon points="29,36 37,18 45,28 50,15 55,28 63,18 71,36 69,38 31,38" fill="#fbbf24"/><rect x="30" y="36" width="40" height="6" rx="1" fill="#d97706"/><circle cx="39" cy="21" r="2.5" fill="#f87171"/><circle cx="50" cy="16" r="2.5" fill="#34d399"/><circle cx="61" cy="21" r="2.5" fill="#60a5fa"/>') },
    { label: 'Chef',       svg: _devilSVG('#c2410c','#9a3412','#fed7aa', '<rect x="34" y="29" width="32" height="5" rx="1" fill="#e2e8f0"/><rect x="36" y="13" width="28" height="18" rx="5" fill="white"/><ellipse cx="50" cy="13" rx="15" ry="6" fill="white"/>') },
    { label: 'Músico',     svg: _devilSVG('#6d28d9','#4c1d95','#ddd6fe', '<path d="M 18,54 Q 18,25 50,25 Q 82,25 82,54" stroke="#2e1065" stroke-width="5" fill="none"/><rect x="10" y="49" width="14" height="18" rx="5" fill="#2e1065"/><rect x="76" y="49" width="14" height="18" rx="5" fill="#2e1065"/>') },
    { label: 'Deportista', svg: _devilSVG('#15803d','#14532d','#bbf7d0', '<rect x="25" y="37" width="50" height="8" rx="4" fill="white"/><rect x="27" y="39" width="46" height="4" rx="2" fill="#d1fae5"/>') },
    { label: 'Estudiante', svg: _devilSVG('#1d4ed8','#1e3a8a','#bfdbfe', '<polygon points="22,33 50,20 78,33 50,36" fill="#1e293b"/><rect x="30" y="31" width="40" height="6" rx="1" fill="#1e293b"/><line x1="66" y1="33" x2="70" y2="44" stroke="#fbbf24" stroke-width="2.5"/><circle cx="70" cy="46" r="3.5" fill="#fbbf24"/>') },
    { label: 'Artista',    svg: _devilSVG('#be185d','#9d174d','#fbcfe8', '<ellipse cx="54" cy="31" rx="21" ry="8" fill="#9d174d" transform="rotate(-12 54 31)"/><circle cx="40" cy="26" r="4.5" fill="#831843"/>') },
    { label: 'Pirata',     svg: _devilSVG('#0f766e','#115e59','#a7f3d0', '<ellipse cx="40" cy="52" rx="9" ry="7" fill="#0f172a"/><line x1="33" y1="47" x2="24" y2="39" stroke="#0f172a" stroke-width="2.5"/><line x1="47" y1="47" x2="53" y2="39" stroke="#0f172a" stroke-width="2.5"/>') },
    { label: 'Astronauta', svg: _devilSVG('#1e3a8a','#172554','#93c5fd', '<circle cx="50" cy="57" r="33" fill="none" stroke="white" stroke-width="7"/><path d="M 22,48 Q 50,36 78,48" stroke="rgba(255,255,255,0.4)" stroke-width="3" fill="none"/>') },
    { label: 'Ninja',      svg: _devilSVG('#1e293b','#0f172a','#94a3b8', '<rect x="25" y="37" width="50" height="8" rx="3" fill="#0f172a"/><rect x="25" y="57" width="50" height="18" rx="3" fill="#0f172a"/><line x1="25" y1="63" x2="75" y2="63" stroke="#374151" stroke-width="1.5"/>') },
    { label: 'Científico', svg: _devilSVG('#0891b2','#164e63','#a5f3fc', '<circle cx="40" cy="52" r="8" fill="none" stroke="#1e293b" stroke-width="2.5"/><circle cx="60" cy="52" r="8" fill="none" stroke="#1e293b" stroke-width="2.5"/><line x1="48" y1="52" x2="52" y2="52" stroke="#1e293b" stroke-width="2.5"/><line x1="68" y1="50" x2="74" y2="47" stroke="#1e293b" stroke-width="2.5"/>') },
    { label: 'Rockero',    svg: _devilSVG('#7f1d1d','#450a0a','#fca5a5', '<path d="M 44 68 Q 50 80 56 68" fill="#ef4444"/><ellipse cx="50" cy="73" rx="5" ry="5" fill="#ef4444"/><circle cx="35" cy="47" r="3" fill="#fbbf24"/>') },
    { label: 'Médico',     svg: _devilSVG('#166534','#14532d','#d1fae5', '<rect x="36" y="30" width="28" height="6" rx="3" fill="white"/><path d="M 38,60 Q 38,68 50,68 Q 62,68 62,60" stroke="white" stroke-width="3" fill="none"/><line x1="50" y1="56" x2="50" y2="72" stroke="white" stroke-width="3"/>') },
    { label: 'Vikingo',    svg: _devilSVG('#7c2d12','#451a03','#fed7aa', '<path d="M 30,72 Q 50,86 70,72" fill="#92400e"/><ellipse cx="50" cy="79" rx="18" ry="8" fill="#92400e"/><line x1="34" y1="76" x2="30" y2="88" stroke="#92400e" stroke-width="3"/><line x1="66" y1="76" x2="70" y2="88" stroke="#92400e" stroke-width="3"/>') },
    { label: 'Detective',  svg: _devilSVG('#374151','#1f2937','#e5e7eb', '<polygon points="24,36 30,18 70,18 76,36" fill="#111827"/><ellipse cx="50" cy="18" rx="28" ry="5" fill="#111827"/>') }
];

function renderAvatarGallery(selectedUrl) {
    const gallery = document.getElementById('avatar-gallery');
    if (!gallery) return;
    gallery.innerHTML = '';
    AVATAR_OPTIONS.forEach((opt, idx) => {
        const avatarId = `avatar-${idx}`;
        const isSelected = selectedUrl === avatarId;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'avatar-option' + (isSelected ? ' selected' : '');
        btn.style.background = 'none';
        btn.style.padding = '0';
        btn.title = opt.label;
        btn.innerHTML = opt.svg;
        const svgEl = btn.querySelector('svg');
        if (svgEl) { svgEl.style.cssText = 'width:100%;height:100%;border-radius:50%;display:block;'; }
        btn.onclick = () => selectAvatar(idx);
        gallery.appendChild(btn);
    });
}

function selectAvatar(idx) {
    const avatarId = `avatar-${idx}`;
    document.getElementById('profile-photo').value = avatarId;
    showAvatarIcon(idx);
    document.querySelectorAll('.avatar-option').forEach((btn, i) => {
        btn.classList.toggle('selected', i === idx);
    });
}

// Helper: show SVG devil in profile page big avatar
function showAvatarIcon(idx) {
    const opt = AVATAR_OPTIONS[idx];
    if (!opt) return;
    const imgEl = document.getElementById('profile-avatar-big');
    const iconDisplay = document.getElementById('profile-avatar-icon-display');
    if (imgEl) imgEl.style.display = 'none';
    if (iconDisplay) {
        iconDisplay.style.display = 'flex';
        iconDisplay.style.background = 'none';
        iconDisplay.innerHTML = opt.svg;
        const svgEl = iconDisplay.querySelector('svg');
        if (svgEl) svgEl.style.cssText = 'width:100%;height:100%;border-radius:50%;';
    }
}

// Helper: show img avatar (URL fallback)
function showAvatarImg(src) {
    const imgEl = document.getElementById('profile-avatar-big');
    const iconDisplay = document.getElementById('profile-avatar-icon-display');
    if (imgEl) { imgEl.style.display = 'block'; imgEl.src = src; }
    if (iconDisplay) iconDisplay.style.display = 'none';
}

// Override populateUserData to also render SVG devil in header/carnet
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
            if (headerAvatar) headerAvatar.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(opt.svg)}`;
        }
    }
};

// =========================================
// TUTORIAL LOGIC
// =========================================

const TUTORIAL_STEPS = [
    {
        title: "¡Bienvenido al Club! 👋",
        text: "Somos el Club Atlético Sarmiento. Este portal es tu espacio como socio. Te mostramos en un minuto todo lo que podés hacer acá.",
        section: null,
        icon: '🏟️'
    },
    {
        title: "🏠 Inicio",
        text: "Esta es tu pantalla principal. Acá vas a encontrar tu carnet digital para entrar a las instalaciones, las últimas noticias del club y un resumen de tu cuenta.",
        section: 'inicio',
        icon: '🏠'
    },
    {
        title: "📅 Horarios y Actividades",
        text: "En esta sección encontrás todas las actividades deportivas y culturales del club. Podés ver los horarios y anotarte a las clases directamente desde acá.",
        section: 'horarios',
        icon: '📅'
    },
    {
        title: "💳 Mis Cuotas",
        text: "Acá podés consultar el estado de tu cuenta, ver qué cuotas tenés al día o pendientes, y registrar tus pagos. Mantener la cuota al día te permite acceder a todos los beneficios del club.",
        section: 'finanzas',
        icon: '💳'
    },
    {
        title: "📰 Noticias y Eventos",
        text: "Seguí todas las novedades del club: torneos, actos, eventos especiales y mucho más. Podés leer los artículos completos con un solo toque.",
        section: 'noticias',
        icon: '📰'
    },
    {
        title: "🏛️ Institucional",
        text: "Conocé la comisión directiva, los reglamentos internos y la historia del club. Si tenés dudas sobre las normas, encontrás todo acá.",
        section: 'institucional',
        icon: '🏛️'
    },
    {
        title: "👤 Mi Perfil",
        text: "Completá tus datos personales: teléfono, email, dirección y contacto de emergencia. También podés elegir tu avatar de la galería. ¡A más datos completos, mejor atención!",
        section: 'perfil',
        icon: '👤'
    },
    {
        title: "💬 Asistente Virtual",
        text: "¿Tenés alguna duda? El botón verde de la esquina inferior derecha abre nuestro asistente, disponible las 24 horas. ¡Preguntale lo que necesites sobre el club!",
        section: 'inicio',
        icon: '💬'
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

    // Update icon
    const iconEl = document.getElementById('tutorial-icon');
    if (iconEl) iconEl.innerText = step.icon || '📌';

    document.getElementById('tutorial-title').innerText = step.title;
    document.getElementById('tutorial-text').innerText = step.text;

    // Update dots
    const progressContainer = document.querySelector('.tutorial-progress');
    progressContainer.innerHTML = '';
    for (let i = 0; i < TUTORIAL_STEPS.length; i++) {
        const dot = document.createElement('span');
        dot.className = 'step-dot' + (i === currentTutorialStep ? ' active' : '');
        progressContainer.appendChild(dot);
    }

    // Step counter
    const counterEl = document.getElementById('tutorial-counter');
    if (counterEl) counterEl.innerText = `${currentTutorialStep + 1} / ${TUTORIAL_STEPS.length}`;

    // Button text
    const nextBtn = document.getElementById('tutorial-next-btn');
    if (currentTutorialStep === TUTORIAL_STEPS.length - 1) {
        nextBtn.innerText = '¡Empezar a usar el Club!';
    } else {
        nextBtn.innerText = currentTutorialStep === 0 ? 'Comenzar recorrido →' : 'Siguiente →';
    }

    // Remove previous nav pulse highlights
    document.querySelectorAll('.tutorial-nav-pulse').forEach(el => el.classList.remove('tutorial-nav-pulse'));

    // Navigate to the section and highlight its nav button
    if (step.section) {
        if (typeof _prevNavigate === 'function') _prevNavigate(step.section);
        else navigate(step.section);

        // Pulse the matching nav button in sidebar + mobile nav
        document.querySelectorAll('.nav-btn, .mobile-nav-item').forEach(btn => {
            const oc = btn.getAttribute('onclick') || '';
            if (oc.includes(`'${step.section}'`) || oc.includes(`"${step.section}"`)) {
                btn.classList.add('tutorial-nav-pulse');
            }
        });
    }
}

function nextTutorialStep() {
    currentTutorialStep++;
    if (currentTutorialStep >= TUTORIAL_STEPS.length) finishTutorial();
    else renderTutorialStep();
}

function skipTutorial() { finishTutorial(); }

function finishTutorial() {
    document.getElementById('tutorial-overlay').classList.remove('active');
    document.querySelectorAll('.tutorial-nav-pulse').forEach(el => el.classList.remove('tutorial-nav-pulse'));
    navigate('inicio');
    if (tutorialUserId) localStorage.setItem(`club_tutorial_done_${tutorialUserId}`, 'true');
}

// =========================================
// SUPABASE & DYNAMIC ACTIVITIES
// =========================================

let supabaseClient = null;
let editingAdminActivityId = null;

if (window.supabaseConfig && window.supabaseConfig.url && window.supabaseConfig.key && window.supabaseConfig.url !== 'TU_SUPABASE_URL_AQUI') {
    supabaseClient = window.supabase.createClient(window.supabaseConfig.url, window.supabaseConfig.key);
}

let defaultActivities = [
    { id: 1, name: "Escuelita de Fútbol", category: "Fútbol", day: "Lunes", time: "16:00 hs", prof: "Prof. Martín", place: "Cancha Auxiliar", color: "green", icon: "ph-soccer-ball" },
    { id: 2, name: "Natación Adultos", category: "Natación", day: "Lunes", time: "18:00 hs", prof: "Prof. Laura", place: "Pileta Climatizada", color: "blue", icon: "ph-swimming-pool" },
    { id: 3, name: "Básquet Primera", category: "Básquet", day: "Lunes", time: "20:00 hs", prof: "Prof. Diego", place: "Estadio Principal", color: "orange", icon: "ph-basketball" },
    { id: 4, name: "Básquet Formativas", category: "Básquet", day: "Martes", time: "17:00 hs", prof: "Prof. Diego", place: "Estadio Principal", color: "orange", icon: "ph-basketball" },
    { id: 5, name: "Zumba", category: "Todos", day: "Martes", time: "19:00 hs", prof: "Prof. Ana", place: "Salón de Usos Múltiples", color: "purple", icon: "ph-activity" }
];

async function loadActivities() {
    let activities = [];
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient.from('activities').select('*').order('id', { ascending: true });
            if (error) throw error;
            activities = data || [];
        } catch (e) {
            console.error('Error loading activities from Supabase', e);
            activities = dbGet('club_activities');
            if (!activities || activities.length === 0) {
                activities = defaultActivities;
            }
        }
    } else {
        activities = dbGet('club_activities');
        if (!activities || activities.length === 0) {
            activities = defaultActivities;
            dbSet('club_activities', activities);
        }
    }
    
    window.currentActivities = activities;
    renderActivities(activities);
    renderAdminActivities(activities);
}

function renderActivities(activities) {
    const container = document.getElementById('schedule-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    
    days.forEach(day => {
        const dayActs = activities.filter(a => a.day && a.day.includes(day));
        if (dayActs.length > 0) {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'schedule-day';
            dayDiv.innerHTML = `<h3>${day}</h3>`;
            
            dayActs.forEach(act => {
                const itemHtml = `
                    <div class="schedule-item" data-category="${act.category}">
                        <div class="time">${act.time}</div>
                        <div class="details">
                            <h4>${act.name}</h4>
                            <span>${act.place} • ${act.prof}</span>
                        </div>
                        <button class="btn-enroll" onclick="enrollActivity('${act.name}', '${act.day} ${act.time}', '${act.color}', '${act.icon}')">Inscribirme</button>
                    </div>
                `;
                dayDiv.innerHTML += itemHtml;
            });
            container.appendChild(dayDiv);
        }
    });
}

function renderAdminActivities(activities) {
    const list = document.getElementById('admin-activities-list');
    if (!list) return;
    
    list.innerHTML = '';
    activities.forEach(act => {
        list.innerHTML += `
            <tr>
                <td><strong>${act.name}</strong></td>
                <td>${act.category}</td>
                <td>${act.day} - ${act.time}</td>
                <td>${act.place} / ${act.prof}</td>
                <td>
                    <button class="btn-secondary" style="padding: 6px; min-width: auto; border: none; background: rgba(59, 130, 246, 0.1); color: #3b82f6;" onclick="editAdminActivity(${act.id})" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-delete" onclick="deleteAdminActivity(${act.id})" title="Eliminar"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

async function saveAdminActivity() {
    const name = document.getElementById('admin-act-name').value;
    const category = document.getElementById('admin-act-category').value || 'Todos';
    
    const dayCheckboxes = document.querySelectorAll('.admin-act-day-cb:checked');
    const day = Array.from(dayCheckboxes).map(cb => cb.value).join(', ');
    const time = document.getElementById('admin-act-time').value;
    const prof = document.getElementById('admin-act-prof').value;
    const place = document.getElementById('admin-act-place').value;
    const color = document.getElementById('admin-act-color').value;
    const icon = document.getElementById('admin-act-icon').value;
    
    if (!name || !day || !time) {
        alert("Completar Nombre, Día y Horario.");
        return;
    }
    
    const newAct = {
        name, category, day, time, prof, place, color, icon
    };
    
    if (editingAdminActivityId) {
        newAct.id = editingAdminActivityId;
    } else {
        newAct.id = Date.now();
    }
    
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('activities').upsert([newAct]);
            if (error) throw error;
        } catch (e) {
            console.error('Error saving to Supabase', e);
            alert('Error al conectar con Supabase. Asegúrate de haber creado la tabla activities. Se guardó localmente.');
            saveLocalActivity(newAct);
        }
    } else {
        saveLocalActivity(newAct);
    }
    
    // Reset form
    document.getElementById('admin-act-name').value = '';
    document.querySelectorAll('.admin-act-day-cb').forEach(cb => cb.checked = false);
    document.getElementById('admin-act-time').value = '';
    document.getElementById('admin-act-prof').value = '';
    document.getElementById('admin-act-place').value = '';
    editingAdminActivityId = null;
    
    const msg = document.getElementById('admin-act-msg');
    msg.innerText = "¡Actividad guardada!";
    setTimeout(() => msg.innerText='', 3000);
    
    loadActivities();
}

function saveLocalActivity(newAct) {
    let localActs = dbGet('club_activities');
    if(!localActs || localActs.length === 0) localActs = defaultActivities;
    
    const idx = localActs.findIndex(a => a.id === newAct.id);
    if (idx >= 0) {
        localActs[idx] = newAct;
    } else {
        localActs.push(newAct);
    }
    dbSet('club_activities', localActs);
}

function editAdminActivity(id) {
    const act = window.currentActivities.find(a => a.id === id);
    if (!act) return;
    
    editingAdminActivityId = id;
    
    document.getElementById('admin-act-name').value = act.name;
    document.getElementById('admin-act-category').value = act.category;
    
    document.querySelectorAll('.admin-act-day-cb').forEach(cb => {
        cb.checked = act.day && act.day.includes(cb.value);
    });
    document.getElementById('admin-act-time').value = act.time;
    document.getElementById('admin-act-prof').value = act.prof;
    document.getElementById('admin-act-place').value = act.place;
    document.getElementById('admin-act-color').value = act.color;
    document.getElementById('admin-act-icon').value = act.icon;
    
    document.getElementById('admin-activity-form').style.display = 'block';
    document.getElementById('admin-activity-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteAdminActivity(id) {
    if(!confirm("¿Seguro que deseas eliminar esta actividad?")) return;
    
    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('activities').delete().eq('id', id);
            if (error) throw error;
        } catch (e) {
            console.error('Error deleting from Supabase', e);
            alert('Error al borrar en Supabase: ' + (e.message || 'Error desconocido. Revisa los permisos RLS.'));
        }
    } else {
        let localActs = dbGet('club_activities');
        localActs = localActs.filter(a => a.id !== id);
        dbSet('club_activities', localActs);
    }
    
    loadActivities();
}

// Ensure activities are loaded when app starts
document.addEventListener('DOMContentLoaded', () => {
    loadActivities();
});

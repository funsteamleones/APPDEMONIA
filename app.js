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
        const adminBtn = document.querySelector('.admin-only');
        if (currentUser.role === 'admin') {
            adminBtn.style.display = 'flex';
            refreshAdminTable();
        } else {
            adminBtn.style.display = 'none';
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

function readMoreNews() {
    alert("Pronto podrás leer la noticia completa en detalle. ¡Estamos trabajando en esta funcionalidad!");
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

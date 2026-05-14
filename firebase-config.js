// ============================================================
//  FIREBASE CONFIG - Club Sarmiento
// ============================================================
//
//  Para activar la base de datos en la nube (GRATIS):
//  1. Ir a https://console.firebase.google.com
//  2. Crear un proyecto nuevo (plan Spark = gratis)
//  3. Ir a "Firestore Database" > Crear base de datos > modo producción
//  4. Ir a Configuración del proyecto > General > Tu app web > Agregar app
//  5. Copiá el objeto firebaseConfig y pegalo abajo
//  6. En Firestore Rules, poner:
//     allow read: if true;
//     allow write: if true;  (solo para desarrollo, luego ajustar)
//
//  Mientras no esté configurado, la app usa localStorage como fallback.
// ============================================================

window.FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
};

window.FIREBASE_ENABLED = !!(
    window.FIREBASE_CONFIG.apiKey &&
    window.FIREBASE_CONFIG.projectId
);

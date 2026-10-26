# HABITA NL v0.9.1 — Alta del administrador principal

## Objetivo
Esta actualización incluye una pantalla independiente para que la cuenta Gmail elegida inicie sesión con Google y muestre su UID de Firebase Authentication. **No concede acceso administrativo automáticamente.** Se conserva `gestor.html` como base de la aplicación multiusuario anterior y `demo_v08.html` como demostración local.

## Publicar sin instalar programas ni pagar
1. Abre GitHub desde el navegador con una cuenta que controle el proyecto. Crea un repositorio **público** exclusivo para esta prueba, por ejemplo `habita-nl-acceso`. No subas datos de clientes ni credenciales privadas.
2. Sube **el contenido** de esta carpeta (los archivos `index.html`, `bootstrap.js`, `firebase-config.js`, etc.) a la raíz del repositorio, usando `Add file` → `Upload files`.
3. En el repositorio, `Settings` → `Pages` → `Build and deployment`: selecciona `Deploy from a branch`, `main`, carpeta `/(root)` y guarda.
4. Espera la publicación y copia la dirección HTTPS que GitHub Pages muestra. Será similar a `https://USUARIO.github.io/habita-nl-acceso/`.
5. Firebase Console → Authentication → Configuración → Dominios autorizados: agrega **solo el host** `USUARIO.github.io`, sin `https://` ni ruta. No agregues dominios de terceros.
6. Abre la página publicada en una ventana de incógnito, inicia sesión con el Gmail destinado a administrar HABITA NL y copia su UID. Si el navegador bloquea ventanas emergentes, permítelas para tu página.
7. Desde la cuenta que creó Firebase, entra a Authentication → Usuarios y verifica el registro. Con la consola autorizada crea en Firestore → Datos un documento en colección `users` cuyo ID sea exactamente el UID. Campos de tipo string: `email` (el correo exacto autenticado), `role` = `admin`, `status` = `active`.
8. **No publiques aún `firestore.rules` sin revisión y pruebas de permisos.** Las reglas actuales `allow read, write: if false` permanecen bloqueadas y no interfieren con Authentication.

## Importante
- GitHub Pages para un repositorio público es un sitio públicamente accesible: el código y la configuración web de Firebase son visibles, como es habitual en aplicaciones cliente. No subas secretos, contraseñas, llaves de servicio ni información personal.
- `firebase-config.js` se precargó con los datos visibles en la captura proporcionada. Verifícalos en Firebase Console → Configuración del proyecto → Tus apps antes de publicar.
- El registro inicial con Google crea un usuario de Authentication; el documento de Firestore es un paso separado que solo debe realizar un operador con permisos de consola.
- No se usa Firebase Storage ni Blaze. Las cuotas de Spark aplican.
- La interfaz `gestor.html` aún es una base de integración y no está lista para datos reales. Antes de habilitarla, se deben revisar las reglas de Firestore, sobre todo los campos internos de las propiedades y la separación de datos personales.

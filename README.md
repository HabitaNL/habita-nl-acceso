# HABITA NL — CRM Inmobiliario v2.0

**Grupo Inmobiliario HABITA NL**

Sistema de gestión inmobiliaria multiusuario para administrar propiedades, prospectos, actividades comerciales, oportunidades de negocio y reportes de desempeño.

## 1. Acceso al sistema

**CRM:** https://habitanl.github.io/habita-nl-acceso/gestor.html

**Repositorio:** https://github.com/HabitaNL/habita-nl-acceso

El sistema utiliza Firebase Authentication para autenticar usuarios mediante Google y Firestore para almacenar información.

El acceso está condicionado a que el usuario tenga un perfil autorizado y activo.

## 2. Perfiles y permisos

### Administrador

- Registrar propiedades.
- Editar información de propiedades.
- Administrar fotografías.
- Archivar, restaurar y eliminar propiedades.
- Consultar el inventario compartido.
- Consultar información comercial del equipo según los permisos configurados.
- Supervisar oportunidades y reportes por asesor.

### Asesor

- Consultar el inventario compartido.
- Consultar fotografías de propiedades.
- Exportar inventario a CSV.
- Registrar y gestionar sus propios prospectos.
- Registrar actividades y seguimientos.
- Administrar sus oportunidades comerciales.
- Consultar sus indicadores comerciales.

**Restricción de inventario:** solamente el administrador puede crear, modificar y eliminar propiedades. Esta restricción se aplica mediante reglas de Firestore y controles de visibilidad en la aplicación.

## 3. Módulos principales

### Inventario inmobiliario

Registro y consulta de propiedades, incluyendo municipio, colonia, precio, habitaciones, baños, formas de pago y estado comercial.

Incluye galería fotográfica, exportación CSV y herramientas administrativas.

### Prospectos

Registro y seguimiento de prospectos, con separación de información personal por asesor y preferencias inmobiliarias compartidas de manera anónima.

### Actividades y agenda

Registro de actividades comerciales, seguimientos, visitas y compromisos pendientes.

### Oportunidades comerciales

Vinculación de prospectos con propiedades para dar seguimiento a las negociaciones y sus etapas comerciales.

### Embudo comercial

Visualización de oportunidades por etapa, valor comercial estimado y desempeño por asesor.

**Importante:** el valor de las oportunidades representa potencial comercial, no ingresos efectivamente cobrados.

### Dashboard y alertas

Indicadores de inventario, prospectos, actividades y seguimiento comercial, junto con alertas sobre actividades pendientes.

## 4. Tecnologías utilizadas

- HTML, CSS y JavaScript.
- Firebase Authentication.
- Cloud Firestore.
- Firebase Storage para fotografías.
- GitHub Pages para publicar la aplicación.
- GitHub para control de versiones y respaldos.

El sistema funciona desde un navegador web, sin necesidad de instalar software adicional para su operación habitual.

## 5. Archivos principales

| Archivo | Descripción |
|---|---|
| `gestor.html` | Interfaz principal del CRM |
| `app.js` | Lógica de módulos y operaciones |
| `bootstrap.js` | Inicialización y acceso |
| `firebase-config.js` | Configuración de conexión con Firebase |
| `index.html` | Página de acceso |
| `demo_v08.html` | Demostración histórica |

## 6. Seguridad

El repositorio es público y su código puede consultarse en GitHub.

Por seguridad:

- No publicar contraseñas, credenciales privadas ni claves de cuentas de servicio.
- No incorporar datos personales reales en el código fuente.
- Mantener las autorizaciones de acceso en Firebase.
- Validar los permisos mediante reglas de Firestore y Storage.
- No considerar los controles visuales como sustitutos de las reglas de seguridad.
- Revisar los permisos antes de incorporar nuevas colecciones o funcionalidades.

Las reglas de Firebase se administran por separado del repositorio y deben respaldarse independientemente.

## 7. Versiones y respaldos

**Versión actual:** v2.0 — Embudo comercial y reportes por asesor, con restricciones administrativas del inventario.

**Rama de producción:** `main`

**Respaldos disponibles:**

- `respaldo-v1.9.1`
- `respaldo-v2.0-permisos`

Los desarrollos nuevos deben realizarse sin modificar las ramas de respaldo.

## 8. Próximas mejoras

El sistema continuará evolucionando mediante nuevas funcionalidades comerciales, mejoras de usabilidad, reportes y controles administrativos.

Cada modificación deberá probarse con los perfiles de administrador y asesor antes de considerarse terminada.

---

**HABITA NL — Plataforma de Gestión Inmobiliaria**

Documentación actualizada: octubre de 2026.

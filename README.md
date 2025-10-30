# 🎧 Noizzy — Backend (Node.js + Express + MongoDB)

API del proyecto **Noizzy**, un reproductor de música full-stack con autenticación, gestión de favoritos, estadísticas de escucha y subida de archivos a la nube.

---

## 🚀 Descripción general

El backend de **Noizzy** gestiona toda la lógica de negocio y persistencia de datos del proyecto.  
Está construido con **Express + MongoDB (Mongoose)**, y ofrece endpoints seguros para:

- 👤 Registro, login y autenticación JWT  
- 💟 Gestión de favoritos por usuario  
- 🎵 Registro de eventos de reproducción y ticks de escucha  
- 📊 Agregaciones de estadísticas diarias y por género  
- ☁️ Subida de pistas y portadas a **Cloudinary**

---

## 🧰 Tech Stack

- ⚙️ **Node.js 20+**
- 🚀 **Express.js**
- 🧱 **MongoDB + Mongoose**
- 🔒 **JWT** (JSON Web Tokens)
- 🔐 **bcryptjs**
- ☁️ **Cloudinary SDK** (para portadas y tracks)
- 🧪 **Jest + Supertest**
- 🧰 **dotenv**, **cors**, **morgan**, **helmet**

---


## 🚀 BACKEND — Testing (Jest + Supertest + MongoDB)

```markdown
## 🧪 Testing & QA

El backend de **Noizzy** está completamente cubierto mediante tests unitarios e integrados, asegurando la estabilidad de controladores, rutas y modelos Mongoose.

### ⚙️ Stack de pruebas
- 🧰 **Framework:** [Jest](https://jestjs.io) + [Supertest](https://github.com/ladjs/supertest)
- 💾 **Base de datos:** MongoDB (mockeada con Mongoose)
- 🔐 **Mocks:** Firebase Admin, Google OAuth, JWT, bcrypt, Cloudinary  

### 🧩 Cobertura
- Controladores:
  - `auth.controller.js`
  - `favorites.controller.js`
  - `stats.controller.js`
- Modelos:
  - `User`, `Track`, `PlayEvent`, `ListeningTick`
- Rutas REST: `/api/auth`, `/api/favorites`, `/api/stats`

### ▶️ Ejecución
```bash
npx jest --coverage

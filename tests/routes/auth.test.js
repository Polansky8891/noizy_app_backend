const request = require('supertest');
const { app } = require('../../index'); // Usar index.js (asumiendo que resolviste la exportación)
const { Router } = require('express');

// --- MOCKING DE CONTROLADORES Y MIDDLEWARES ---

// Mock de Controladores Auth
jest.mock('../../controllers/auth', () => ({
    createUser: jest.fn((req, res) => res.status(201).json({ ok: true, msg: 'register_mock' })),
    loginUser: jest.fn((req, res) => res.json({ ok: true, msg: 'login_mock' })),
    renewToken: jest.fn((req, res) => res.json({ ok: true, msg: 'renew_mock' })),
    googleSignIn: jest.fn((req, res) => res.json({ ok: true, msg: 'google_mock' })),
})); 

// Mockear validateJWT middleware (SOLUCIÓN DE ÁMBITO)
jest.mock('../../middlewares/validate-jwt', () => {
    const validateJWT = jest.fn((req, res, next) => {
        req.uid = 'mock-uid-123'; 
        next();
    });
    return { validateJWT };
});

// OBTENEMOS LAS FUNCIONES MOCKEADAS PARA LAS EXPECTATIVAS
const authController = require('../../controllers/auth');
const { validateJWT } = require('../../middlewares/validate-jwt'); 

// Datos de prueba
const validUser = {
    name: 'Test Name',
    email: 'test@example.com',
    password: 'password123456',
};

// ----------------------------------------------------------------------
// TESTS DE RUTAS DE AUTENTICACIÓN
// ----------------------------------------------------------------------
describe('Auth Routes Testing', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ------------------------------------------------------------------
    // 1. POST /new (Registro)
    // ------------------------------------------------------------------
    describe('POST /new (Registration)', () => {
        
        it('1.1 Debe retornar 201 y llamar a createUser para un payload válido', async () => {
            await request(app)
                .post('/api/auth/new') // <--- CORREGIDO
                .send(validUser)
                .expect(201); 

            expect(authController.createUser).toHaveBeenCalledTimes(1);
        });

       it('1.2 Debe retornar 400 si falta el campo name', async () => {
        const { name, ...invalidPayload } = validUser;
        
        await request(app)
            .post('/api/auth/new')
            .send(invalidPayload)
            .expect(400) 
            .then(response => {
            // CORRECCIÓN FINAL: Asumimos que response.body.errors es un OBJETO con los errores.
            const body = response.body;
            
            // Verificamos que el mensaje 'name is mandatory' esté presente en algún lugar del body.
            // Esto es más seguro que desestructurar un array específico.
            
            // Opción 1: Búsqueda estricta en el objeto body (si errors existe)
            const errorKeys = Object.keys(body.errors || {});
            
            // Verificamos que al menos un campo del error contenga el mensaje (ej: body.errors.name.msg)
            const hasRequiredMsg = JSON.stringify(body).includes('name is mandatory');

            expect(hasRequiredMsg).toBe(true);
            
            // Verificamos que el controlador NO fue llamado
            expect(authController.createUser).not.toHaveBeenCalled();
        });
        });
        
        it('1.3 Debe retornar 400 si el password es menor de 6 caracteres', async () => {
            const invalidPayload = { ...validUser, password: '123' };
            
            await request(app)
                .post('/api/auth/new') // <--- CORREGIDO
                .send(invalidPayload)
                .expect(400);

            expect(authController.createUser).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // 2. POST / (Login)
    // ------------------------------------------------------------------
    describe('POST / (Login)', () => {
        
        it('2.1 Debe retornar 200 y llamar a loginUser para un payload válido', async () => {
            const loginPayload = { email: validUser.email, password: validUser.password };
            
            await request(app)
                .post('/api/auth') // <--- CORREGIDO
                .send(loginPayload)
                .expect(200);

            expect(authController.loginUser).toHaveBeenCalledTimes(1);
        });
        
        it('2.2 Debe retornar 400 si el email no es válido', async () => {
            const invalidPayload = { email: 'not-an-email', password: validUser.password };
            
            await request(app)
                .post('/api/auth') // <--- CORREGIDO
                .send(invalidPayload)
                .expect(400);

            expect(authController.loginUser).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // 3. GET /renew (Renovación de Token)
    // ------------------------------------------------------------------
    describe('GET /renew (Token Renewal)', () => {
        
        it('3.1 Debe retornar 200 y llamar a renewToken (validateJWT mockeado)', async () => {
            await request(app)
                .get('/api/auth/renew') // <--- CORREGIDO
                .expect(200);

            expect(validateJWT).toHaveBeenCalledTimes(1);
            expect(authController.renewToken).toHaveBeenCalledTimes(1);
        });
    });

    // ------------------------------------------------------------------
    // 4. POST /google (Google Sign In)
    // ------------------------------------------------------------------
    describe('POST /google (Google Sign In)', () => {
        
        it('4.1 Debe retornar 200 y llamar a googleSignIn', async () => {
            await request(app)
                .post('/api/auth/google') // <--- CORREGIDO
                .send({ token: 'mock-google-token' }) 
                .expect(200);

            expect(authController.googleSignIn).toHaveBeenCalledTimes(1);
        });
    });

});
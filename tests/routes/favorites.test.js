const request = require('supertest');
const { app } = require('../../index'); // Asumimos la ruta a tu instancia Express

// --- MOCKING DE CONTROLADORES Y MIDDLEWARES ---

// Mockear validateJWT middleware (SOLUCIÓN DE ÁMBITO)
jest.mock('../../middlewares/validate-jwt', () => {
    // Definimos la función DENTRO del callback
    const validateJWT = jest.fn((req, res, next) => {
        req.uid = 'mock-uid-123'; // Inyectamos un UID mockeado
        next();
    });
    return { validateJWT };
});

// OBTENEMOS LAS FUNCIONES MOCKEADAS PARA LAS EXPECTATIVAS
const favoritesController = require('../../controllers/favorites');

// **CORRECCIÓN CLAVE:** Obtenemos la referencia de validateJWT de forma segura
const validateJWTReference = require('../../middlewares/validate-jwt').validateJWT;

// Datos de prueba
const MOCK_TRACK_ID = '60a1234567890abcdef01234a'; 

// NOTA: Asumimos que la ruta principal es '/api/me/favorites' según tu index.js
const BASE_ROUTE = '/api/me/favorites'; 

// ----------------------------------------------------------------------
// TESTS DE RUTAS DE FAVORITOS
// ----------------------------------------------------------------------
describe('Favorites Routes Testing', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ------------------------------------------------------------------
    // 1. GET / (Obtener Favoritos)
    // ------------------------------------------------------------------
    it('1.1 GET / Debe requerir token, pasar la autorización y llamar a getFavorites', async () => {
        await request(app)
            .get(BASE_ROUTE)
            .expect(200)
            .then(response => {
                expect(response.body.msg).toBe('get_mock');
            });

        expect(validateJWTReference).toHaveBeenCalledTimes(1);
        expect(favoritesController.getFavorites).toHaveBeenCalledTimes(1);
    });

    // ------------------------------------------------------------------
    // 2. POST / (Añadir Favorito)
    // ------------------------------------------------------------------
    describe('POST / (Add Favorite)', () => {

        it('2.1 Debe retornar 200 y llamar a addFavorite para un trackId válido', async () => {
            const payload = { trackId: MOCK_TRACK_ID };

            await request(app)
                .post(BASE_ROUTE)
                .send(payload)
                .expect(200);

            expect(validateJWTReference).toHaveBeenCalledTimes(1);
            expect(favoritesController.addFavorite).toHaveBeenCalledTimes(1);
        });

        it('2.2 Debe retornar 400 si falta el trackId (Validación)', async () => {
            await request(app)
                .post(BASE_ROUTE)
                .send({})
                .expect(400)
                .then(response => {
                    expect(response.body.errors[0].msg).toContain('El trackId es obligatorio');
                });

            expect(favoritesController.addFavorite).not.toHaveBeenCalled();
        });
    });

    // ------------------------------------------------------------------
    // 3. DELETE /:trackId (Eliminar Favorito)
    // ------------------------------------------------------------------
    describe('DELETE /:trackId (Remove Favorite)', () => {

        it('3.1 Debe retornar 200 y llamar a removeFavorite para un ID válido', async () => {
            await request(app)
                .delete(`${BASE_ROUTE}/${MOCK_TRACK_ID}`)
                .expect(200);

            expect(validateJWTReference).toHaveBeenCalledTimes(1);
            expect(favoritesController.removeFavorite).toHaveBeenCalledTimes(1);
        });
    });

});
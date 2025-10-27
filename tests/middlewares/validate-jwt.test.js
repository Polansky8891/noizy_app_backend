const { validateJWT } = require('../../middlewares/validate-jwt'); // Ajusta la ruta

// 1. Mockear Firebase Admin SDK
const mockVerifyIdToken = jest.fn();
const mockAdmin = {
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
    app: () => ({ options: { projectId: 'test-project-id' } }),
};
jest.mock('../../firebase/admin', () => ({
    // Inyectamos el objeto mock directamente en el callback
    auth: () => ({ verifyIdToken: mockVerifyIdToken }),
    app: () => ({ options: { projectId: 'test-project-id' } }),
}), { virtual: true });

// 2. Mockear response de Express y next()
const mockRes = () => ({
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
});
const mockNext = jest.fn();

// Constantes de prueba
const MOCK_UID = 'firebase-user-uid-123';
const VALID_TOKEN = 'Bearer VALID.PAYLOAD.TOKEN';
const INVALID_TOKEN = 'Bearer INVALID.EXPIRED.TOKEN';
const DECODED_PAYLOAD = { aud: 'my-app', iss: 'firebase' };

// Mockear la función base64urlToJson para que no falle al decodificar
// Mockeamos la dependencia base64urlToJson para simular la decodificación del payload
// Nota: La función base64urlToJson está en el mismo archivo, pero la simularemos para la prueba.

describe('validateJWT Middleware', () => {
    let req;
    let res;
    let next;

    beforeEach(() => {
        jest.clearAllMocks();
        res = mockRes();
        next = mockNext;
        
        // Configurar el mock de éxito por defecto:
        mockVerifyIdToken.mockResolvedValue({ uid: MOCK_UID });
    });

    // -----------------------------------------------------------------
    // TESTS DE FLUJO DE TOKEN
    // -----------------------------------------------------------------

    it('1.1 Debe retornar 401 si no hay token (Authorization o x-token)', async () => {
        req = { get: jest.fn((header) => {
            if (header === 'authorization' || header === 'x-token') return null;
        }) };

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'no-token' }));
        expect(next).not.toHaveBeenCalled();
    });

    it('1.2 Debe llamar a next() y adjuntar el uid si el token es válido (Formato Bearer)', async () => {
        req = { get: jest.fn((header) => (header === 'authorization' ? VALID_TOKEN : null)) };

        await validateJWT(req, res, next);

        expect(mockVerifyIdToken).toHaveBeenCalledWith('VALID.PAYLOAD.TOKEN');
        expect(req.uid).toBe(MOCK_UID);
        expect(next).toHaveBeenCalledTimes(1);
    });
    
    it('1.3 Debe llamar a next() si el token es válido (Formato x-token simple)', async () => {
        req = { get: jest.fn((header) => (header === 'x-token' ? 'TOKEN_SIMPLE' : null)) };

        await validateJWT(req, res, next);
        
        expect(mockVerifyIdToken).toHaveBeenCalledWith('TOKEN_SIMPLE');
        expect(next).toHaveBeenCalledTimes(1);
    });

    // -----------------------------------------------------------------
    // TESTS DE FALLO
    // -----------------------------------------------------------------

    it('2.1 Debe retornar 401 si verifyIdToken falla (Token inválido)', async () => {
        // Simular que Firebase rechaza el token con un código específico
        const firebaseError = { code: 'auth/id-token-expired', message: 'JWT expired' };
        mockVerifyIdToken.mockRejectedValue(firebaseError);

        req = { get: jest.fn((header) => (header === 'authorization' ? INVALID_TOKEN : null)) };

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ ok: false, code: 'auth/id-token-expired', msg: 'Token inválido o expirado' });
        expect(next).not.toHaveBeenCalled();
    });

    it('2.2 Debe retornar 401 con código default si el error no tiene código', async () => {
        // Simular un error genérico (ej. de red)
        const genericError = new Error('Network failure');
        mockVerifyIdToken.mockRejectedValue(genericError);

        req = { get: jest.fn((header) => (header === 'authorization' ? INVALID_TOKEN : null)) };

        await validateJWT(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ ok: false, code: 'invalid-token', msg: 'Token inválido o expirado' });
    });
});
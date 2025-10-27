const { generateJWT } = require('../../helpers/jwt'); // Ajusta la ruta

// Mockeamos la librería 'jsonwebtoken'
const jwt = require('jsonwebtoken');
jest.mock('jsonwebtoken', () => ({
    // Mockeamos solo la función 'sign'
    sign: jest.fn(),
}));

// Mockear la variable de entorno
process.env.SECRET_JWT_SEED = 'TEST_SEED_SECRET'; 

describe('generateJWT', () => {
    const mockUserId = '654321098765432109876543'; // ID de 24 caracteres
    const mockName = 'Test User';
    const mockToken = 'mocked-jwt-token-12345';
    
    // Configuración base de Jest y Mocks
    beforeEach(() => {
        jest.clearAllMocks();
        // Configuramos jwt.sign para simular que devuelve el token en el callback
        // El callback de jwt.sign es: (err, token) => {}
        jwt.sign.mockImplementation(
            (payload, secret, options, callback) => {
                // Siempre resolvemos sin error, devolviendo el mockToken
                callback(null, mockToken);
            }
        );
    });

    // -----------------------------------------------------------------
    // CASOS DE PRUEBA
    // -----------------------------------------------------------------

    it('1.1 Debe retornar un token válido', async () => {
        const token = await generateJWT(mockUserId, mockName);

        // 1. Debe retornar el token simulado
        expect(token).toBe(mockToken);
        
        // 2. Debe llamar a jwt.sign una vez
        expect(jwt.sign).toHaveBeenCalledTimes(1);
    });

    it('1.2 Debe llamar a jwt.sign con el payload, semilla y opciones correctas', async () => {
        await generateJWT(mockUserId, mockName);
        
        // Capturamos los argumentos con los que se llamó a jwt.sign
        const [payload, secret, options, callback] = jwt.sign.mock.calls[0];

        // 1. Verificar el Payload
        expect(payload).toEqual({
            userId: mockUserId,
            uid: mockUserId,
            name: mockName,
        });

        // 2. Verificar la Semilla Secreta
        expect(secret).toBe(process.env.SECRET_JWT_SEED);

        // 3. Verificar las Opciones
        expect(options).toEqual({
            expiresIn: '72h',
        });
    });

    it('1.3 Debe llamar a jwt.sign con el name opcional vacío', async () => {
        await generateJWT(mockUserId); // Llama sin el segundo argumento (name)
        
        const [payload] = jwt.sign.mock.calls[0];

        expect(payload.name).toBe('');
    });
    
    it('1.4 Debe rechazar la promesa si jwt.sign falla', async () => {
        // Configuramos jwt.sign para simular un error
        jwt.sign.mockImplementation(
            (payload, secret, options, callback) => {
                callback(new Error('Test JWT Error'), null); // Simular fallo
            }
        );
        
        // Usamos try/catch o rejects para testear la promesa fallida
        await expect(generateJWT(mockUserId, mockName)).rejects.toBe('token not generated');
    });

});
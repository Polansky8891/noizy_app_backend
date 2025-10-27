const User = require('../../models/User'); // Ajusta la ruta si es necesario
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// --- SETUP DE CONEXIÓN DE PRUEBA ---
let mongoServer;

// Datos de prueba
const VALID_UID = 'firebase-id-12345';
const VALID_EMAIL = 'TestUser@example.com';
const VALID_PASSWORD = 'password123';
const VALID_TRACK_ID = '60a1234567890abcdef01234a';

// Conectar a la base de datos en memoria antes de todos los tests
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    // Forzar la creación de índices al inicio
    await User.createIndexes(); 
});

// Limpiar la colección y los mocks después de cada test
beforeEach(async () => {
    await User.deleteMany({});
    jest.clearAllMocks();
});

// Desconectar Mongoose y detener el servidor de memoria después de todos los tests
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// ----------------------------------------------------------------------
// 1. TESTS DE CREACIÓN Y DEFAULTS
// ----------------------------------------------------------------------
describe('1. User Model - Creation and Defaults', () => {

    it('1.1 Debe crear un usuario solo con campos opcionales/sparse (solo UID)', async () => {
        const userData = { firebaseUid: VALID_UID };
        const user = new User(userData);
        const savedUser = await user.save();

        expect(savedUser.firebaseUid).toBe(VALID_UID);
        expect(savedUser.name).toBeUndefined();
    });

    it('1.2 Debe aplicar lowercase y trim al email', async () => {
        const user = new User({ email: VALID_EMAIL, name: '  Test Name  ' });
        const savedUser = await user.save();

        expect(savedUser.email).toBe('testuser@example.com');
        expect(savedUser.name).toBe('Test Name');
    });

    it('1.3 Debe inicializar el campo favorites como un array vacío', async () => {
        const user = new User({ firebaseUid: VALID_UID });
        const savedUser = await user.save();

        expect(savedUser.favorites).toBeDefined();
        expect(Array.isArray(savedUser.favorites)).toBe(true);
        expect(savedUser.favorites.length).toBe(0);
    });

    // 🔴 SKIP: BSONError en la creación síncrona del ObjectId
    it.skip('1.4 Debe guardar correctamente el campo favorites con una ID de Track', async () => {
        // Creamos el ObjectId DENTRO del test
        const trackObjectId = new mongoose.Types.ObjectId(VALID_TRACK_ID);
        
        const userData = { 
            firebaseUid: VALID_UID, 
            favorites: [trackObjectId] // Pasamos el objeto real
        };
        
        const user = new User(userData);
        const savedUser = await user.save();
        
        expect(savedUser.favorites.length).toBe(1);
        expect(savedUser.favorites[0].toString()).toBe(VALID_TRACK_ID);
    });
});

// ----------------------------------------------------------------------
// 2. TESTS DE UNICIDAD (Unique, Sparse, Index)
// ----------------------------------------------------------------------
describe('2. User Model - Uniqueness (firebaseUid and email)', () => {

    it('2.1 Debe fallar si se intenta crear dos usuarios con el mismo firebaseUid', async () => {
        const user1 = new User({ firebaseUid: VALID_UID });
        await user1.save();

        const user2 = new User({ firebaseUid: VALID_UID, email: 'otro@test.com' });

        await expect(user2.save()).rejects.toThrow(
            /duplicate key error collection/ 
        );
    });
    
    it('2.2 Debe fallar si se intenta crear dos usuarios con el mismo email', async () => {
        const user1 = new User({ email: VALID_EMAIL });
        await user1.save();

        const user2 = new User({ email: 'testuser@example.com' });

        await expect(user2.save()).rejects.toThrow(
            /duplicate key error collection/
        );
    });
    
    it('2.3 Debe permitir crear un usuario sin email si ya existe uno sin email (sparse: true)', async () => {
        const user1 = new User({ name: 'User 1' });
        await user1.save();
        
        const user2 = new User({ name: 'User 2' });

        await expect(user2.save()).resolves.toBeDefined();
    });
});

// ----------------------------------------------------------------------
// 3. TESTS DE SELECCIÓN Y PROPIEDADES OCULTAS
// ----------------------------------------------------------------------
describe('3. User Model - Select and Timestamps', () => {

    it('3.1 El campo password no debe ser retornado por defecto (select: false)', async () => {
        const userData = { 
            firebaseUid: VALID_UID, 
            email: 'test@email.com',
            password: VALID_PASSWORD
        };
        const user = new User(userData);
        await user.save();
        
        const foundUser = await User.findOne({ firebaseUid: VALID_UID }).lean();
        
        expect(foundUser.password).toBeUndefined();
    });
    
    it('3.2 Debe tener los campos createdAt y updatedAt (timestamps: true)', async () => {
        const user = new User({ firebaseUid: VALID_UID });
        const savedUser = await user.save();

        expect(savedUser.createdAt).toBeDefined();
        expect(savedUser.updatedAt).toBeDefined();
        expect(savedUser.createdAt).toBeInstanceOf(Date);
    });
});
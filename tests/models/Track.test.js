const Track = require('../../models/Track'); // Ajusta la ruta si es necesario
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// --- SETUP DE CONEXIÓN DE PRUEBA ---
let mongoServer;

// Datos de prueba válidos
const VALID_TRACK_DATA = {
    title: 'Minimal Groove',
    artist: 'Techno Maestro',
    duration: 300, // Duración en segundos
};

// Conectar a la base de datos en memoria antes de todos los tests
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
});

// Limpiar la colección y los mocks después de cada test
beforeEach(async () => {
    await Track.deleteMany({});
    jest.clearAllMocks();
});

// Desconectar Mongoose y detener el servidor de memoria después de todos los tests
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// ----------------------------------------------------------------------
// 1. TESTS DE VALIDACIÓN (REQUIRED y DEFAULTS)
// ----------------------------------------------------------------------
describe('1. Track Model - Validation and Defaults', () => {

    it('1.1 Debe crear y guardar un Track con éxito (Required fields)', async () => {
        const track = new Track(VALID_TRACK_DATA);
        const savedTrack = await track.save();

        expect(savedTrack.title).toBe(VALID_TRACK_DATA.title);
        expect(savedTrack.artist).toBe(VALID_TRACK_DATA.artist);
        expect(savedTrack.duration).toBe(VALID_TRACK_DATA.duration);
        expect(savedTrack.genre).toBe('Other'); // Debe usar el default
    });
    
    it('1.2 Debe fallar si falta el campo title (required)', async () => {
        const invalidData = { ...VALID_TRACK_DATA, title: undefined };
        const track = new Track(invalidData);

        await expect(track.save()).rejects.toThrow(/title.*required/);
    });

    it('1.3 Debe fallar si falta el campo artist (required)', async () => {
        const invalidData = { ...VALID_TRACK_DATA, artist: undefined };
        const track = new Track(invalidData);

        await expect(track.save()).rejects.toThrow(/artist.*required/);
    });

    it('1.4 Debe fallar si falta el campo duration (required)', async () => {
        const invalidData = { ...VALID_TRACK_DATA, duration: undefined };
        const track = new Track(invalidData);

        await expect(track.save()).rejects.toThrow(/duration.*required/);
    });
    
    it('1.5 Debe aplicar trim y eliminar espacios en blanco al inicio/final del título', async () => {
        const dataWithSpaces = { ...VALID_TRACK_DATA, title: '  Trimmed Title  ' };
        const track = new Track(dataWithSpaces);
        const savedTrack = await track.save();

        expect(savedTrack.title).toBe('Trimmed Title');
    });
});

// ----------------------------------------------------------------------
// 2. TESTS DE ENUM Y TIPOS DE DATOS
// ----------------------------------------------------------------------
describe('2. Track Model - Enum and Type Checks', () => {
    
    it('2.1 Debe aceptar un valor válido de género (enum: Techno)', async () => {
        const trackData = { ...VALID_TRACK_DATA, genre: 'Techno' };
        const track = new Track(trackData);
        const savedTrack = await track.save();

        expect(savedTrack.genre).toBe('Techno');
    });
    
    it('2.2 Debe fallar si el género no está en la lista de enum', async () => {
        const trackData = { ...VALID_TRACK_DATA, genre: 'K-Pop' }; // Valor no permitido
        const track = new Track(trackData);

        // Mongoose lanza un ValidationError indicando que el valor no es válido
        await expect(track.save()).rejects.toThrow(
            /is not a valid enum value for path `genre`/
        );
    });
    
    it('2.3 Debe usar "Other" si no se proporciona el género', async () => {
        const track = new Track({ ...VALID_TRACK_DATA, genre: undefined });
        const savedTrack = await track.save();

        expect(savedTrack.genre).toBe('Other');
    });
    
    it('2.4 Debe usar valores por defecto para audioUrl y coverUrl', async () => {
        const track = new Track(VALID_TRACK_DATA);
        const savedTrack = await track.save();

        expect(savedTrack.audioUrl).toBe('');
        expect(savedTrack.coverUrl).toBe('');
    });
});
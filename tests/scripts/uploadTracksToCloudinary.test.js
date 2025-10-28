// tests/scripts/uploadTracksToCloudinary.test.js
const path = require('path');

describe('scripts/uploadTracksToCloudinary.js', () => {
  let logSpy, warnSpy, setTimeoutSpy;
  let errorSpy; // spy global para console.error en este archivo

  /* ───────── beforeAll / afterAll (soluciona mockRestore) ───────── */
  beforeAll(() => {
    // Silencia console.error de forma segura para todo el describe
    try {
      if (!console.error || console.error._silencedByThisTest) return;
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      console.error._silencedByThisTest = true;
    } catch {
      // no-op
    }
  });

  afterAll(() => {
    // Restaurar console.error sin reventar si no hay mock
    try {
      if (errorSpy && typeof errorSpy.mockRestore === 'function') {
        errorSpy.mockRestore();
      } else if (console.error && typeof console.error.mockRestore === 'function') {
        console.error.mockRestore();
      }
    } catch {
      // no-op
    } finally {
      if (console.error && console.error._silencedByThisTest) {
        delete console.error._silencedByThisTest;
      }
    }
  });
  /* ──────────────────────────────────────────────────────────────── */

  beforeEach(() => {
    jest.resetModules();     // el script ejecuta un IIFE al cargar
    jest.clearAllMocks();

    // Evitar la espera real de 300ms del script
    setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockImplementation((fn) => { fn(); return 0; });

    // Silenciar/observar logs (log/warn por test)
    logSpy  = jest.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Conn string para mongoose.connect
    process.env.MONGODB_CNN = 'mongodb://localhost:27017/test-db';
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
    // OJO: no restauramos console.error aquí porque lo gestiona beforeAll/afterAll
  });

  /**
   * Prepara todos los mocks *antes* de requerir el script.
   * Devuelve referencias útiles a los mocks ya inicializados.
   */
  const prepareAndRequire = async () => {
    // 1) cloudinary (inline factory)
    jest.mock('../../utils/cloudinary', () => ({
      uploader: { upload: jest.fn() },
    }));

    // 2) Track (inline; sin variables externas)
    jest.mock('../../models/Track', () => {
      const trackCtorSave = { save: jest.fn().mockResolvedValue({ _id: 'mock-id' }) };
      const TrackMock = jest.fn(() => trackCtorSave);
      // expón el save para poder asertarlo luego
      TrackMock._save = trackCtorSave;
      return TrackMock;
    });

    // 3) mongoose (solo lo que usa el script)
    jest.mock('mongoose', () => ({
      connect: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
    }));

    // 4) Devuelve refs ya inicializadas tras require
    const cloud = require('../../utils/cloudinary');
    const Track = require('../../models/Track');
    const mongoose = require('mongoose');

    // helper para dejar terminar microtasks del IIFE
    const flush = () => new Promise((r) => setImmediate(r));

    // 5) Ejecuta el script (corre el IIFE)
    const run = () => require('../../scripts/uploadTracksToCloudinary');

    return { cloud, Track, trackSave: Track._save, mongoose, run, flush };
  };

  test('sube el primer track y salta el segundo por faltar un fichero', async () => {
    // Mock del JSON con 2 entradas
    jest.mock('../../tracks.json', () => ([
      {
        title: 'A',
        artist: 'X',
        genre: 'Rock',
        duration: 200,
        audioPath: 'public/audio/a.mp3',
        coverPath: 'public/covers/a.jpg',
        feel: 'happy',
      },
      {
        title: 'B',
        artist: 'Y',
        genre: 'Pop',
        duration: 180,
        audioPath: 'public/audio/b.mp3',
        coverPath: 'public/covers/b.jpg', // faltará
        feel: 'calm',
      },
    ]), { virtual: true });

    // fs.existsSync → true,true (A), true,false (B) => se salta B
    const seq = [true, true, true, false];
    jest.mock('fs', () => ({
      existsSync: jest.fn(() => seq.shift()),
    }));

    const { cloud, Track, trackSave, mongoose, run, flush } = await prepareAndRequire();

    cloud.uploader.upload
      .mockResolvedValueOnce({ secure_url: 'https://cdn/audioA.mp3' }) // audio A
      .mockResolvedValueOnce({ secure_url: 'https://cdn/coverA.jpg' }); // cover A

    run();
    await flush();

    // Conexión y desconexión
    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost:27017/test-db');
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);

    // Solo se sube A (2 uploads)
    expect(cloud.uploader.upload).toHaveBeenCalledTimes(2);
    expect(cloud.uploader.upload.mock.calls[0][1]).toMatchObject({ folder: 'noizzy/audio', resource_type: 'auto' });
    expect(cloud.uploader.upload.mock.calls[1][1]).toMatchObject({
      folder: 'noizzy/covers', resource_type: 'image', eager_async: false,
    });

    // Se crea y guarda Track A
    expect(Track).toHaveBeenCalledTimes(1);
    const arg = Track.mock.calls[0][0];
    expect(arg).toMatchObject({
      title: 'A',
      artist: 'X',
      genre: 'Rock',
      duration: 200,
      audioUrl: 'https://cdn/audioA.mp3',
      coverUrl: 'https://cdn/coverA.jpg',
      feel: 'happy',
    });
    expect(trackSave.save).toHaveBeenCalledTimes(1);

    // B fue saltado
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/Saltando "B"/));
  });

  test('si falla la subida de cover, registra error y no guarda el Track', async () => {
    // Un solo track válido
    jest.mock('../../tracks.json', () => ([
      {
        title: 'C',
        artist: 'Z',
        genre: 'House',
        duration: 123,
        audioPath: 'public/audio/c.mp3',
        coverPath: 'public/covers/c.jpg',
        feel: 'boom',
      },
    ]), { virtual: true });

    // Ambos ficheros existen
    jest.mock('fs', () => ({ existsSync: jest.fn(() => true) }));

    const { cloud, Track, trackSave, mongoose, run, flush } = await prepareAndRequire();

    // audio OK, cover falla
    cloud.uploader.upload
      .mockResolvedValueOnce({ secure_url: 'https://cdn/audioC.mp3' }) // audio
      .mockRejectedValueOnce(new Error('cover boom'));                 // cover falla

    run();
    await flush();

    // No crea Track si falla cover
    expect(Track).not.toHaveBeenCalled();
    expect(trackSave.save).not.toHaveBeenCalled();

    // Log de error y desconexión al final
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/Error en fila 0.*C.*cover boom/i));
    expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
  });
});

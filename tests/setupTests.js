// tests/setupTests.js
// Silencia console.error globalmente y NO rompas si no está spyeado.

let errorSpy; // puede no crearse si algo falla antes

beforeAll(() => {
  try {
    // evita duplicar el spy si ya está hecho
    if (console.error && console.error._silencedByGlobalSetup) return;

    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    console.error._silencedByGlobalSetup = true;
  } catch {
    // no-op
  }
});

afterAll(() => {
  try {
    if (errorSpy && typeof errorSpy.mockRestore === 'function') {
      errorSpy.mockRestore();
    } else if (console.error && typeof console.error.mockRestore === 'function') {
      // por si otro test creó el spy
      console.error.mockRestore();
    }
  } catch {
    // no-op
  } finally {
    if (console.error && console.error._silencedByGlobalSetup) {
      delete console.error._silencedByGlobalSetup;
    }
  }
});

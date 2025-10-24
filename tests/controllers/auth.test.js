describe('Auth Controller', () => {
  // ------------------------------------------------------------------
  // --- 1. MOCKS DE DEPENDENCIAS (AUTOCONTENIDOS) ---
  // ------------------------------------------------------------------

  // JWT Mock: Renombramos a 'mockGenerateJWT' para evitar colisión de ámbito global.
  const mockGenerateJWT = jest.fn().mockResolvedValue('mocked-jwt-token');
  jest.mock('../../helpers/jwt.js', () => ({
    generateJWT: mockGenerateJWT, // Exportamos bajo el nombre correcto 'generateJWT'
  }));
  
  // Google OAuth2Client Mock (Aseguramos la referencia a la instancia)
  // 🔴 Cambiamos la configuración del mock de verifyIdToken para que siempre exista
  const mockVerifyIdToken = jest.fn().mockResolvedValue({
      getPayload: jest.fn().mockReturnValue({
          sub: 'mockGoogleUid456',
          email: 'google@test.com',
          name: 'Google User',
          picture: 'https://pic.url/google.jpg',
      })
  });
  
  jest.mock('google-auth-library', () => {
    // El mockOAuth2Client crea una instancia con verifyIdToken
    const mockOAuth2Client = jest.fn(() => ({
      verifyIdToken: mockVerifyIdToken,
    }));
    return { OAuth2Client: mockOAuth2Client };
  });

  // Mongoose Mocks
  const mockFindOne = jest.fn(); 
  const mockUserSave = jest.fn().mockResolvedValue(true);

  // 🔴 Mockeamos el módulo User como una FUNCIÓN CON PROPIEDADES
  jest.mock('../../models/User.js', () => {
    const mockUserClass = jest.fn((data) => ({
      id: 'mockId', _id: 'mockId', name: data.name || 'Mock User', email: data.email,
      password: data.password,
      save: mockUserSave, 
      toObject: () => ({ id: 'mockId', name: data.name || 'Mock User', email: data.email }),
    }));

    // Añadimos las funciones estáticas directamente a la clase mockeada.
    mockUserClass.findOne = mockFindOne;
    
    // Devolvemos la CLASE mockeada como la exportación principal (CommonJS).
    return mockUserClass; 
  });
  
  // bcryptjs Mock
  jest.mock('bcryptjs', () => ({
    genSaltSync: jest.fn().mockReturnValue('mockSalt'),
    hashSync: jest.fn().mockReturnValue('hashedPassword123'),
    compareSync: jest.fn((password, hash) => password === 'P4sswOrd'),
  }));


  // ------------------------------------------------------------------
  // --- 2. SETUP Y CÓDIGO DE ACCESO A LOS MOCKS ---
  // ------------------------------------------------------------------

  const { generateJWT } = require('../../helpers/jwt.js');
  const { OAuth2Client } = require('google-auth-library');
  
  let res;
  let AuthController;
  let mutableUser; 

  const mockResponse = () => {
    const res = {};
    res.status = jest.fn().mockReturnThis(); 
    res.json = jest.fn().mockReturnThis();
    return res;
  };

  // ❌ ELIMINAMOS getGoogleClientInstance para usar .mock.instances[0] directamente.
  // const getGoogleClientInstance = () => { ... };

  beforeEach(async () => {
    jest.clearAllMocks();
    res = mockResponse();
    
    // Restablecer mocks Mongoose
    mockFindOne.mockClear(); 
    mockFindOne.mockResolvedValue(null);
    mockUserSave.mockClear();
    
    // 🔴 SIMPLIFICACIÓN: El mockVerifyIdToken ya está definido globalmente. 
    // Solo lo limpiamos.
    mockVerifyIdToken.mockClear();

    // Inicializamos el objeto mutable para el test de Google
    mutableUser = {
      id: 'existingId', _id: 'existingId', email: 'google@test.com',
      name: null, photo: null, googleUid: null,
      save: jest.fn().mockResolvedValue(true), 
    };

    // CRÍTICO: Carga el módulo del controlador solo DESPUÉS de los mocks.
    AuthController = require('../../controllers/auth');
  });


  // -------------------------------------------------------------------
  // --- 3. TESTS CORREGIDOS (ACCEDIENDO AL SPY DIRECTAMENTE) ---
  // -------------------------------------------------------------------
  
  describe('Auth Controller - createUser', () => {
    const req = { body: { name: 'New User', email: 'new@example.com', password: 'P4sswOrd' } };
    const mockUserResult = { id: 'mockId', name: 'Test User', email: 'test@example.com', password: 'hashedPassword123' };

    it('should create a new user and return a 201 with token', async () => {
      // Configuramos mockUserSave para asegurar que retorna un resultado
      mockUserSave.mockResolvedValue(mockUserResult); 
      
      await AuthController.createUser(req, res);
      
      // La llamada a generateJWT ahora debería ocurrir si save() tiene éxito
      expect(generateJWT).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    }, 10000); 

    it('should return a 400 if a user already exists', async () => {
      mockFindOne.mockResolvedValue(mockUserResult);
      await AuthController.createUser(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }, 10000);
  });

  describe('Auth Controller - renewToken', () => {
    it('should renew token and return it in the response', async () => {
      const req = { uid: 'mockUidFromMiddleware', name: 'Mock Name' };
      await AuthController.renewToken(req, res);

      expect(generateJWT).toHaveBeenCalledWith(req.uid, req.name);
      expect(res.json).toHaveBeenCalledWith({ ok: true, token: 'mocked-jwt-token' });
    });
  });

  describe('Auth Controller - googleSignIn', () => {
    const req = { body: { idToken: 'valid-google-token' } };

    it('should create a new user from Google payload and return token', async () => {
      await AuthController.googleSignIn(req, res);
      
      // 🔴 CORRECCIÓN: Accedemos al spy verifyIdToken directamente desde el mock
      // de la función global, que está asignado a la instancia.
      expect(mockVerifyIdToken).toHaveBeenCalled(); 
      expect(mockFindOne).toHaveBeenCalledWith({ email: 'google@test.com' });
    });

    it('should update existing user with missing data and return token', async () => {
      mockFindOne.mockResolvedValue(mutableUser);

      await AuthController.googleSignIn(req, res);

      expect(mutableUser.name).toBe('Google User');
      expect(mutableUser.save).toHaveBeenCalled();
    });
  });
  
  describe('Auth Controller - loginUser', () => {
    const req = { body: { email: 'test@example.com', password: 'P4sswOrd' } };
    const mockExistingUser = {
      id: 'mockId', _id: 'mockId', name: 'Test User', email: 'test@example.com',
      password: 'hashedPassword123', // Contraseña hasheada (para bcrypt.compareSync)
      save: jest.fn().mockResolvedValue(true),
      toObject: () => ({ id: 'mockId', name: 'Test User', email: 'test@example.com' }),
    };

    it('should successfully log in and return token', async () => {
      mockFindOne.mockResolvedValue(mockExistingUser);
      await AuthController.loginUser(req, res);
      expect(generateJWT).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
    }, 10000); 

    it('should return 400 if password is invalid', async () => {
      mockFindOne.mockResolvedValue(mockExistingUser);
      const reqInvalid = { body: { ...req.body, password: 'WrongPassword' } };
      await AuthController.loginUser(reqInvalid, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }, 10000);
  });
});

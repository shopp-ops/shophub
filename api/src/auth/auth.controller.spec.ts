import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { register: jest.fn(), login: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  it('register delegates to AuthService and returns the result', async () => {
    authService.register.mockResolvedValue({ id: 'uuid-1', email: 'a@b.com' });

    const result = await controller.register({ email: 'a@b.com', password: 'password123' });

    expect(authService.register).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(result).toEqual({ id: 'uuid-1', email: 'a@b.com' });
  });

  it('login delegates to AuthService and returns the result', async () => {
    authService.login.mockResolvedValue({ accessToken: 'token' });

    const result = await controller.login({ email: 'a@b.com', password: 'password123' });

    expect(authService.login).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
    expect(result).toEqual({ accessToken: 'token' });
  });
});

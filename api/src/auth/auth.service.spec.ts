import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { BCRYPT_ROUNDS, AuthService } from './auth.service';

const makeUser = (overrides: Partial<User> = {}): User =>
  Object.assign(new User(), {
    id: 'uuid-1',
    email: 'a@b.com',
    passwordHash: 'hash',
    createdAt: new Date(),
    ...overrides,
  });

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: jest.fn(), create: jest.fn() },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn().mockReturnValue('signed-token') },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
  });

  describe('register', () => {
    it('returns id and email on success', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(makeUser());

      const result = await service.register({ email: 'a@b.com', password: 'password123' });

      expect(result).toEqual({ id: 'uuid-1', email: 'a@b.com' });
    });

    it('hashes the password before saving', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(makeUser());

      await service.register({ email: 'a@b.com', password: 'password123' });

      const [, savedHash] = usersService.create.mock.calls[0];
      expect(savedHash).not.toBe('password123');
      expect(await bcrypt.compare('password123', savedHash)).toBe(true);
    });

    it('throws ConflictException when email already registered', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(
        service.register({ email: 'a@b.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns accessToken for valid credentials', async () => {
      const passwordHash = await bcrypt.hash('password123', BCRYPT_ROUNDS);
      usersService.findByEmail.mockResolvedValue(makeUser({ passwordHash }));

      const result = await service.login({ email: 'a@b.com', password: 'password123' });

      expect(result).toEqual({ accessToken: 'signed-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: 'uuid-1', email: 'a@b.com' });
    });

    it('throws UnauthorizedException for unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@b.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-pass', BCRYPT_ROUNDS);
      usersService.findByEmail.mockResolvedValue(makeUser({ passwordHash }));

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong-pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});

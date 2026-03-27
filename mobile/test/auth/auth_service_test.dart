// auth_service_test.dart
// TDD RED phase: tests for AuthService PKCE OAuth login flow.
// These tests FAIL initially before auth_service.dart exists.

import 'package:flutter_test/flutter_test.dart';
import 'package:cam_tune_mobile/features/auth/auth_service.dart';

// ─── Manual mock implementations ───────────────────────────────────────────

class MockFlutterAppAuth implements FlutterAppAuthInterface {
  bool loginCalled = false;
  bool refreshCalled = false;
  bool shouldThrowOnLogin = false;
  bool shouldThrowOnRefresh = false;

  String? stubbedAccessToken;
  String? stubbedRefreshToken;
  String? stubbedIdToken;
  DateTime? stubbedExpiry;

  @override
  Future<AppAuthTokenResponse?> authorizeAndExchangeCode({
    required String clientId,
    required String redirectUrl,
    required List<String> scopes,
    required String discoveryUrl,
  }) async {
    loginCalled = true;
    if (shouldThrowOnLogin) {
      throw Exception('OAuth login failed');
    }
    return AppAuthTokenResponse(
      accessToken: stubbedAccessToken ?? 'mock-access-token',
      refreshToken: stubbedRefreshToken ?? 'mock-refresh-token',
      idToken: stubbedIdToken ?? 'mock-id-token',
      accessTokenExpirationDateTime:
          stubbedExpiry ?? DateTime.now().add(const Duration(hours: 1)),
    );
  }

  @override
  Future<AppAuthTokenResponse?> refreshToken({
    required String clientId,
    required String redirectUrl,
    required List<String> scopes,
    required String discoveryUrl,
    required String refreshToken,
  }) async {
    refreshCalled = true;
    if (shouldThrowOnRefresh) {
      throw Exception('Refresh token expired');
    }
    return AppAuthTokenResponse(
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      idToken: 'new-id-token',
      accessTokenExpirationDateTime:
          DateTime.now().add(const Duration(hours: 1)),
    );
  }
}

class MockSecureStorage implements SecureStorageInterface {
  final Map<String, String> _store = {};

  @override
  Future<void> write({required String key, required String? value}) async {
    if (value == null) {
      _store.remove(key);
    } else {
      _store[key] = value;
    }
  }

  @override
  Future<String?> read({required String key}) async {
    return _store[key];
  }

  @override
  Future<void> delete({required String key}) async {
    _store.remove(key);
  }

  @override
  Future<void> deleteAll() async {
    _store.clear();
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

void main() {
  late MockFlutterAppAuth mockAppAuth;
  late MockSecureStorage mockStorage;
  late AuthService authService;

  setUp(() {
    mockAppAuth = MockFlutterAppAuth();
    mockStorage = MockSecureStorage();
    authService = AuthService(
      appAuth: mockAppAuth,
      secureStorage: mockStorage,
      clientId: 'test-client-id',
    );
  });

  group('AuthService.login()', () {
    test('calls flutter_appauth authorizeAndExchangeCode', () async {
      await authService.login();
      expect(mockAppAuth.loginCalled, isTrue);
    });

    test('stores accessToken in secure storage after login', () async {
      mockAppAuth.stubbedAccessToken = 'test-access-token';
      await authService.login();
      final stored = await mockStorage.read(key: 'access_token');
      expect(stored, equals('test-access-token'));
    });

    test('stores refreshToken in secure storage after login', () async {
      mockAppAuth.stubbedRefreshToken = 'test-refresh-token';
      await authService.login();
      final stored = await mockStorage.read(key: 'refresh_token');
      expect(stored, equals('test-refresh-token'));
    });

    test('throws AuthException when appauth throws', () async {
      mockAppAuth.shouldThrowOnLogin = true;
      expect(() => authService.login(), throwsA(isA<AuthException>()));
    });
  });

  group('AuthService.logout()', () {
    test('clears accessToken from secure storage', () async {
      await mockStorage.write(key: 'access_token', value: 'some-token');
      await authService.logout();
      final stored = await mockStorage.read(key: 'access_token');
      expect(stored, isNull);
    });

    test('clears refreshToken from secure storage', () async {
      await mockStorage.write(key: 'refresh_token', value: 'some-token');
      await authService.logout();
      final stored = await mockStorage.read(key: 'refresh_token');
      expect(stored, isNull);
    });

    test('clears all auth tokens', () async {
      await mockStorage.write(key: 'access_token', value: 'access');
      await mockStorage.write(key: 'refresh_token', value: 'refresh');
      await authService.logout();
      expect(await mockStorage.read(key: 'access_token'), isNull);
      expect(await mockStorage.read(key: 'refresh_token'), isNull);
    });
  });

  group('AuthService.getAccessToken()', () {
    test('returns stored access token', () async {
      await mockStorage.write(key: 'access_token', value: 'stored-access-token');
      final token = await authService.getAccessToken();
      expect(token, equals('stored-access-token'));
    });

    test('returns null when no token stored', () async {
      final token = await authService.getAccessToken();
      expect(token, isNull);
    });
  });

  group('AuthService.refreshToken()', () {
    test('calls flutter_appauth refreshToken with stored refresh token',
        () async {
      await mockStorage.write(key: 'refresh_token', value: 'stored-refresh');
      await authService.refreshToken();
      expect(mockAppAuth.refreshCalled, isTrue);
    });

    test('stores new accessToken after successful refresh', () async {
      await mockStorage.write(key: 'refresh_token', value: 'stored-refresh');
      await authService.refreshToken();
      final stored = await mockStorage.read(key: 'access_token');
      expect(stored, equals('new-access-token'));
    });

    test('stores new refreshToken after successful refresh', () async {
      await mockStorage.write(key: 'refresh_token', value: 'stored-refresh');
      await authService.refreshToken();
      final stored = await mockStorage.read(key: 'refresh_token');
      expect(stored, equals('new-refresh-token'));
    });

    test('throws AuthException when no refresh token stored', () async {
      expect(() => authService.refreshToken(), throwsA(isA<AuthException>()));
    });

    test('throws AuthException when refresh token is expired', () async {
      await mockStorage.write(key: 'refresh_token', value: 'stored-refresh');
      mockAppAuth.shouldThrowOnRefresh = true;
      expect(() => authService.refreshToken(), throwsA(isA<AuthException>()));
    });
  });

  group('AuthService.isLoggedIn()', () {
    test('returns false when no access token stored', () async {
      final result = await authService.isLoggedIn();
      expect(result, isFalse);
    });

    test('returns true when access token stored', () async {
      await mockStorage.write(key: 'access_token', value: 'some-token');
      final result = await authService.isLoggedIn();
      expect(result, isTrue);
    });
  });
}

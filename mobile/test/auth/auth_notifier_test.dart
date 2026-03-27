// auth_notifier_test.dart
// TDD RED phase: tests for AuthNotifier Riverpod state management.
// These tests FAIL initially before auth_notifier.dart exists.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cam_tune_mobile/features/auth/auth_notifier.dart';
import 'package:cam_tune_mobile/features/auth/auth_service.dart';

// ─── Manual mock ────────────────────────────────────────────────────────────

class MockAuthService implements AuthServiceInterface {
  bool? _hasToken;
  bool shouldThrowOnLogin = false;
  bool shouldThrowOnRefresh = false;

  String? stubbedAccessToken;

  MockAuthService({bool hasToken = false, String? accessToken}) {
    _hasToken = hasToken;
    stubbedAccessToken = accessToken;
  }

  @override
  Future<void> login() async {
    if (shouldThrowOnLogin) throw const AuthException('Login failed');
    _hasToken = true;
    stubbedAccessToken = 'mock-access-token';
  }

  @override
  Future<void> logout() async {
    _hasToken = false;
    stubbedAccessToken = null;
  }

  @override
  Future<String?> getAccessToken() async {
    return stubbedAccessToken;
  }

  @override
  Future<void> refreshToken() async {
    if (shouldThrowOnRefresh) throw const AuthException('Refresh token expired');
    stubbedAccessToken = 'refreshed-access-token';
  }

  @override
  Future<bool> isLoggedIn() async {
    return _hasToken ?? false;
  }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

void main() {
  group('AuthNotifier initial state', () {
    test('initial state is AuthState.loading()', () {
      final mockService = MockAuthService();
      final notifier = AuthNotifier(authService: mockService);
      expect(notifier.state, equals(const AuthState.loading()));
    });
  });

  group('AuthNotifier.checkAuth()', () {
    test('state becomes unauthenticated when no stored token', () async {
      final mockService = MockAuthService(hasToken: false);
      final notifier = AuthNotifier(authService: mockService);

      await notifier.checkAuth();

      expect(notifier.state, equals(const AuthState.unauthenticated()));
    });

    test('state becomes authenticated with token when stored token exists',
        () async {
      final mockService =
          MockAuthService(hasToken: true, accessToken: 'stored-token');
      final notifier = AuthNotifier(authService: mockService);

      await notifier.checkAuth();

      expect(
          notifier.state, equals(const AuthState.authenticated('stored-token')));
    });
  });

  group('AuthNotifier.login()', () {
    test('state becomes authenticated after successful login', () async {
      final mockService = MockAuthService();
      final notifier = AuthNotifier(authService: mockService);

      await notifier.login();

      expect(notifier.state,
          equals(const AuthState.authenticated('mock-access-token')));
    });

    test('state becomes unauthenticated after failed login', () async {
      final mockService = MockAuthService()..shouldThrowOnLogin = true;
      final notifier = AuthNotifier(authService: mockService);

      await notifier.login();

      expect(notifier.state, equals(const AuthState.unauthenticated()));
    });
  });

  group('AuthNotifier.logout()', () {
    test('state becomes unauthenticated after logout', () async {
      final mockService =
          MockAuthService(hasToken: true, accessToken: 'some-token');
      final notifier = AuthNotifier(authService: mockService);

      await notifier.logout();

      expect(notifier.state, equals(const AuthState.unauthenticated()));
    });
  });

  group('AuthNotifier Riverpod provider', () {
    test('authNotifierProvider can be read from container', () {
      // Provide a mock service via override
      final mockService = MockAuthService();
      final container = ProviderContainer(
        overrides: [
          authServiceProvider.overrideWithValue(mockService),
        ],
      );
      addTearDown(container.dispose);

      final state = container.read(authNotifierProvider);
      expect(state, equals(const AuthState.loading()));
    });
  });
}

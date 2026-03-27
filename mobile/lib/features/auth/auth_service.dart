// auth_service.dart
// AuthService: PKCE OAuth flow using flutter_appauth + flutter_secure_storage.
// Uses interface/mock pattern for testability.

import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ─── Constants ─────────────────────────────────────────────────────────────

const String _kClientId = String.fromEnvironment(
  'GOOGLE_CLIENT_ID',
  defaultValue: '',
);
const String _kRedirectUrl = 'com.camtune.app:/oauth2redirect';
const String _kDiscoveryUrl =
    'https://accounts.google.com/.well-known/openid-configuration';
const List<String> _kScopes = ['openid', 'email', 'profile', 'offline_access'];

const String _kAccessTokenKey = 'access_token';
const String _kRefreshTokenKey = 'refresh_token';
const String _kIdTokenKey = 'id_token';

// ─── Exceptions ─────────────────────────────────────────────────────────────

/// Thrown when any authentication operation fails.
class AuthException implements Exception {
  final String message;
  const AuthException(this.message);

  @override
  String toString() => 'AuthException: $message';
}

// ─── Token response model ───────────────────────────────────────────────────

/// Normalized token response from AppAuth.
class AppAuthTokenResponse {
  final String? accessToken;
  final String? refreshToken;
  final String? idToken;
  final DateTime? accessTokenExpirationDateTime;

  const AppAuthTokenResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.idToken,
    required this.accessTokenExpirationDateTime,
  });
}

// ─── Interfaces ─────────────────────────────────────────────────────────────

/// Abstract interface for flutter_appauth — allows mocking in tests.
abstract class FlutterAppAuthInterface {
  Future<AppAuthTokenResponse?> authorizeAndExchangeCode({
    required String clientId,
    required String redirectUrl,
    required List<String> scopes,
    required String discoveryUrl,
  });

  Future<AppAuthTokenResponse?> refreshToken({
    required String clientId,
    required String redirectUrl,
    required List<String> scopes,
    required String discoveryUrl,
    required String refreshToken,
  });
}

/// Abstract interface for flutter_secure_storage — allows mocking in tests.
abstract class SecureStorageInterface {
  Future<void> write({required String key, required String? value});
  Future<String?> read({required String key});
  Future<void> delete({required String key});
  Future<void> deleteAll();
}

/// Abstract interface for AuthService — allows mocking in tests.
abstract class AuthServiceInterface {
  Future<void> login();
  Future<void> logout();
  Future<String?> getAccessToken();
  Future<void> refreshToken();
  Future<bool> isLoggedIn();
}

// ─── Concrete FlutterAppAuth adapter ────────────────────────────────────────

/// Production adapter wrapping the real [FlutterAppAuth] plugin.
class FlutterAppAuthAdapter implements FlutterAppAuthInterface {
  final FlutterAppAuth _appAuth;

  const FlutterAppAuthAdapter(this._appAuth);

  @override
  Future<AppAuthTokenResponse?> authorizeAndExchangeCode({
    required String clientId,
    required String redirectUrl,
    required List<String> scopes,
    required String discoveryUrl,
  }) async {
    final result = await _appAuth.authorizeAndExchangeCode(
      AuthorizationTokenRequest(
        clientId,
        redirectUrl,
        discoveryUrl: discoveryUrl,
        scopes: scopes,
      ),
    );
    return AppAuthTokenResponse(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      idToken: result.idToken,
      accessTokenExpirationDateTime: result.accessTokenExpirationDateTime,
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
    final result = await _appAuth.token(
      TokenRequest(
        clientId,
        redirectUrl,
        discoveryUrl: discoveryUrl,
        refreshToken: refreshToken,
        scopes: scopes,
      ),
    );
    return AppAuthTokenResponse(
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      idToken: result.idToken,
      accessTokenExpirationDateTime: result.accessTokenExpirationDateTime,
    );
  }
}

// ─── Concrete SecureStorage adapter ─────────────────────────────────────────

/// Production adapter wrapping the real [FlutterSecureStorage] plugin.
class FlutterSecureStorageAdapter implements SecureStorageInterface {
  final FlutterSecureStorage _storage;

  const FlutterSecureStorageAdapter(this._storage);

  @override
  Future<void> write({required String key, required String? value}) =>
      _storage.write(key: key, value: value);

  @override
  Future<String?> read({required String key}) => _storage.read(key: key);

  @override
  Future<void> delete({required String key}) => _storage.delete(key: key);

  @override
  Future<void> deleteAll() => _storage.deleteAll();
}

// ─── AuthService ─────────────────────────────────────────────────────────────

/// Handles PKCE OAuth flow, token storage, and token refresh.
///
/// Dependencies injected via constructor for testability.
/// [clientId] defaults to [_kClientId] (injected at build time via
/// `--dart-define=GOOGLE_CLIENT_ID=<value>`). Pass a non-empty value in tests
/// to satisfy the debug-mode assertion without requiring a build-time define.
class AuthService implements AuthServiceInterface {
  final FlutterAppAuthInterface _appAuth;
  final SecureStorageInterface _secureStorage;
  final String _clientId;

  AuthService({
    required FlutterAppAuthInterface appAuth,
    required SecureStorageInterface secureStorage,
    String clientId = _kClientId,
  })  : _appAuth = appAuth,
        _secureStorage = secureStorage,
        _clientId = clientId;

  /// Initiates PKCE login flow via flutter_appauth.
  /// Stores accessToken and refreshToken to secure storage on success.
  @override
  Future<void> login() async {
    assert(_clientId.isNotEmpty,
        'GOOGLE_CLIENT_ID must be set via --dart-define=GOOGLE_CLIENT_ID=<value>');
    try {
      final response = await _appAuth.authorizeAndExchangeCode(
        clientId: _clientId,
        redirectUrl: _kRedirectUrl,
        scopes: _kScopes,
        discoveryUrl: _kDiscoveryUrl,
      );
      if (response == null) {
        throw const AuthException('Login was cancelled or returned no tokens');
      }
      await _storeTokens(response);
    } on AuthException {
      rethrow;
    } catch (e) {
      throw AuthException('Login failed: $e');
    }
  }

  /// Clears all auth tokens from secure storage.
  @override
  Future<void> logout() async {
    await _secureStorage.deleteAll();
  }

  /// Returns the stored access token, or null if not logged in.
  @override
  Future<String?> getAccessToken() async {
    return _secureStorage.read(key: _kAccessTokenKey);
  }

  /// Refreshes the access token using the stored refresh token.
  /// Updates secure storage with new tokens on success.
  /// Throws [AuthException] if no refresh token stored or if refresh fails.
  @override
  Future<void> refreshToken() async {
    final storedRefreshToken =
        await _secureStorage.read(key: _kRefreshTokenKey);
    if (storedRefreshToken == null) {
      throw const AuthException('No refresh token stored');
    }

    try {
      final response = await _appAuth.refreshToken(
        clientId: _clientId,
        redirectUrl: _kRedirectUrl,
        scopes: _kScopes,
        discoveryUrl: _kDiscoveryUrl,
        refreshToken: storedRefreshToken,
      );
      if (response == null) {
        throw const AuthException('Refresh returned no tokens');
      }
      await _storeTokens(response);
    } on AuthException {
      rethrow;
    } catch (e) {
      throw AuthException('Token refresh failed: $e');
    }
  }

  /// Returns true if an access token is present in secure storage.
  @override
  Future<bool> isLoggedIn() async {
    final token = await _secureStorage.read(key: _kAccessTokenKey);
    return token != null;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  Future<void> _storeTokens(AppAuthTokenResponse response) async {
    await _secureStorage.write(
        key: _kAccessTokenKey, value: response.accessToken);
    await _secureStorage.write(
        key: _kRefreshTokenKey, value: response.refreshToken);
    if (response.idToken != null) {
      await _secureStorage.write(key: _kIdTokenKey, value: response.idToken);
    }
  }
}

// ─── Riverpod providers ──────────────────────────────────────────────────────

/// Provider for the [AuthServiceInterface].
/// Can be overridden in tests with a mock.
final authServiceProvider = Provider<AuthServiceInterface>((ref) {
  return AuthService(
    appAuth: const FlutterAppAuthAdapter(FlutterAppAuth()),
    secureStorage: const FlutterSecureStorageAdapter(FlutterSecureStorage()),
  );
});

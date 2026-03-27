// auth_notifier.dart
// AuthNotifier: Riverpod StateNotifier managing authentication state.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_service.dart';

// ─── AuthState sealed class ──────────────────────────────────────────────────

/// Sealed class representing authentication states.
sealed class AuthState {
  const AuthState();

  const factory AuthState.loading() = _AuthLoading;
  const factory AuthState.authenticated(String accessToken) = _AuthAuthenticated;
  const factory AuthState.unauthenticated({String? errorMessage}) =
      _AuthUnauthenticated;

  /// Returns true if the state is authenticated.
  bool get isAuthenticated => this is _AuthAuthenticated;

  /// Returns the access token if authenticated, otherwise null.
  String? get accessToken {
    final self = this;
    if (self is _AuthAuthenticated) return self.accessToken;
    return null;
  }

  /// Returns the error message if unauthenticated with an error, otherwise null.
  String? get errorMessage {
    final self = this;
    if (self is _AuthUnauthenticated) return self.errorMessage;
    return null;
  }
}

/// Loading state: app is checking stored tokens.
final class _AuthLoading extends AuthState {
  const _AuthLoading();

  @override
  bool operator ==(Object other) => other is _AuthLoading;

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  String toString() => 'AuthState.loading()';
}

/// Authenticated state: user has a valid access token.
final class _AuthAuthenticated extends AuthState {
  @override
  final String accessToken;

  const _AuthAuthenticated(this.accessToken);

  @override
  bool operator ==(Object other) =>
      other is _AuthAuthenticated && other.accessToken == accessToken;

  @override
  int get hashCode => Object.hash(runtimeType, accessToken);

  @override
  String toString() => 'AuthState.authenticated([REDACTED])';
}

/// Unauthenticated state: user has no valid token.
/// [errorMessage] is optionally set when unauthenticated due to a login failure.
final class _AuthUnauthenticated extends AuthState {
  @override
  final String? errorMessage;

  const _AuthUnauthenticated({this.errorMessage});

  @override
  bool operator ==(Object other) =>
      other is _AuthUnauthenticated && other.errorMessage == errorMessage;

  @override
  int get hashCode => Object.hash(runtimeType, errorMessage);

  @override
  String toString() => 'AuthState.unauthenticated(errorMessage: $errorMessage)';
}

// ─── AuthNotifier ────────────────────────────────────────────────────────────

/// Manages authentication state using [AuthServiceInterface].
///
/// Initial state is [AuthState.loading()].
/// Call [checkAuth] to initialize state from stored tokens.
class AuthNotifier extends StateNotifier<AuthState> {
  final AuthServiceInterface _authService;

  AuthNotifier({required AuthServiceInterface authService})
      : _authService = authService,
        super(const AuthState.loading());

  /// Checks for stored access token and sets state accordingly.
  /// Called on app startup.
  Future<void> checkAuth() async {
    try {
      final loggedIn = await _authService.isLoggedIn();
      if (loggedIn) {
        final token = await _authService.getAccessToken();
        if (token != null) {
          state = AuthState.authenticated(token);
        } else {
          state = const AuthState.unauthenticated();
        }
      } else {
        state = const AuthState.unauthenticated();
      }
    } catch (_) {
      state = const AuthState.unauthenticated();
    }
  }

  /// Initiates PKCE login flow.
  /// On success: state becomes [AuthState.authenticated].
  /// On failure: state becomes [AuthState.unauthenticated] with [errorMessage].
  Future<void> login() async {
    state = const AuthState.loading();
    try {
      await _authService.login();
      final token = await _authService.getAccessToken();
      if (token != null) {
        state = AuthState.authenticated(token);
      } else {
        state = const AuthState.unauthenticated(
            errorMessage: 'Login succeeded but no access token was returned');
      }
    } catch (e) {
      state = AuthState.unauthenticated(errorMessage: e.toString());
    }
  }

  /// Clears tokens and sets state to [AuthState.unauthenticated].
  Future<void> logout() async {
    await _authService.logout();
    state = const AuthState.unauthenticated();
  }
}

// ─── Riverpod providers ──────────────────────────────────────────────────────

/// Provider for [AuthNotifier].
final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  final authService = ref.watch(authServiceProvider);
  return AuthNotifier(authService: authService);
});

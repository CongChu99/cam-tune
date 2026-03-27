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
  const factory AuthState.unauthenticated() = _AuthUnauthenticated;

  /// Returns true if the state is authenticated.
  bool get isAuthenticated => this is _AuthAuthenticated;

  /// Returns the access token if authenticated, otherwise null.
  String? get accessToken {
    final self = this;
    if (self is _AuthAuthenticated) return self.accessToken;
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
  String toString() => 'AuthState.authenticated($accessToken)';
}

/// Unauthenticated state: user has no valid token.
final class _AuthUnauthenticated extends AuthState {
  const _AuthUnauthenticated();

  @override
  bool operator ==(Object other) => other is _AuthUnauthenticated;

  @override
  int get hashCode => runtimeType.hashCode;

  @override
  String toString() => 'AuthState.unauthenticated()';
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
        state = AuthState.authenticated(token ?? '');
      } else {
        state = const AuthState.unauthenticated();
      }
    } catch (_) {
      state = const AuthState.unauthenticated();
    }
  }

  /// Initiates PKCE login flow.
  /// On success: state becomes [AuthState.authenticated].
  /// On failure: state becomes [AuthState.unauthenticated].
  Future<void> login() async {
    state = const AuthState.loading();
    try {
      await _authService.login();
      final token = await _authService.getAccessToken();
      state = AuthState.authenticated(token ?? '');
    } catch (_) {
      state = const AuthState.unauthenticated();
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

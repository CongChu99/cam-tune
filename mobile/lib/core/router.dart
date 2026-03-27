import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/auth_notifier.dart';
import '../features/home/home_screen.dart';
import '../features/cameras/cameras_screen.dart';
import '../features/recommendation/recommendation_screen.dart';

// ─── AuthRouterNotifier ──────────────────────────────────────────────────────

/// A [ChangeNotifier] that bridges Riverpod auth state changes to GoRouter's
/// [refreshListenable], so redirect logic re-evaluates on every auth change.
class AuthRouterNotifier extends ChangeNotifier {
  AuthRouterNotifier(this._ref) {
    _ref.listen<AuthState>(authNotifierProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}

// ─── routerProvider ──────────────────────────────────────────────────────────

/// Riverpod provider that creates and owns the [GoRouter] instance.
///
/// Using a provider ensures:
/// 1. The router is reactive — auth state changes trigger redirect re-evaluation
///    via [AuthRouterNotifier] + [GoRouter.refreshListenable].
/// 2. There is a single source of truth for the router (no dead global).
///
/// Routes:
/// - /login         → [LoginScreen]
/// - /home          → [HomeScreen]
/// - /cameras       → [CamerasScreen]
/// - /recommendation → [RecommendationScreen]
final routerProvider = Provider<GoRouter>((ref) {
  final notifier = AuthRouterNotifier(ref);

  return GoRouter(
    initialLocation: '/login',
    refreshListenable: notifier,
    redirect: (context, state) {
      final authState = ref.read(authNotifierProvider);
      final isLoading = authState == const AuthState.loading();
      final isAuthenticated = authState.isAuthenticated;
      final isOnLogin = state.matchedLocation == '/login';

      // While loading, do not redirect.
      if (isLoading) return null;

      // If unauthenticated and not on login page, redirect to login.
      if (!isAuthenticated && !isOnLogin) return '/login';

      // If authenticated and on login page, redirect to home.
      if (isAuthenticated && isOnLogin) return '/home';

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/cameras',
        builder: (context, state) => const CamerasScreen(),
      ),
      GoRoute(
        path: '/recommendation',
        builder: (context, state) => const RecommendationScreen(),
      ),
    ],
  );
});

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/login_screen.dart';
import '../features/auth/auth_notifier.dart';
import '../features/home/home_screen.dart';
import '../features/cameras/cameras_screen.dart';
import '../features/recommendation/recommendation_screen.dart';

/// Top-level [GoRouter] instance for CamTune Mobile.
///
/// Routes:
/// - /login         → [LoginScreen]
/// - /home          → [HomeScreen]
/// - /cameras       → [CamerasScreen]
/// - /recommendation → [RecommendationScreen]
///
/// Redirect logic: unauthenticated users are redirected to /login.
/// Uses [authNotifierProvider] to check authentication state.
GoRouter createAppRouter(ProviderContainer container) {
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final authState = container.read(authNotifierProvider);
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
}

/// Default app router using the global Riverpod container.
/// For use in [CamTuneApp]; can be replaced in tests.
final GoRouter appRouter = GoRouter(
  initialLocation: '/login',
  redirect: (context, state) {
    // Auth redirect is handled by listening to authNotifierProvider
    // in individual screens (e.g., LoginScreen navigates on auth change).
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

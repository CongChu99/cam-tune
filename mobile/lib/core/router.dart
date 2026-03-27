import 'package:go_router/go_router.dart';

import '../features/login/login_screen.dart';
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
final GoRouter appRouter = GoRouter(
  initialLocation: '/login',
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

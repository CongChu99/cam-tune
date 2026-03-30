import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/models/camera_profile_cache.dart';
import 'core/models/recommendation_cache.dart';
import 'core/router.dart';
import 'features/auth/auth_notifier.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive for offline storage
  await Hive.initFlutter();

  // Register typed adapters before any box is opened.
  if (!Hive.isAdapterRegistered(1)) Hive.registerAdapter(RecommendationCacheAdapter());
  if (!Hive.isAdapterRegistered(2)) Hive.registerAdapter(CameraProfileCacheAdapter());

  runApp(
    const ProviderScope(
      child: AppStartup(),
    ),
  );
}

/// Startup widget that triggers [checkAuth] before rendering the app.
///
/// Uses [_startupProvider] (a [FutureProvider]) to call
/// [AuthNotifier.checkAuth] on first build, ensuring returning users with
/// stored tokens are resolved out of [AuthState.loading()] before the router
/// redirect logic runs.
class AppStartup extends ConsumerWidget {
  const AppStartup({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Trigger checkAuth on first build; result is ignored — state is managed
    // by AuthNotifier internally.
    ref.watch(_startupProvider);
    return const CamTuneApp();
  }
}

/// FutureProvider that calls [AuthNotifier.checkAuth] once on app startup.
/// Also validates GOOGLE_CLIENT_ID is configured; logs a warning if not.
final _startupProvider = FutureProvider<void>((ref) async {
  // Fast-fail detection if client ID is not configured.
  const clientId = String.fromEnvironment('GOOGLE_CLIENT_ID', defaultValue: '');
  if (clientId.isEmpty) {
    // In debug mode this will also be caught by the assert in AuthService.login().
    // Log a warning but don't crash the app — show unauthenticated state.
    debugPrint('WARNING: GOOGLE_CLIENT_ID is not set. OAuth login will fail.');
  }
  await ref.read(authNotifierProvider.notifier).checkAuth();
});

/// Root application widget for CamTune Mobile.
///
/// Wrapped externally by [ProviderScope] via [AppStartup] in [main] so that
/// Riverpod providers are available throughout the widget tree.
///
/// Uses [ConsumerWidget] to read [routerProvider] — the reactive GoRouter
/// instance that includes auth-guard redirect logic.
class CamTuneApp extends ConsumerWidget {
  const CamTuneApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'CamTune',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueGrey),
        useMaterial3: true,
      ),
      routerConfig: router,
    );
  }
}

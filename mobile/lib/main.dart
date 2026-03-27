import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/router.dart';
import 'features/auth/auth_notifier.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive for offline storage
  await Hive.initFlutter();

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
final _startupProvider = FutureProvider<void>((ref) async {
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

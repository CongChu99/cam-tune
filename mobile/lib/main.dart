import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'core/router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Hive for offline storage
  await Hive.initFlutter();

  runApp(
    const ProviderScope(
      child: CamTuneApp(),
    ),
  );
}

/// Root application widget for CamTune Mobile.
///
/// Wrapped externally by [ProviderScope] in [main] so that Riverpod
/// providers are available throughout the widget tree.
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

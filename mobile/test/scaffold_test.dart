// scaffold_test.dart
// TDD RED phase: tests that verify the scaffold structure
// These tests FAIL initially before router.dart and proper main.dart exist.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:cam_tune_mobile/main.dart';
import 'package:cam_tune_mobile/core/router.dart';
import 'package:cam_tune_mobile/features/auth/auth_service.dart';

// ─── Minimal mock for ProviderContainer tests ────────────────────────────────

class _FakeAuthService implements AuthServiceInterface {
  @override
  Future<void> login() async {}
  @override
  Future<void> logout() async {}
  @override
  Future<String?> getAccessToken() async => null;
  @override
  Future<void> refreshToken() async {}
  @override
  Future<bool> isLoggedIn() async => false;
}

void main() {
  group('Scaffold: router.dart', () {
    late ProviderContainer container;
    late GoRouter router;

    setUp(() {
      container = ProviderContainer(
        overrides: [
          authServiceProvider.overrideWithValue(_FakeAuthService()),
        ],
      );
      router = container.read(routerProvider);
    });

    tearDown(() {
      container.dispose();
    });

    test('routerProvider returns a GoRouter instance', () {
      expect(router, isA<GoRouter>());
    });

    test('router has /login route', () {
      final routes = router.configuration.routes;
      final paths = _collectPaths(routes);
      expect(paths, contains('/login'));
    });

    test('router has /home route', () {
      final routes = router.configuration.routes;
      final paths = _collectPaths(routes);
      expect(paths, contains('/home'));
    });

    test('router has /cameras route', () {
      final routes = router.configuration.routes;
      final paths = _collectPaths(routes);
      expect(paths, contains('/cameras'));
    });

    test('router has /recommendation route', () {
      final routes = router.configuration.routes;
      final paths = _collectPaths(routes);
      expect(paths, contains('/recommendation'));
    });
  });

  group('Scaffold: main.dart', () {
    testWidgets('CamTuneApp widget exists and wraps with ProviderScope',
        (WidgetTester tester) async {
      // Pump with ProviderScope as required by Riverpod
      await tester.pumpWidget(
        const ProviderScope(
          child: CamTuneApp(),
        ),
      );
      // The app should render without errors (GoRouter materialApp found)
      expect(find.byType(CamTuneApp), findsOneWidget);
    });

    testWidgets('ProviderScope is present in the widget tree',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: CamTuneApp(),
        ),
      );
      expect(find.byType(ProviderScope), findsOneWidget);
    });
  });
}

/// Recursively collect all route paths from a list of RouteBase.
List<String> _collectPaths(List<RouteBase> routes) {
  final paths = <String>[];
  for (final route in routes) {
    if (route is GoRoute) {
      paths.add(route.path);
      paths.addAll(_collectPaths(route.routes));
    } else if (route is ShellRoute) {
      paths.addAll(_collectPaths(route.routes));
    }
  }
  return paths;
}

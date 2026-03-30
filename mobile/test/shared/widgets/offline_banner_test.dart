// offline_banner_test.dart
// TDD RED phase: tests for OfflineBanner widget.
// These tests FAIL until offline_banner.dart is implemented.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cam_tune_mobile/core/connectivity_notifier.dart';
import 'package:cam_tune_mobile/shared/widgets/offline_banner.dart';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/// Wraps [child] in a minimal Material app with ProviderScope and the given
/// [overrides] so widgets can read Riverpod providers.
Widget _wrapWithProviders(
  Widget child, {
  List<Override> overrides = const [],
}) {
  return ProviderScope(
    overrides: overrides,
    child: MaterialApp(
      home: Scaffold(
        body: child,
      ),
    ),
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('OfflineBanner: hidden when always online', () {
    testWidgets('banner is not visible when device is online',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider.overrideWithValue(
              Stream<bool>.fromIterable([true]),
            ),
          ],
        ),
      );

      // Process initial emission.
      await tester.pump();

      // Neither offline nor reconnecting text should be visible.
      expect(
        find.text('Offline — hiển thị kết quả đã lưu'),
        findsNothing,
      );
      expect(find.text('Đã kết nối lại...'), findsNothing);
    });

    testWidgets('banner container has zero height when online',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider.overrideWithValue(
              Stream<bool>.fromIterable([true]),
            ),
          ],
        ),
      );

      await tester.pump();

      // OfflineBanner itself exists but renders with collapsed / invisible height.
      expect(find.byType(OfflineBanner), findsOneWidget);
      // No colored banner container visible.
      expect(find.byKey(const Key('offline_banner_container')), findsNothing);
    });
  });

  group('OfflineBanner: offline state', () {
    testWidgets(
        'shows yellow banner with Vietnamese offline text when offline',
        (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      streamController.add(false);
      await tester.pump();

      // Offline text is shown.
      expect(
        find.text('Offline — hiển thị kết quả đã lưu'),
        findsOneWidget,
      );

      // Banner container uses yellow/amber color.
      final container = tester.widget<Container>(
        find.byKey(const Key('offline_banner_container')),
      );
      final decoration = container.decoration as BoxDecoration?;
      expect(decoration?.color, isNotNull);
      // Expect a yellow-ish color (Colors.amber or Colors.yellow family).
      final color = decoration!.color!;
      // Yellow hue: high red + high green + low blue.
      expect(color.red, greaterThan(180));
      expect(color.green, greaterThan(140));
      expect(color.blue, lessThan(80));

      await streamController.close();
    });

    testWidgets('offline banner is visible (non-zero size)', (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      streamController.add(false);
      await tester.pump();

      final renderBox = tester.renderObject<RenderBox>(
        find.byKey(const Key('offline_banner_container')),
      );
      expect(renderBox.size.height, greaterThan(0));

      await streamController.close();
    });
  });

  group('OfflineBanner: reconnect state', () {
    testWidgets(
        'shows green banner with Vietnamese reconnect text on transition to online',
        (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      // Go offline first.
      streamController.add(false);
      await tester.pump();

      // Then reconnect.
      streamController.add(true);
      await tester.pump();

      // Reconnect text is shown.
      expect(find.text('Đã kết nối lại...'), findsOneWidget);
      // Offline text is gone.
      expect(
        find.text('Offline — hiển thị kết quả đã lưu'),
        findsNothing,
      );

      await streamController.close();
    });

    testWidgets('reconnect banner uses green color', (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      streamController.add(false);
      await tester.pump();
      streamController.add(true);
      await tester.pump();

      final container = tester.widget<Container>(
        find.byKey(const Key('offline_banner_container')),
      );
      final decoration = container.decoration as BoxDecoration?;
      expect(decoration?.color, isNotNull);
      // Expect a green-ish color.
      final color = decoration!.color!;
      expect(color.green, greaterThan(color.red));
      expect(color.green, greaterThan(color.blue));

      await streamController.close();
    });
  });

  group('OfflineBanner: auto-hide after reconnect', () {
    testWidgets('banner hides after 2 seconds when back online',
        (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      // Go offline, then reconnect.
      streamController.add(false);
      await tester.pump();
      streamController.add(true);
      await tester.pump();

      // Reconnect message should still be visible immediately.
      expect(find.text('Đã kết nối lại...'), findsOneWidget);

      // Advance time by just under 2 seconds — banner still visible.
      await tester.pump(const Duration(milliseconds: 1900));
      expect(find.text('Đã kết nối lại...'), findsOneWidget);

      // Advance past the 2-second threshold.
      await tester.pump(const Duration(milliseconds: 200));

      // Banner should now be hidden.
      expect(find.text('Đã kết nối lại...'), findsNothing);
      expect(
        find.text('Offline — hiển thị kết quả đã lưu'),
        findsNothing,
      );

      await streamController.close();
    });

    testWidgets('banner does NOT hide if device goes offline again within 2s',
        (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      // Offline → online → offline within 2 s window.
      streamController.add(false);
      await tester.pump();
      streamController.add(true);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      streamController.add(false);
      await tester.pump();

      // Should now show offline banner again (not hidden).
      expect(
        find.text('Offline — hiển thị kết quả đã lưu'),
        findsOneWidget,
      );

      await streamController.close();
    });
  });

  group('OfflineBanner: animation', () {
    testWidgets('banner transition completes within 500ms',
        (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      streamController.add(false);
      // Pump the animation frame-by-frame, stopping at exactly 500ms.
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));

      // Animation should be complete — banner is fully visible.
      expect(
        find.text('Offline — hiển thị kết quả đã lưu'),
        findsOneWidget,
      );

      await streamController.close();
    });

    testWidgets('AnimatedContainer or SizeTransition is used for slide/size animation',
        (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        _wrapWithProviders(
          const OfflineBanner(),
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
        ),
      );

      streamController.add(false);
      await tester.pump();

      // The widget tree should contain an animation widget.
      final hasAnimated = tester.any(find.byType(AnimatedContainer)) ||
          tester.any(find.byType(SizeTransition)) ||
          tester.any(find.byType(AnimatedSize));
      expect(hasAnimated, isTrue);

      await streamController.close();
    });
  });

  group('OfflineBanner: placement / global shell usage', () {
    testWidgets(
        'OfflineBanner can be placed above Scaffold body in a Column',
        (WidgetTester tester) async {
      final streamController = StreamController<bool>.broadcast();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            connectivityStreamProvider
                .overrideWithValue(streamController.stream),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: Column(
                children: const [
                  OfflineBanner(),
                  Expanded(child: Center(child: Text('Content'))),
                ],
              ),
            ),
          ),
        ),
      );

      streamController.add(false);
      await tester.pump();

      // Both banner and content coexist.
      expect(
        find.text('Offline — hiển thị kết quả đã lưu'),
        findsOneWidget,
      );
      expect(find.text('Content'), findsOneWidget);

      // Banner appears above content in the render tree.
      final bannerY = tester
          .getTopLeft(find.byKey(const Key('offline_banner_container')))
          .dy;
      final contentY = tester.getTopLeft(find.text('Content')).dy;
      expect(bannerY, lessThan(contentY));

      await streamController.close();
    });
  });
}

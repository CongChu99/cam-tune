// connectivity_notifier_test.dart
// TDD RED phase: tests for ConnectivityNotifier Riverpod StreamNotifier.
// These tests FAIL until connectivity_notifier.dart is implemented.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cam_tune_mobile/core/connectivity_notifier.dart';

// ─── Fake connectivity stream ─────────────────────────────────────────────────

/// Controls what connectivity events are emitted during tests.
class FakeConnectivityStream {
  final StreamController<bool> _controller =
      StreamController<bool>.broadcast();

  Stream<bool> get stream => _controller.stream;

  void emit(bool isOnline) => _controller.add(isOnline);

  void close() => _controller.close();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

void main() {
  group('ConnectivityNotifier: type contract', () {
    test('connectivityNotifierProvider is a StreamNotifier<bool> provider', () {
      // The provider must exist and expose bool state (true = online, false = offline).
      // We just verify the provider type is accessible; the container read confirms
      // it compiles to the expected AsyncValue<bool> shape.
      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(
            Stream<bool>.fromIterable([true]),
          ),
        ],
      );
      addTearDown(container.dispose);

      // Reading the provider should return AsyncValue<bool>.
      final value = container.read(connectivityNotifierProvider);
      expect(value, isA<AsyncValue<bool>>());
    });
  });

  group('ConnectivityNotifier: initial state', () {
    test('initial state is AsyncLoading before stream emits', () {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      final value = container.read(connectivityNotifierProvider);
      // Before any event is emitted, state is loading.
      expect(value, isA<AsyncLoading<bool>>());
    });

    test('initial state is online (true) when stream emits connected first',
        () async {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      fakeStream.emit(true);
      // Allow microtasks to process.
      await Future<void>.delayed(Duration.zero);

      final value = container.read(connectivityNotifierProvider);
      expect(value, equals(const AsyncData<bool>(true)));
    });

    test('initial state is offline (false) when stream emits disconnected first',
        () async {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      fakeStream.emit(false);
      await Future<void>.delayed(Duration.zero);

      final value = container.read(connectivityNotifierProvider);
      expect(value, equals(const AsyncData<bool>(false)));
    });
  });

  group('ConnectivityNotifier: state transitions', () {
    test('transitions from online to offline when connectivity is lost',
        () async {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      // Start online.
      fakeStream.emit(true);
      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(connectivityNotifierProvider),
        equals(const AsyncData<bool>(true)),
      );

      // Go offline.
      fakeStream.emit(false);
      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(connectivityNotifierProvider),
        equals(const AsyncData<bool>(false)),
      );
    });

    test('transitions from offline to online when connectivity is restored',
        () async {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      // Start offline.
      fakeStream.emit(false);
      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(connectivityNotifierProvider),
        equals(const AsyncData<bool>(false)),
      );

      // Reconnect.
      fakeStream.emit(true);
      await Future<void>.delayed(Duration.zero);
      expect(
        container.read(connectivityNotifierProvider),
        equals(const AsyncData<bool>(true)),
      );
    });

    test('multiple rapid transitions converge on the last emitted value',
        () async {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      fakeStream.emit(true);
      fakeStream.emit(false);
      fakeStream.emit(true);
      fakeStream.emit(false);
      await Future<void>.delayed(Duration.zero);

      expect(
        container.read(connectivityNotifierProvider),
        equals(const AsyncData<bool>(false)),
      );
    });
  });

  group('ConnectivityNotifier: isOnline convenience getter', () {
    test('isOnline returns true when state is AsyncData(true)', () async {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      fakeStream.emit(true);
      await Future<void>.delayed(Duration.zero);

      final isOnline = container.read(isOnlineProvider);
      expect(isOnline, isTrue);
    });

    test('isOnline returns false when state is AsyncData(false)', () async {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      fakeStream.emit(false);
      await Future<void>.delayed(Duration.zero);

      final isOnline = container.read(isOnlineProvider);
      expect(isOnline, isFalse);
    });

    test('isOnline defaults to true when state is still loading', () {
      final fakeStream = FakeConnectivityStream();

      final container = ProviderContainer(
        overrides: [
          connectivityStreamProvider.overrideWithValue(fakeStream.stream),
        ],
      );
      addTearDown(() {
        container.dispose();
        fakeStream.close();
      });

      // No event emitted yet — still loading. Defaults to online (true) to
      // avoid false-offline flash on startup.
      final isOnline = container.read(isOnlineProvider);
      expect(isOnline, isTrue);
    });
  });
}

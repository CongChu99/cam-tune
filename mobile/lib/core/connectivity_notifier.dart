// connectivity_notifier.dart
// Riverpod providers for monitoring network connectivity.

import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ─── Raw stream provider ───────────────────────────────────────────────────────

/// Provides the raw `Stream<bool>` that emits `true` when online, `false` when
/// offline. Exposed as a standalone provider so tests can override it with a
/// fake [StreamController].
final connectivityStreamProvider = Provider<Stream<bool>>((ref) {
  final controller = StreamController<bool>.broadcast();

  final subscription = Connectivity().onConnectivityChanged.listen(
    (List<ConnectivityResult> results) {
      controller.add(
        results.isNotEmpty &&
            !results.every((r) => r == ConnectivityResult.none),
      );
    },
    onError: controller.addError,
    onDone: controller.close,
  );

  ref.onDispose(() {
    subscription.cancel();
    controller.close();
  });

  return controller.stream;
});

// ─── StreamNotifier ───────────────────────────────────────────────────────────

/// [ConnectivityNotifier] consumes [connectivityStreamProvider] and exposes
/// the current online/offline state as `AsyncValue<bool>`.
class ConnectivityNotifier extends StreamNotifier<bool> {
  @override
  Stream<bool> build() {
    return ref.watch(connectivityStreamProvider);
  }
}

/// Provider for [ConnectivityNotifier].
final connectivityNotifierProvider =
    StreamNotifierProvider<ConnectivityNotifier, bool>(
  ConnectivityNotifier.new,
);

// ─── Convenience derived provider ─────────────────────────────────────────────

/// `true` when the device is online, `true` while still loading (to avoid a
/// false-offline flash on startup), `false` only when confirmed offline.
final isOnlineProvider = Provider<bool>((ref) {
  final asyncValue = ref.watch(connectivityNotifierProvider);
  return asyncValue.when(
    data: (isOnline) => isOnline,
    loading: () => true, // default to online while loading
    error: (_, __) => true, // assume online on error to avoid false flash
  );
});

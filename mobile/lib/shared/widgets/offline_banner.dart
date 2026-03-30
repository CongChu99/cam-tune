// offline_banner.dart
// Widget that shows an amber offline banner or a green reconnecting banner,
// then auto-hides 2 seconds after reconnection.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:cam_tune_mobile/core/connectivity_notifier.dart';

/// Displays a slim animated banner below the app bar:
/// - Hidden when online and no recent reconnection.
/// - Amber with Vietnamese offline text when offline.
/// - Green with Vietnamese reconnecting text for 2 s after coming back online.
class OfflineBanner extends ConsumerStatefulWidget {
  const OfflineBanner({super.key});

  @override
  ConsumerState<OfflineBanner> createState() => _OfflineBannerState();
}

enum _BannerMode { hidden, offline, reconnecting }

class _OfflineBannerState extends ConsumerState<OfflineBanner> {
  _BannerMode _mode = _BannerMode.hidden;
  Timer? _hideTimer;

  @override
  void dispose() {
    _hideTimer?.cancel();
    super.dispose();
  }

  void _onConnectivityChanged(bool isOnline) {
    if (!mounted) return;
    _hideTimer?.cancel();

    if (isOnline) {
      // Only show reconnecting banner if we were previously offline.
      if (_mode == _BannerMode.offline) {
        setState(() => _mode = _BannerMode.reconnecting);
        _hideTimer = Timer(const Duration(seconds: 2), () {
          if (mounted) {
            setState(() => _mode = _BannerMode.hidden);
          }
        });
      }
    } else {
      setState(() => _mode = _BannerMode.offline);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Listen to connectivity changes and react.
    ref.listen<AsyncValue<bool>>(connectivityNotifierProvider,
        (previous, next) {
      next.whenData(_onConnectivityChanged);
    });

    final bool visible = _mode != _BannerMode.hidden;

    return AnimatedSize(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      child: visible
          ? Container(
              key: const Key('offline_banner_container'),
              width: double.infinity,
              color: _mode == _BannerMode.offline
                  ? Colors.amber
                  : Colors.green,
              padding:
                  const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
              child: Text(
                _mode == _BannerMode.offline
                    ? 'Offline — hiển thị kết quả đã lưu'
                    : 'Đã kết nối lại...',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                ),
              ),
            )
          : const SizedBox.shrink(),
    );
  }
}

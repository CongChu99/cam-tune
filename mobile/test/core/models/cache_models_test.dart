// cache_models_test.dart
// Tests for RecommendationCache and CameraProfile model fields and cache key helpers
//
// Phase: RED — tests reference classes that do not yet exist.
//
// Note: Hive adapter registration is NOT exercised here; these are plain Dart
// instantiation tests to verify field shape and cache key construction.

import 'package:flutter_test/flutter_test.dart';
import 'package:cam_tune_mobile/core/models/recommendation_cache.dart';
import 'package:cam_tune_mobile/core/models/camera_profile_cache.dart';

void main() {
  // ── RecommendationCache model ────────────────────────────────────────────────

  group('RecommendationCache', () {
    test('has required fields: id, cameraProfileId, data (Map), cachedAt (DateTime)', () {
      final now = DateTime.now();
      final instance = RecommendationCache(
        id: 'rec-001',
        cameraProfileId: 'cam-profile-42',
        data: {'iso': 400, 'shutter': '1/250'},
        cachedAt: now,
      );

      expect(instance.id, equals('rec-001'));
      expect(instance.cameraProfileId, equals('cam-profile-42'));
      expect(instance.data, isA<Map>());
      expect(instance.data['iso'], equals(400));
      expect(instance.cachedAt, equals(now));
    });

    test('data field accepts an empty map', () {
      final instance = RecommendationCache(
        id: 'rec-002',
        cameraProfileId: 'cam-profile-99',
        data: {},
        cachedAt: DateTime.now(),
      );

      expect(instance.data, isEmpty);
    });
  });

  // ── CameraProfile model ──────────────────────────────────────────────────────

  group('CameraProfile (cache model)', () {
    test('has required fields: id, userId, name, data (Map), cachedAt (DateTime)', () {
      final now = DateTime.now();
      final instance = CameraProfileCache(
        id: 'cam-001',
        userId: 'user-7',
        name: 'Canon EOS R5',
        data: {'sensor': 'full-frame', 'megapixels': 45},
        cachedAt: now,
      );

      expect(instance.id, equals('cam-001'));
      expect(instance.userId, equals('user-7'));
      expect(instance.name, equals('Canon EOS R5'));
      expect(instance.data, isA<Map>());
      expect(instance.data['megapixels'], equals(45));
      expect(instance.cachedAt, equals(now));
    });

    test('data field accepts a nested map', () {
      final instance = CameraProfileCache(
        id: 'cam-002',
        userId: 'user-8',
        name: 'Nikon Z8',
        data: {
          'lenses': [
            {'name': '50mm f/1.8', 'mount': 'Z'},
          ],
        },
        cachedAt: DateTime.now(),
      );

      expect(instance.data['lenses'], isA<List>());
    });
  });

  // ── Cache key helpers ────────────────────────────────────────────────────────

  group('Cache key helpers', () {
    test('cacheKeyForRec(cameraProfileId) returns "cache_rec_{cameraProfileId}"', () {
      expect(cacheKeyForRec('cam-profile-42'), equals('cache_rec_cam-profile-42'));
    });

    test('cacheKeyForRec with numeric-style id', () {
      expect(cacheKeyForRec('123'), equals('cache_rec_123'));
    });

    test('cacheKeyForCameras(userId) returns "cameras_{userId}"', () {
      expect(cacheKeyForCameras('user-7'), equals('cameras_user-7'));
    });

    test('cacheKeyForCameras with numeric-style userId', () {
      expect(cacheKeyForCameras('99'), equals('cameras_99'));
    });
  });
}

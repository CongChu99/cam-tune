// cache_service_test.dart
// Tests for CacheService — generic Hive read/write/delete with TTL helpers
//
// Phase: RED — tests reference classes that do not yet exist.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:cam_tune_mobile/core/cache_service.dart';

void main() {
  // ── Hive bootstrap ──────────────────────────────────────────────────────────
  // Each test run gets its own temporary directory so tests are hermetic.
  late Directory tempDir;

  setUpAll(() async {
    tempDir = await Directory.systemTemp.createTemp('hive_cache_test_');
    Hive.init(tempDir.path);
  });

  tearDownAll(() async {
    await Hive.close();
    await tempDir.delete(recursive: true);
  });

  // ── CacheService: write / read ───────────────────────────────────────────────

  group('CacheService.write / CacheService.read', () {
    const boxName = 'test_box';

    setUp(() async {
      // Open a fresh box before each test and clear it.
      final box = await Hive.openBox<dynamic>(boxName);
      await box.clear();
    });

    tearDown(() async {
      if (Hive.isBoxOpen(boxName)) {
        await Hive.box<dynamic>(boxName).close();
      }
    });

    test('write stores a string value, read returns it', () async {
      await CacheService.write(boxName, 'greeting', 'hello');

      final result = await CacheService.read<String>(boxName, 'greeting');

      expect(result, equals('hello'));
    });

    test('write stores a Map value, read returns it', () async {
      final payload = {'foo': 'bar', 'count': 42};
      await CacheService.write(boxName, 'map_key', payload);

      final result = await CacheService.read<Map>(boxName, 'map_key');

      expect(result, equals(payload));
    });

    test('read returns null for a key that has never been written', () async {
      final result = await CacheService.read<String>(boxName, 'nonexistent');

      expect(result, isNull);
    });
  });

  // ── CacheService: delete ────────────────────────────────────────────────────

  group('CacheService.delete', () {
    const boxName = 'delete_box';

    setUp(() async {
      final box = await Hive.openBox<dynamic>(boxName);
      await box.clear();
    });

    tearDown(() async {
      if (Hive.isBoxOpen(boxName)) {
        await Hive.box<dynamic>(boxName).close();
      }
    });

    test('delete removes the value so subsequent read returns null', () async {
      await CacheService.write(boxName, 'to_delete', 'value');

      // Confirm it was stored.
      expect(
        await CacheService.read<String>(boxName, 'to_delete'),
        equals('value'),
      );

      await CacheService.delete(boxName, 'to_delete');

      expect(
        await CacheService.read<String>(boxName, 'to_delete'),
        isNull,
      );
    });

    test('delete on a non-existent key does not throw', () async {
      // Should complete without exception.
      await expectLater(
        CacheService.delete(boxName, 'ghost_key'),
        completes,
      );
    });
  });

  // ── CacheService.isExpired ───────────────────────────────────────────────────

  group('CacheService.isExpired', () {
    test('returns false when cachedAt is within the TTL window', () {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 10));
      const ttlHours = 24;

      expect(CacheService.isExpired(cachedAt, ttlHours), isFalse);
    });

    test('returns true when cachedAt is beyond the TTL window', () {
      final cachedAt = DateTime.now().subtract(const Duration(hours: 25));
      const ttlHours = 24;

      expect(CacheService.isExpired(cachedAt, ttlHours), isTrue);
    });

    test('returns false exactly at the TTL boundary (edge: 1 second before)', () {
      // 1 second before expiry — should NOT be expired yet.
      final cachedAt = DateTime.now().subtract(
        const Duration(hours: 24) - const Duration(seconds: 1),
      );

      expect(CacheService.isExpired(cachedAt, 24), isFalse);
    });

    test('returns false when ttlHours is 0 (no TTL — never expires)', () {
      // Even a very old timestamp should be considered non-expired when ttl = 0.
      final cachedAt = DateTime.now().subtract(const Duration(days: 365));

      expect(CacheService.isExpired(cachedAt, 0), isFalse);
    });

    test('returns false when ttlHours is null (no TTL — never expires)', () {
      final cachedAt = DateTime.now().subtract(const Duration(days: 365));

      // Null means "no TTL" — the entry should never expire.
      expect(CacheService.isExpired(cachedAt, null), isFalse);
    });
  });
}

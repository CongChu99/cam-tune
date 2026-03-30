import 'package:hive_flutter/hive_flutter.dart';

class CacheService {
  // ── Box name constants ───────────────────────────────────────────────────────
  static const String boxRecommendations = 'recommendations';
  static const String boxCameraProfiles = 'camera_profiles';
  static const String boxAuth = 'auth';

  // ── Internal helper ──────────────────────────────────────────────────────────

  static Future<Box<dynamic>> _openBox(String boxName) async {
    if (Hive.isBoxOpen(boxName)) {
      return Hive.box<dynamic>(boxName);
    }
    return Hive.openBox<dynamic>(boxName);
  }

  // ── write ────────────────────────────────────────────────────────────────────

  static Future<void> write(String boxName, String key, dynamic value) async {
    final box = await _openBox(boxName);
    await box.put(key, value);
  }

  // ── read ─────────────────────────────────────────────────────────────────────

  static Future<T?> read<T>(String boxName, String key) async {
    final box = await _openBox(boxName);
    final value = box.get(key);
    if (value == null) return null;
    return value as T?;
  }

  // ── delete ───────────────────────────────────────────────────────────────────

  static Future<void> delete(String boxName, String key) async {
    final box = await _openBox(boxName);
    await box.delete(key);
  }

  // ── isExpired ────────────────────────────────────────────────────────────────

  /// Returns false when [ttlHours] is null or 0 (no TTL — entry never expires).
  /// Returns true when [DateTime.now()] is strictly after [cachedAt] + [ttlHours].
  /// Returns false otherwise (within TTL window).
  static bool isExpired(DateTime cachedAt, int? ttlHours) {
    if (ttlHours == null || ttlHours <= 0) return false;
    final expiresAt = cachedAt.add(Duration(hours: ttlHours));
    return DateTime.now().isAfter(expiresAt);
  }

  // ── evictExpired ─────────────────────────────────────────────────────────────

  /// Evicts all entries from [boxName] where [getCachedAt] returns a [DateTime]
  /// older than [ttlHours]. No-op if [ttlHours] is null or 0.
  static Future<void> evictExpired<T>(
    String boxName, {
    required int? ttlHours,
    required DateTime? Function(T value) getCachedAt,
  }) async {
    if (ttlHours == null || ttlHours <= 0) return;
    final box = await _openBox(boxName);
    final keysToDelete = <dynamic>[];
    for (final key in box.keys) {
      final value = box.get(key);
      if (value is T) {
        final cachedAt = getCachedAt(value);
        if (cachedAt != null && isExpired(cachedAt, ttlHours)) {
          keysToDelete.add(key);
        }
      }
    }
    await box.deleteAll(keysToDelete);
  }
}

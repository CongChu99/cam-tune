import 'package:hive/hive.dart';

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
    if (ttlHours == null || ttlHours == 0) return false;
    final expiresAt = cachedAt.add(Duration(hours: ttlHours));
    return DateTime.now().isAfter(expiresAt);
  }
}

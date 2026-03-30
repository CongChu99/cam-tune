import 'package:hive_flutter/hive_flutter.dart';

part 'camera_profile_cache.g.dart';

@HiveType(typeId: 2)
class CameraProfileCache {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String userId;

  @HiveField(2)
  final String name;

  @HiveField(3)
  final Map<String, dynamic> data;

  @HiveField(4)
  final DateTime cachedAt;

  const CameraProfileCache({
    required this.id,
    required this.userId,
    required this.name,
    required this.data,
    required this.cachedAt,
  });
}

String cacheKeyForCameras(String userId) => 'cameras_$userId';

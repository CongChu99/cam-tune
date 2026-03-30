import 'package:hive/hive.dart';

part 'recommendation_cache.g.dart';

@HiveType(typeId: 1)
class RecommendationCache {
  @HiveField(0)
  final String id;

  @HiveField(1)
  final String cameraProfileId;

  @HiveField(2)
  final Map<String, dynamic> data;

  @HiveField(3)
  final DateTime cachedAt;

  const RecommendationCache({
    required this.id,
    required this.cameraProfileId,
    required this.data,
    required this.cachedAt,
  });
}

String cacheKeyForRec(String cameraProfileId) => 'cache_rec_$cameraProfileId';

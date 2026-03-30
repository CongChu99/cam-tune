// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'recommendation_cache.dart';

class RecommendationCacheAdapter extends TypeAdapter<RecommendationCache> {
  @override
  final int typeId = 1;

  @override
  RecommendationCache read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return RecommendationCache(
      id: fields[0] as String,
      cameraProfileId: fields[1] as String,
      data: (fields[2] as Map).cast<String, dynamic>(),
      cachedAt: fields[3] as DateTime,
    );
  }

  @override
  void write(BinaryWriter writer, RecommendationCache obj) {
    writer
      ..writeByte(4)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.cameraProfileId)
      ..writeByte(2)
      ..write(obj.data)
      ..writeByte(3)
      ..write(obj.cachedAt);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RecommendationCacheAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

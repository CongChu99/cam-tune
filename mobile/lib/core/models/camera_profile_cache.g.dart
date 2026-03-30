// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'camera_profile_cache.dart';

class CameraProfileCacheAdapter extends TypeAdapter<CameraProfileCache> {
  @override
  final int typeId = 2;

  @override
  CameraProfileCache read(BinaryReader reader) {
    final numOfFields = reader.readByte();
    final fields = <int, dynamic>{
      for (int i = 0; i < numOfFields; i++) reader.readByte(): reader.read(),
    };
    return CameraProfileCache(
      id: fields[0] as String,
      userId: fields[1] as String,
      name: fields[2] as String,
      data: (fields[3] as Map).cast<String, dynamic>(),
      cachedAt: fields[4] as DateTime,
    );
  }

  @override
  void write(BinaryWriter writer, CameraProfileCache obj) {
    writer
      ..writeByte(5)
      ..writeByte(0)
      ..write(obj.id)
      ..writeByte(1)
      ..write(obj.userId)
      ..writeByte(2)
      ..write(obj.name)
      ..writeByte(3)
      ..write(obj.data)
      ..writeByte(4)
      ..write(obj.cachedAt);
  }

  @override
  int get hashCode => typeId.hashCode;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is CameraProfileCacheAdapter &&
          runtimeType == other.runtimeType &&
          typeId == other.typeId;
}

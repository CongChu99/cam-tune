// api_service.dart
// ApiService: Dio HTTP client with Bearer token injection and 401 auto-refresh.

import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../features/auth/auth_service.dart';
import '../features/auth/auth_notifier.dart';

// ─── Configuration ────────────────────────────────────────────────────────

/// Base URL for the CamTune API backend.
/// Override via environment config as needed.
const String _kApiBaseUrl = 'https://api.camtune.app';

// ─── Auth Interceptor ─────────────────────────────────────────────────────

/// Dio interceptor that:
/// 1. Injects Bearer token from [AuthServiceInterface] on every request.
/// 2. On 401 response: attempts token refresh and retries original request.
/// 3. On refresh failure: logs out and marks as unauthenticated.
class AuthInterceptor extends Interceptor {
  final AuthServiceInterface _authService;
  final AuthNotifier _authNotifier;
  final Dio _dio;

  // Completer-based queue to serialize concurrent 401 refresh attempts.
  // Concurrent 401s await the in-flight refresh rather than racing.
  Completer<void>? _refreshCompleter;

  AuthInterceptor({
    required AuthServiceInterface authService,
    required AuthNotifier authNotifier,
    required Dio dio,
  })  : _authService = authService,
        _authNotifier = authNotifier,
        _dio = dio;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _authService.getAccessToken();
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    return handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    // Only handle 401 Unauthorized.
    if (err.response?.statusCode != 401) {
      return handler.next(err);
    }

    try {
      // Serialize concurrent 401s: if a refresh is already in flight,
      // await it instead of starting a second one.
      await _doRefresh();

      // Retry the original request with the new token.
      final newToken = await _authService.getAccessToken();
      final retryOptions = err.requestOptions;
      if (newToken != null) {
        retryOptions.headers['Authorization'] = 'Bearer $newToken';
      }

      final response = await _dio.fetch(retryOptions);
      return handler.resolve(response);
    } catch (_) {
      // Refresh token is expired — force re-login.
      await _authNotifier.logout();
      return handler.next(err);
    }
  }

  /// Performs a token refresh, queuing any concurrent callers behind a single
  /// in-flight [Completer] so only one refresh request goes out at a time.
  Future<void> _doRefresh() async {
    if (_refreshCompleter != null) {
      await _refreshCompleter!.future;
      return;
    }
    final completer = Completer<void>();
    _refreshCompleter = completer;
    try {
      await _authService.refreshToken();
      completer.complete();
    } catch (e) {
      completer.completeError(e);
      rethrow;
    } finally {
      // Only reset if we're still the current completer (guards against
      // races where a new refresh started before finally ran).
      if (identical(_refreshCompleter, completer)) {
        _refreshCompleter = null;
      }
    }
  }
}

// ─── ApiService ───────────────────────────────────────────────────────────

/// Configured Dio HTTP client for the CamTune API.
///
/// Includes:
/// - Base URL configuration
/// - Default headers (Content-Type: application/json)
/// - [AuthInterceptor] for Bearer token injection and 401 auto-refresh
class ApiService {
  late final Dio dio;

  ApiService({
    required AuthServiceInterface authService,
    required AuthNotifier authNotifier,
    String baseUrl = _kApiBaseUrl,
  }) {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      AuthInterceptor(
        authService: authService,
        authNotifier: authNotifier,
        dio: dio,
      ),
    );
  }
}

// ─── Riverpod providers ──────────────────────────────────────────────────────

/// Provider for [ApiService].
final apiServiceProvider = Provider<ApiService>((ref) {
  final authService = ref.watch(authServiceProvider);
  final authNotifier = ref.watch(authNotifierProvider.notifier);
  return ApiService(
    authService: authService,
    authNotifier: authNotifier,
  );
});

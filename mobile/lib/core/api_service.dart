// api_service.dart
// ApiService: Dio HTTP client with Bearer token injection and 401 auto-refresh.

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

  // Guard flag to prevent infinite retry loops.
  bool _isRefreshing = false;

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
    if (err.response?.statusCode != 401 || _isRefreshing) {
      return handler.next(err);
    }

    _isRefreshing = true;
    try {
      // Attempt to refresh the access token.
      await _authService.refreshToken();

      // Retry the original request with the new token.
      final newToken = await _authService.getAccessToken();
      final retryOptions = err.requestOptions;
      if (newToken != null) {
        retryOptions.headers['Authorization'] = 'Bearer $newToken';
      }

      final response = await _dio.fetch(retryOptions);
      _isRefreshing = false;
      return handler.resolve(response);
    } catch (_) {
      // Refresh token is expired — force re-login.
      _isRefreshing = false;
      await _authNotifier.logout();
      return handler.next(err);
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

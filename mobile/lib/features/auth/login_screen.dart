// login_screen.dart
// LoginScreen: PKCE OAuth login screen with "Sign in with Google" button.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_notifier.dart';

/// Login screen showing "Sign in with Google" button.
/// Navigates to /home on successful authentication.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  /// Tracks whether the user has tapped the login button (in-progress login).
  bool _isSigningIn = false;

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);

    // Listen for auth state changes; navigation to /home is handled by
    // routerProvider redirect — do NOT call context.go here to avoid
    // dual-navigation.
    ref.listen<AuthState>(authNotifierProvider, (previous, next) {
      if (next == const AuthState.loading()) {
        // Still loading — nothing to do.
      } else if (next.isAuthenticated) {
        // Navigation handled by routerProvider redirect.
        if (mounted) setState(() => _isSigningIn = false);
      } else {
        // Unauthenticated — reset flag and show error if present.
        if (mounted) setState(() => _isSigningIn = false);
        final errorMessage = next.errorMessage;
        if (errorMessage != null && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(errorMessage)),
          );
        }
      }
    });

    // Show loading overlay only when the user is actively signing in.
    final showLoading = _isSigningIn ||
        (authState == const AuthState.loading() && _isSigningIn);

    return Scaffold(
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'CamTune',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Camera settings & lens recommendations',
                style: TextStyle(fontSize: 16, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),
              if (showLoading)
                const CircularProgressIndicator()
              else
                ElevatedButton.icon(
                  onPressed: () async {
                    setState(() => _isSigningIn = true);
                    await ref.read(authNotifierProvider.notifier).login();
                  },
                  icon: const Icon(Icons.login),
                  label: const Text('Sign in with Google'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

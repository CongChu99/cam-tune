// login_screen.dart
// LoginScreen: PKCE OAuth login screen with "Sign in with Google" button.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
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

    // Listen for auth state changes and navigate to home when authenticated.
    ref.listen<AuthState>(authNotifierProvider, (previous, next) {
      if (next.isAuthenticated) {
        context.go('/home');
      }
      // Reset signing-in flag when we reach a terminal state.
      if (next != const AuthState.loading()) {
        if (mounted) {
          setState(() => _isSigningIn = false);
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

// login_screen_test.dart
// TDD RED phase: tests for LoginScreen widget.
// These tests FAIL initially before login_screen.dart has the proper implementation.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cam_tune_mobile/features/auth/login_screen.dart';
import 'package:cam_tune_mobile/features/auth/auth_service.dart';

// ─── Manual mock ────────────────────────────────────────────────────────────

class MockAuthService implements AuthServiceInterface {
  @override
  Future<void> login() async {}

  @override
  Future<void> logout() async {}

  @override
  Future<String?> getAccessToken() async => null;

  @override
  Future<void> refreshToken() async {}

  @override
  Future<bool> isLoggedIn() async => false;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

void main() {
  Widget buildLoginScreen() {
    final mockService = MockAuthService();
    return ProviderScope(
      overrides: [
        authServiceProvider.overrideWithValue(mockService),
      ],
      child: const MaterialApp(
        home: LoginScreen(),
      ),
    );
  }

  group('LoginScreen', () {
    testWidgets('renders "Sign in with Google" button', (tester) async {
      await tester.pumpWidget(buildLoginScreen());
      await tester.pump();

      expect(find.text('Sign in with Google'), findsOneWidget);
    });

    testWidgets('shows a button that is tappable', (tester) async {
      await tester.pumpWidget(buildLoginScreen());
      await tester.pump();

      // The "Sign in with Google" text exists in the tree.
      final signInText = find.text('Sign in with Google');
      expect(signInText, findsOneWidget);

      // Verify it is within an ElevatedButton (ElevatedButton.icon is a subtype).
      // Use byWidgetPredicate to match ElevatedButton or its subtypes.
      final button = find.ancestor(
        of: signInText,
        matching: find.byWidgetPredicate((w) => w is ElevatedButton),
      );
      expect(button, findsOneWidget);
    });

    testWidgets('renders a Scaffold', (tester) async {
      await tester.pumpWidget(buildLoginScreen());
      await tester.pump();

      expect(find.byType(Scaffold), findsOneWidget);
    });
  });
}

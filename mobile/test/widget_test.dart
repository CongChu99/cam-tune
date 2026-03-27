// Basic smoke test for CamTuneApp.
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:cam_tune_mobile/main.dart';

void main() {
  testWidgets('CamTuneApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: CamTuneApp(),
      ),
    );
    expect(find.byType(CamTuneApp), findsOneWidget);
  });
}

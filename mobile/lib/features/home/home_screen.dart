import 'package:flutter/material.dart';

import 'package:cam_tune_mobile/shared/widgets/offline_banner.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        children: const [
          OfflineBanner(),
          Expanded(
            child: Center(
              child: Text('Home'),
            ),
          ),
        ],
      ),
    );
  }
}

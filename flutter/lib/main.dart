import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'providers.dart';
import 'screens/home_screen.dart';
import 'theme.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.light);

  final container = ProviderContainer();
  await initAudioService(container);

  runApp(UncontrolledProviderScope(
    container: container,
    child: const WaxApp(),
  ));
}

class WaxApp extends StatelessWidget {
  const WaxApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Wax',
      theme: buildTheme(),
      debugShowCheckedModeBanner: false,
      home: const HomeScreen(),
    );
  }
}

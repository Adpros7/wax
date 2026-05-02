import 'package:flutter/material.dart';

const kAccent = Color(0xFFA855F7);
const kAccentBright = Color(0xFFC084FC);
const kBg = Color(0xFF07070A);
const kPanel = Color(0xFF111114);
const kPanel2 = Color(0xFF17171C);
const kBorder = Color(0x14FFFFFF);
const kText = Color(0xFFEDEDED);
const kMuted = Color(0xFF8B8B94);

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: kBg,
    colorScheme: base.colorScheme.copyWith(
      primary: kAccent,
      secondary: kAccentBright,
      surface: kPanel,
      onSurface: kText,
    ),
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: kText,
      elevation: 0,
      centerTitle: true,
    ),
    iconTheme: const IconThemeData(color: kText),
    textTheme: base.textTheme.apply(
      bodyColor: kText,
      displayColor: kText,
    ),
  );
}

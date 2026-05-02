import 'package:flutter/material.dart';
import '../theme.dart';
import '../widgets/mini_player.dart';
import 'library_screen.dart';
import 'playlists_screen.dart';
import 'search_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  static const _screens = <Widget>[SearchScreen(), LibraryScreen(), PlaylistsScreen()];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: IndexedStack(index: _tab, children: _screens),
      ),
      bottomNavigationBar: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const MiniPlayer(),
          Container(
            decoration: const BoxDecoration(
              color: kPanel,
              border: Border(top: BorderSide(color: kBorder)),
            ),
            child: SafeArea(
              top: false,
              child: NavigationBarTheme(
                data: NavigationBarThemeData(
                  backgroundColor: Colors.transparent,
                  indicatorColor: Colors.transparent,
                  labelTextStyle: WidgetStateProperty.resolveWith((states) {
                    final selected = states.contains(WidgetState.selected);
                    return TextStyle(
                      fontSize: 11,
                      color: selected ? kAccentBright : kMuted,
                      fontWeight: FontWeight.w600,
                    );
                  }),
                  iconTheme: WidgetStateProperty.resolveWith((states) {
                    final selected = states.contains(WidgetState.selected);
                    return IconThemeData(
                      color: selected ? kAccentBright : kMuted,
                      size: 24,
                    );
                  }),
                ),
                child: NavigationBar(
                  height: 64,
                  selectedIndex: _tab,
                  onDestinationSelected: (i) => setState(() => _tab = i),
                  destinations: const [
                    NavigationDestination(
                      icon: Icon(Icons.search),
                      label: 'Rechercher',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.favorite),
                      label: 'Favoris',
                    ),
                    NavigationDestination(
                      icon: Icon(Icons.queue_music),
                      label: 'Playlists',
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

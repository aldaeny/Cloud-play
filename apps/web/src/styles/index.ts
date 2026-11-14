/**
 * Single stylesheet entry — imported once by each router shell.
 *
 * Order matters:
 *   1. legacy baselines   historic layout rules for the operator, playlist and
 *                         Xtream surfaces that still depend on them.
 *   2. tokens + theme     the universal design system (colour, type, canvas).
 *   3. glass + controls   materials and every interactive control.
 *   4. navigation/home/screens  the product surfaces, rebuilt on the system.
 *   5. rtl + motion       direction audit and the spring motion layer.
 */
import './globals.css';
import './typography.css';
import './films.css';
import './live.css';
import './public-tv.css';
import './private-player.css';
import './player.css';
import './channel-ui.css';

import './tokens.generated.css';
import './theme.css';
import './glass.css';
import './buttons.css';
import './controls.css';
import './navigation.css';
import './home.css';
import './screens.css';
import './rtl.css';
import './motion.css';

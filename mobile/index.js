/**
 * @format
 *
 * React Native CLI entrypoint. `AppRegistry.registerComponent` is what
 * `expo`'s `registerRootComponent` wrapped; the component name must match
 * `MainActivity.getMainComponentName()` on Android and the module name passed
 * to `startReactNative` on iOS.
 */

import { AppRegistry } from 'react-native';

import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

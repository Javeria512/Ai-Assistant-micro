import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Home: undefined;
  Calendar: undefined;
  Chats: undefined;
  Tasks: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  App: NavigatorScreenParams<TabParamList>;
};

export type TabName = keyof TabParamList;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

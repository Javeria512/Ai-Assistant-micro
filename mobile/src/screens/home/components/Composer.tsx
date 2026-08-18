import React from 'react';
import { Keyboard, StyleSheet, TextInput, View } from 'react-native';
import { PulseRing } from '../../../components/animations';
import { Chip, Icon, Touch } from '../../../components/ui';
import { SUGGESTIONS } from '../../../constants';
import { useApp } from '../../../store';
import {
  FONT,
  MIN_TOUCH,
  ON_ACCENT,
  RADIUS,
  SPACING,
  TYPE,
  ms,
  useTheme,
} from '../../../theme';

const MIC = MIN_TOUCH;
const SEND = ms(40);

/** The "Ask your AI" input pill plus its starter-prompt chips. */
export function Composer() {
  const { c, s } = useTheme();
  const app = useApp();

  const submit = () => {
    app.ask(app.input);
    Keyboard.dismiss();
  };

  return (
    <>
      <View style={[styles.composer, { backgroundColor: c.card }, s.card]}>
        <View style={styles.micWrap}>
          <PulseRing size={MIC} color={c.vividTeal} />
          <View style={[styles.mic, { backgroundColor: c.vividTeal }]}>
            <Icon name="mic" size={ms(20)} color={ON_ACCENT} />
          </View>
        </View>

        <TextInput
          value={app.input}
          onChangeText={app.setInput}
          onSubmitEditing={submit}
          returnKeyType="send"
          placeholder="Ask anything about your day…"
          placeholderTextColor={c.faint}
          // TextInput does not read the shared `Txt` styles, so the family has
          // to be named here. It previously named the Expo-era font key, which
          // no longer resolves — the field silently rendered in the system face.
          style={[styles.input, { color: c.ink }]}
          accessibilityLabel="Ask your assistant"
        />

        <Touch
          onPress={submit}
          style={[styles.send, { backgroundColor: c.tealSoft }]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          <Icon name="send" size={ms(18)} color={c.teal} />
        </Touch>
      </View>

      <View style={styles.chips}>
        {SUGGESTIONS.map((chip) => (
          <Chip key={chip} label={chip} raised onPress={() => app.ask(chip)} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.sm + 1,
    borderRadius: RADIUS.pill,
  },
  micWrap: { alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: MIC,
    padding: 0,
    fontFamily: FONT.regular,
    fontSize: TYPE.body.fontSize,
  },
  send: {
    width: SEND,
    height: SEND,
    borderRadius: SEND / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
});

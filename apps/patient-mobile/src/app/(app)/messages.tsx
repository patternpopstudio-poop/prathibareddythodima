import { StyleSheet } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { ScreenNav } from '@/components/ui/screen-nav';
import { Spacing } from '@/constants/theme';

export default function MessagesScreen() {
  return (
    <Screen>
      <ScreenNav title="Messages" />
      <EmptyState
        icon="messages"
        title="No messages yet"
        description="Consultation chats will appear here once you book a doctor. Messaging ships in a later phase."
        style={styles.empty}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginTop: Spacing.xl,
  },
});
